import React from 'react';
import {
  createShapeId,
  Editor,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  TLBaseShape,
} from 'tldraw';

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type TaskShapeProps = {
  w: number;
  h: number;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  taskId?: string;
};

export type ITaskShape = TLBaseShape<'task', TaskShapeProps>;

export class TaskShapeUtil extends ShapeUtil<any> {
  static override type = 'task' as const;

  static override props: RecordProps<any> = {
    w: T.number,
    h: T.number,
    title: T.string,
    completed: T.boolean,
    priority: T.string,
    taskId: T.string.optional(),
  };

  getDefaultProps(): TaskShapeProps {
    return {
      w: 320,
      h: 110,
      title: 'New developer task',
      completed: false,
      priority: 'P1',
      taskId: 'task',
    };
  }

  getGeometry(shape: ITaskShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  getIndicatorPath(shape: ITaskShape) {
    if (typeof Path2D !== 'undefined') {
      const path = new Path2D();
      if (typeof path.roundRect === 'function') {
        path.roundRect(0, 0, shape.props.w, shape.props.h, 12);
      } else {
        path.rect(0, 0, shape.props.w, shape.props.h);
      }
      return path;
    }
    return undefined;
  }

  component(shape: ITaskShape) {
    const { title, completed, priority, taskId, w, h } = shape.props;

    const toggleCompleted = (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      this.editor.updateShape({
        id: shape.id,
        type: 'task',
        props: {
          completed: !completed,
        },
      } as any);
    };

    const cyclePriority = (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      const priorities: TaskPriority[] = ['P0', 'P1', 'P2', 'P3'];
      const nextIndex = (priorities.indexOf(priority) + 1) % priorities.length;
      this.editor.updateShape({
        id: shape.id,
        type: 'task',
        props: {
          priority: priorities[nextIndex],
        },
      } as any);
    };

    const priorityColors: Record<TaskPriority, { text: string; bg: string; border: string }> = {
      P0: { text: 'text-red-400', bg: 'bg-red-950/70', border: 'border-red-800' },
      P1: { text: 'text-amber-400', bg: 'bg-amber-950/70', border: 'border-amber-800' },
      P2: { text: 'text-blue-400', bg: 'bg-blue-950/70', border: 'border-blue-800' },
      P3: { text: 'text-zinc-400', bg: 'bg-zinc-800/80', border: 'border-zinc-700' },
    };

    const currentPriority = priorityColors[priority] || priorityColors.P1;

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          pointerEvents: 'all',
        }}
      >
        <div
          className={`w-full h-full rounded-xl bg-zinc-900 border transition-all duration-150 select-none flex flex-col justify-between p-3.5 shadow-xl ${
            completed
              ? 'border-zinc-800/80 bg-zinc-950/90 opacity-75'
              : 'border-zinc-700/90 hover:border-zinc-500 shadow-black/60'
          }`}
        >
          {/* Top Row: Checkbox + Title + Priority badge */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggleCompleted}
                aria-label={completed ? 'Mark task as incomplete' : 'Mark task as complete'}
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                  completed
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-zinc-800 border-zinc-600 hover:border-zinc-400'
                }`}
              >
                {completed && (
                  <svg
                    className="w-3 h-3 stroke-current stroke-[2.5]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <span
                className={`text-sm font-medium leading-snug transition-colors line-clamp-2 ${
                  completed ? 'text-zinc-500 line-through' : 'text-zinc-100'
                }`}
              >
                {title}
              </span>
            </div>

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={cyclePriority}
              title="Click to cycle priority (P0-P3)"
              className={`px-2 py-0.5 text-xs font-mono font-bold rounded border cursor-pointer shrink-0 transition-transform hover:scale-105 ${currentPriority.text} ${currentPriority.bg} ${currentPriority.border}`}
            >
              {priority}
            </button>
          </div>

          {/* Bottom Row: Discrete ID + Status */}
          <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pt-1.5 border-t border-zinc-800/60 mt-1">
            {taskId ? (
              <span className="text-zinc-400 font-mono text-[11px] truncate tracking-tight flex items-center gap-1 max-w-[200px]" title={`ID: ${taskId}`}>
                <span className="text-zinc-600 font-normal">#</span>
                <span>{taskId}</span>
              </span>
            ) : (
              <span className="text-zinc-600 font-mono text-[11px] italic">no-id</span>
            )}

            <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
              {completed ? 'DONE' : 'OPEN'}
            </span>
          </div>
        </div>
      </HTMLContainer>
    );
  }
}

export type GroupShapeProps = {
  w: number;
  h: number;
  title: string;
  count: number;
  completedCount: number;
};

export type ITaskGroupShape = TLBaseShape<'task-group', GroupShapeProps>;

export class TaskGroupShapeUtil extends ShapeUtil<any> {
  static override type = 'task-group' as const;

  static override props: RecordProps<any> = {
    w: T.number,
    h: T.number,
    title: T.string,
    count: T.number,
    completedCount: T.number,
  };

  getDefaultProps(): GroupShapeProps {
    return {
      w: 360,
      h: 300,
      title: 'Section',
      count: 0,
      completedCount: 0,
    };
  }

  getGeometry(shape: ITaskGroupShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  getIndicatorPath(shape: ITaskGroupShape) {
    if (typeof Path2D !== 'undefined') {
      const path = new Path2D();
      if (typeof path.roundRect === 'function') {
        path.roundRect(0, 0, shape.props.w, shape.props.h, 16);
      } else {
        path.rect(0, 0, shape.props.w, shape.props.h);
      }
      return path;
    }
    return undefined;
  }

  component(shape: ITaskGroupShape) {
    const { title, count, completedCount, w, h } = shape.props;

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          pointerEvents: 'none',
        }}
      >
        <div className="w-full h-full rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-4 flex flex-col justify-between select-none shadow-sm backdrop-blur-xs transition-colors">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-mono text-xs font-bold">##</span>
              <h2 className="text-sm font-semibold text-zinc-100 font-mono tracking-tight truncate max-w-[220px]">
                {title}
              </h2>
            </div>
            {count > 0 && (
              <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                {completedCount > 0
                  ? `${completedCount}/${count} done`
                  : `${count} ${count === 1 ? 'task' : 'tasks'}`}
              </span>
            )}
          </div>

          {/* Guide background area */}
          <div className="flex-1 w-full rounded-xl border border-dashed border-zinc-800/30 mt-3" />
        </div>
      </HTMLContainer>
    );
  }
}

export interface ParsedMarkdownTask {
  title: string;
  completed: boolean;
  taskId?: string;
  priority: TaskPriority;
}

export interface ParsedGroup {
  title: string;
  tasks: ParsedMarkdownTask[];
}

export const INITIAL_MOCK_GROUPS: ParsedGroup[] = [
  {
    title: 'Autenticación',
    tasks: [
      {
        title: 'Crear login',
        completed: false,
        priority: 'P0',
        taskId: 'login',
      },
      {
        title: 'Crear perfil',
        completed: false,
        priority: 'P2',
        taskId: 'profile',
      },
    ],
  },
  {
    title: 'Infraestructura',
    tasks: [
      {
        title: 'Setup Render Web Service & build pipeline',
        completed: true,
        priority: 'P1',
        taskId: 'infra-deploy',
      },
      {
        title: 'Implement infinite canvas spatial coordinates',
        completed: false,
        priority: 'P0',
        taskId: 'canvas-coords',
      },
      {
        title: 'Optimize shape bounding box collision & hit-testing',
        completed: false,
        priority: 'P3',
        taskId: 'perf-collision',
      },
    ],
  },
];

export function parseTasksMarkdown(markdown: string): ParsedGroup[] {
  const lines = markdown.split(/\r?\n/);
  const groups: ParsedGroup[] = [];
  let currentGroup: ParsedGroup | null = null;
  let currentTask: ParsedMarkdownTask | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Detect "## Heading"
    const headingMatch = trimmed.match(/^##\s+(.+)$/);
    if (headingMatch) {
      if (currentTask && currentGroup) {
        currentGroup.tasks.push(currentTask);
        currentTask = null;
      }
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        title: headingMatch[1].trim(),
        tasks: [],
      };
      continue;
    }

    // Detect task: "- [ ] Title" or "- [x] Title"
    const taskMatch = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/);
    if (taskMatch) {
      if (currentTask && currentGroup) {
        currentGroup.tasks.push(currentTask);
        currentTask = null;
      }
      if (!currentGroup) {
        currentGroup = {
          title: 'General',
          tasks: [],
        };
      }
      const isCompleted = taskMatch[1].toLowerCase() === 'x';
      const title = taskMatch[2].trim();
      currentTask = {
        title,
        completed: isCompleted,
        priority: 'P1',
        taskId: undefined,
      };
      continue;
    }

    // If parsing a task, check for metadata attributes underneath:
    // e.g. "  - ID: login" or "ID: login"
    // e.g. "  - Priority: P0" or "Priority: P0"
    if (currentTask) {
      const idMatch = trimmed.match(/^(?:[-*]\s*)?ID\s*:\s*(.+)$/i);
      if (idMatch) {
        currentTask.taskId = idMatch[1].trim();
        continue;
      }

      const priorityMatch = trimmed.match(/^(?:[-*]\s*)?Priority\s*:\s*(P[0-3])$/i);
      if (priorityMatch) {
        const p = priorityMatch[1].toUpperCase() as TaskPriority;
        if (['P0', 'P1', 'P2', 'P3'].includes(p)) {
          currentTask.priority = p;
        }
        continue;
      }
    }
  }

  if (currentTask && currentGroup) {
    currentGroup.tasks.push(currentTask);
  }
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

export function populateCanvasWithGroups(editor: Editor, groups: ParsedGroup[]): { taskCount: number; groupCount: number } {
  // Clear existing task and group shapes on canvas
  const existingShapes = editor
    .getCurrentPageShapes()
    .filter((s) => (s as any).type === 'task' || (s as any).type === 'task-group');

  if (existingShapes.length > 0) {
    editor.deleteShapes(existingShapes.map((s) => s.id));
  }

  const cardWidth = 320;
  const cardHeight = 110;
  const cardGap = 14;
  const groupPaddingX = 20;
  const groupHeaderHeight = 56;
  const groupPaddingTop = 16;
  const groupPaddingBottom = 20;

  const groupWidth = cardWidth + groupPaddingX * 2; // 360px
  const groupSpacingX = groupWidth + 40; // 400px

  const groupShapesToCreate: any[] = [];
  const taskShapesToCreate: any[] = [];

  let totalTasks = 0;

  groups.forEach((group, groupIndex) => {
    const taskCount = group.tasks.length;
    totalTasks += taskCount;
    const completedCount = group.tasks.filter((t) => t.completed).length;

    const calculatedHeight = Math.max(
      160,
      groupHeaderHeight +
        groupPaddingTop +
        taskCount * cardHeight +
        Math.max(0, taskCount - 1) * cardGap +
        groupPaddingBottom
    );

    const groupX = 80 + groupIndex * groupSpacingX;
    const groupY = 80;

    // Create Group container shape
    groupShapesToCreate.push({
      id: createShapeId(),
      type: 'task-group' as const,
      x: groupX,
      y: groupY,
      props: {
        w: groupWidth,
        h: calculatedHeight,
        title: group.title,
        count: taskCount,
        completedCount,
      },
    });

    // Create movable Task shapes inside the group's visual bounds
    group.tasks.forEach((task, taskIndex) => {
      const taskX = groupX + groupPaddingX;
      const taskY =
        groupY +
        groupHeaderHeight +
        groupPaddingTop +
        taskIndex * (cardHeight + cardGap);

      taskShapesToCreate.push({
        id: createShapeId(),
        type: 'task' as const,
        x: taskX,
        y: taskY,
        props: {
          w: cardWidth,
          h: cardHeight,
          title: task.title,
          completed: task.completed,
          priority: task.priority || 'P1',
          taskId: task.taskId || `task-${taskIndex + 1}`,
        },
      });
    });
  });

  // Create groups first so they render underneath, then task cards on top
  if (groupShapesToCreate.length > 0) {
    (editor.createShapes as any)(groupShapesToCreate);
  }
  if (taskShapesToCreate.length > 0) {
    (editor.createShapes as any)(taskShapesToCreate);
  }

  editor.zoomToFit({ animation: { duration: 250 } });
  return { taskCount: totalTasks, groupCount: groups.length };
}

export function seedMockTasks(editor: Editor) {
  const existingShapes = editor
    .getCurrentPageShapes()
    .filter((s) => (s as any).type === 'task' || (s as any).type === 'task-group');

  if (existingShapes.length === 0) {
    populateCanvasWithGroups(editor, INITIAL_MOCK_GROUPS);
  }
}

export function loadTasksFromMarkdown(editor: Editor, markdown: string): { taskCount: number; groupCount: number } {
  const parsedGroups = parseTasksMarkdown(markdown);
  if (parsedGroups.length === 0) return { taskCount: 0, groupCount: 0 };
  return populateCanvasWithGroups(editor, parsedGroups);
}
