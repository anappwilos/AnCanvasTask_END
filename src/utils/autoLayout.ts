import dagre from 'dagre';
import { Editor } from 'tldraw';
import { scanTaskBlocks } from './markdownSync';

export interface AutoLayoutResult {
  taskCount: number;
  groupCount: number;
}

/**
 * Automatically computes a clean, hierarchical DAG layout for all groups and tasks
 * placing blockers above blocked tasks, preventing overlaps, and sizing groups appropriately.
 */
export function applyAutoLayout(editor: Editor, markdown: string): AutoLayoutResult {
  const { taskBlocks, groupHeadings } = scanTaskBlocks(markdown);
  const shapes = editor.getCurrentPageShapes();

  // Find all task shapes and task-group shapes
  const taskShapes = shapes.filter((s) => (s as any).type === 'task') as any[];
  const groupShapes = shapes.filter((s) => (s as any).type === 'task-group') as any[];

  if (taskShapes.length === 0 && groupShapes.length === 0) {
    return { taskCount: 0, groupCount: 0 };
  }

  // Map normalized taskId -> taskShape
  const taskIdToShapeMap = new Map<string, any>();
  taskShapes.forEach((s) => {
    const tid = s.props?.taskId;
    if (tid) {
      taskIdToShapeMap.set(tid.toLowerCase(), s);
    }
  });

  // Map normalized groupTitle -> groupShape
  const groupTitleToShapeMap = new Map<string, any>();
  groupShapes.forEach((g) => {
    const title = g.props?.title;
    if (title) {
      groupTitleToShapeMap.set(title.toLowerCase(), g);
    }
  });

  // Organize tasks by group
  const tasksByGroup = new Map<string, typeof taskBlocks>();
  groupHeadings.forEach((gh) => {
    tasksByGroup.set(gh.title, []);
  });

  taskBlocks.forEach((tb) => {
    const grp = tb.groupTitle || 'General';
    if (!tasksByGroup.has(grp)) {
      tasksByGroup.set(grp, []);
    }
    tasksByGroup.get(grp)!.push(tb);
  });

  const CARD_WIDTH = 320;
  const CARD_HEIGHT = 110;
  const GROUP_PADDING_X = 24;
  const GROUP_PADDING_TOP = 64; // Space for header (## Section)
  const GROUP_PADDING_BOTTOM = 24;
  const GROUP_GAP_X = 48;

  const updates: any[] = [];
  let currentGroupX = 80;
  const GROUP_START_Y = 80;

  // Process each group using Dagre for DAG dependency hierarchical ordering
  for (const [groupTitle, tasks] of tasksByGroup.entries()) {
    if (tasks.length === 0) {
      const groupShape = groupTitleToShapeMap.get(groupTitle.toLowerCase());
      if (groupShape) {
        updates.push({
          id: groupShape.id,
          type: 'task-group',
          x: currentGroupX,
          y: GROUP_START_Y,
          props: {
            ...groupShape.props,
            w: 360,
            h: 200,
          },
        });
      }
      currentGroupX += 360 + GROUP_GAP_X;
      continue;
    }

    // Build Dagre graph for this group's tasks
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'TB', // Dependency flows from top to bottom
      nodesep: 24,   // Horizontal distance between parallel branches
      ranksep: 42,   // Vertical distance between dependent ranks
      marginx: 0,
      marginy: 0,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes
    tasks.forEach((t) => {
      const taskId = (t.detectedId || `task-${t.taskLineIndex}`).toLowerCase();
      g.setNode(taskId, { width: CARD_WIDTH, height: CARD_HEIGHT });
    });

    // Add edges for "Blocked by" dependencies inside the same group
    const taskIdsInGroup = new Set(
      tasks.map((t) => (t.detectedId || `task-${t.taskLineIndex}`).toLowerCase())
    );

    tasks.forEach((t) => {
      const blockedTaskId = (t.detectedId || `task-${t.taskLineIndex}`).toLowerCase();
      if (t.detectedBlockedBy) {
        const blockerIds = t.detectedBlockedBy
          .split(',')
          .map((b) => b.trim().toLowerCase())
          .filter(Boolean);

        blockerIds.forEach((blockerId) => {
          // If the blocker is in the same group, add directed edge (blocker -> blocked)
          if (taskIdsInGroup.has(blockerId) && blockerId !== blockedTaskId) {
            g.setEdge(blockerId, blockedTaskId);
          }
        });
      }
    });

    // Run dagre layout
    dagre.layout(g);

    // Compute min/max coordinates within the group
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    tasks.forEach((t) => {
      const taskId = (t.detectedId || `task-${t.taskLineIndex}`).toLowerCase();
      const node = g.node(taskId);
      if (node) {
        const left = node.x - node.width / 2;
        const top = node.y - node.height / 2;
        const right = left + node.width;
        const bottom = top + node.height;

        if (left < minX) minX = left;
        if (top < minY) minY = top;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
      }
    });

    if (minX === Infinity) {
      minX = 0;
      maxX = CARD_WIDTH;
      minY = 0;
      maxY = CARD_HEIGHT;
    }

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const groupWidth = Math.max(360, contentWidth + GROUP_PADDING_X * 2);
    const groupHeight = Math.max(
      220,
      contentHeight + GROUP_PADDING_TOP + GROUP_PADDING_BOTTOM
    );

    const groupX = currentGroupX;
    const groupY = GROUP_START_Y;

    // Position group shape
    const groupShape = groupTitleToShapeMap.get(groupTitle.toLowerCase());
    if (groupShape) {
      updates.push({
        id: groupShape.id,
        type: 'task-group',
        x: groupX,
        y: groupY,
        props: {
          ...groupShape.props,
          w: groupWidth,
          h: groupHeight,
          count: tasks.length,
        },
      });
    }

    // Position task shapes inside the group
    tasks.forEach((t) => {
      const taskId = (t.detectedId || `task-${t.taskLineIndex}`).toLowerCase();
      const node = g.node(taskId);
      const shape = taskIdToShapeMap.get(taskId);

      if (shape && node) {
        const nodeLeft = node.x - node.width / 2;
        const nodeTop = node.y - node.height / 2;

        const taskX = groupX + GROUP_PADDING_X + (nodeLeft - minX);
        const taskY = groupY + GROUP_PADDING_TOP + (nodeTop - minY);

        updates.push({
          id: shape.id,
          type: 'task',
          x: taskX,
          y: taskY,
          props: {
            ...shape.props,
            groupTitle: groupTitle,
            w: CARD_WIDTH,
            h: CARD_HEIGHT,
          },
        });
      }
    });

    currentGroupX += groupWidth + GROUP_GAP_X;
  }

  // Apply all shape position updates to editor in one atomic batch
  if (updates.length > 0) {
    editor.updateShapes(updates);
  }

  // Center and fit canvas content smoothly
  setTimeout(() => {
    editor.zoomToFit({ animation: { duration: 300 } });
  }, 60);

  return {
    taskCount: taskShapes.length,
    groupCount: groupShapes.length,
  };
}
