import React, { useEffect, useState } from 'react';
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
import { CanvasVisualDocument } from '../services/sanityService';
import { scanTaskBlocks, validateMarkdownDocument } from '../utils/markdownSync';

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type TaskShapeProps = {
  w: number;
  h: number;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  taskId?: string;
  blockedBy?: string;
  isDuplicateId?: boolean;
  hasMissingId?: boolean;
  unresolvedBlockers?: string[];
};

export type ITaskShape = TLBaseShape<'task', TaskShapeProps>;

function TaskCardComponent({
  shape,
  editor,
}: {
  shape: ITaskShape;
  editor: Editor;
}) {
  const {
    title,
    completed,
    priority,
    taskId,
    blockedBy,
    isDuplicateId,
    hasMissingId,
    unresolvedBlockers,
    w,
    h,
  } = shape.props;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);

  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  const toggleCompleted = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    editor.updateShape({
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
    editor.updateShape({
      id: shape.id,
      type: 'task',
      props: {
        priority: priorities[nextIndex],
      },
    } as any);
  };

  const commitTitle = () => {
    setIsEditingTitle(false);
    const cleanTitle = editedTitle.trim();
    if (cleanTitle && cleanTitle !== title) {
      editor.updateShape({
        id: shape.id,
        type: 'task',
        props: {
          title: cleanTitle,
        },
      } as any);
    } else {
      setEditedTitle(title);
    }
  };

  const priorityConfig: Record<TaskPriority, { label: string; text: string; bg: string; border: string }> = {
    P0: { label: 'P0 · Critical', text: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-800/60' },
    P1: { label: 'P1 · High', text: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-800/60' },
    P2: { label: 'P2 · Medium', text: 'text-sky-400', bg: 'bg-sky-950/40', border: 'border-sky-800/60' },
    P3: { label: 'P3 · Low', text: 'text-zinc-400', bg: 'bg-zinc-800/40', border: 'border-zinc-700/60' },
  };

  const currentPriority = priorityConfig[priority] || priorityConfig.P1;

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
        className={`w-full h-full rounded-2xl bg-[#161b22] border transition-all duration-150 select-none flex flex-col justify-between p-3.5 shadow-md ${
          isDuplicateId
            ? 'border-rose-600/80 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
            : completed
            ? 'border-[#21262d] bg-[#0e1117]/90 opacity-80'
            : 'border-[#30363d] hover:border-[#8b949e] shadow-black/40'
        }`}
      >
        {/* Top Row: Checkbox + Title / Inline Edit + Priority chip */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {/* M3 Checkbox */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleCompleted}
              aria-label={completed ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada'}
              className="p-1 -m-1 mt-0.5 flex-shrink-0 flex items-center justify-center cursor-pointer rounded-full focus:outline-none"
            >
              <span
                className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                  completed
                    ? 'bg-sky-500 border-sky-400 text-slate-950 shadow-xs'
                    : 'bg-[#21262d] border-[#484f58] hover:border-sky-400'
                }`}
              >
                {completed && (
                  <svg
                    className="w-3 h-3 stroke-current stroke-[3]"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
            </button>

            {isEditingTitle ? (
              <input
                type="text"
                autoFocus
                value={editedTitle}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    commitTitle();
                  } else if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                    setEditedTitle(title);
                  }
                }}
                className="w-full text-[13px] font-medium bg-[#0e1117] border border-sky-500 rounded-lg px-2 py-1 text-slate-100 focus:outline-none -mt-0.5"
              />
            ) : (
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                title="Doble clic o toca el lápiz para editar"
                className="group/title flex items-start gap-1 flex-1 cursor-text"
              >
                <span
                  className={`text-[13px] font-medium leading-snug transition-colors line-clamp-2 ${
                    completed ? 'text-slate-500 line-through' : 'text-slate-100'
                  }`}
                >
                  {title}
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingTitle(true);
                  }}
                  className="opacity-60 sm:opacity-0 group-hover/title:opacity-100 transition-opacity text-slate-400 hover:text-slate-200 p-0.5 shrink-0 cursor-pointer"
                  title="Editar título"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* M3 Discrete Priority Chip */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={cyclePriority}
            title="Clic para cambiar prioridad (P0-P3)"
            className={`min-h-[22px] px-2 py-0.5 text-[11px] font-mono font-medium rounded-full border cursor-pointer shrink-0 transition-all hover:brightness-110 active:scale-95 flex items-center gap-1 ${currentPriority.text} ${currentPriority.bg} ${currentPriority.border}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span>{priority}</span>
          </button>
        </div>

        {/* Bottom Row: Metadata & Actions (DESIGN.md Section 9) */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#30363d]/70 mt-1">
          <div className="flex items-center gap-1.5 truncate max-w-[200px]">
            {taskId ? (
              <span className="text-slate-400 font-mono text-[11px] font-medium truncate tracking-tight flex items-center gap-0.5 bg-[#21262d] px-1.5 py-0.5 rounded-md border border-[#30363d]" title={`ID: ${taskId}`}>
                <span className="text-slate-500">#</span>
                <span>{taskId}</span>
              </span>
            ) : (
              <span className="text-slate-500 font-mono text-[11px] italic">sin-id</span>
            )}

            {isDuplicateId && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-semibold text-rose-300 bg-rose-950/90 border border-rose-800 rounded-md"
                title="ID duplicado en TASKS.md"
              >
                ⚠ Dup
              </span>
            )}

            {hasMissingId && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 bg-amber-950/90 border border-amber-800 rounded-md"
                title="Tarea sin ID explícito en TASKS.md"
              >
                ⚠ Sin ID
              </span>
            )}

            {unresolvedBlockers && unresolvedBlockers.length > 0 && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 bg-amber-950/90 border border-amber-800 rounded-md"
                title={`Dependencia no resuelta: #${unresolvedBlockers.join(', #')}`}
              >
                ⚠ Dep ?
              </span>
            )}

            {blockedBy && !completed && !unresolvedBlockers?.length && (
              <span
                className="px-1.5 py-0.5 text-[10px] font-medium text-rose-300 bg-rose-950/80 border border-rose-800/80 rounded-md flex items-center gap-1"
                title={`Bloqueada por #${blockedBy}`}
              >
                <span>🔒</span>
                <span>#{blockedBy}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent('antask-request-delete-task', {
                    detail: {
                      shapeId: shape.id,
                      taskId: taskId || '',
                      title,
                    },
                  })
                );
              }}
              className="text-slate-500 hover:text-rose-400 p-1 rounded-full cursor-pointer transition-colors active:scale-90"
              title="Eliminar tarea"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>

            <span className="text-[10px] font-mono font-medium text-slate-500 tracking-wider">
              {completed ? 'DONE' : 'TODO'}
            </span>
          </div>
        </div>
      </div>
    </HTMLContainer>
  );
}

export class TaskShapeUtil extends ShapeUtil<any> {
  static override type = 'task' as const;

  static override props: RecordProps<any> = {
    w: T.number,
    h: T.number,
    title: T.string,
    completed: T.boolean,
    priority: T.string,
    taskId: T.string.optional(),
    blockedBy: T.string.optional(),
    isDuplicateId: T.boolean.optional(),
    hasMissingId: T.boolean.optional(),
    unresolvedBlockers: T.arrayOf(T.string).optional(),
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
    return <TaskCardComponent shape={shape} editor={this.editor} />;
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
        <div className="w-full h-full rounded-2xl bg-[#161b22]/70 border border-[#30363d]/80 p-4 flex flex-col justify-between select-none shadow-xs backdrop-blur-xs transition-colors">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#30363d]/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-sky-400 font-mono text-xs font-semibold">##</span>
              <h2 className="text-sm font-semibold text-slate-100 font-sans tracking-tight truncate max-w-[220px]">
                {title}
              </h2>
            </div>
            {count > 0 && (
              <span className="text-[11px] font-mono text-slate-400 bg-[#21262d] px-2 py-0.5 rounded-full border border-[#30363d] tabular-nums">
                {completedCount > 0
                  ? `${completedCount}/${count} completadas`
                  : `${count} ${count === 1 ? 'tarea' : 'tareas'}`}
              </span>
            )}
          </div>

          {/* Guide background area */}
          <div className="flex-1 w-full rounded-xl border border-dashed border-[#30363d]/40 mt-3 bg-[#0e1117]/20" />
        </div>
      </HTMLContainer>
    );
  }
}

export interface ParsedMarkdownTask {
  title: string;
  completed: boolean;
  taskId?: string;
  temporaryId?: string;
  priority: TaskPriority;
  blockedBy?: string;
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
        title: 'Configurar OAuth',
        completed: false,
        priority: 'P0',
        taskId: 'oauth',
      },
      {
        title: 'Persistir sesión',
        completed: false,
        priority: 'P0',
        taskId: 'session',
        blockedBy: 'oauth',
      },
    ],
  },
  {
    title: 'Perfil',
    tasks: [
      {
        title: 'Crear pantalla de perfil',
        completed: false,
        priority: 'P2',
        taskId: 'profile',
      },
      {
        title: 'Añadir avatar',
        completed: true,
        priority: 'P3',
        taskId: 'avatar',
        blockedBy: 'profile',
      },
    ],
  },
];

export function parseTasksMarkdown(markdown: string): ParsedGroup[] {
  const { taskBlocks, groupHeadings } = scanTaskBlocks(markdown);
  const groupsMap = new Map<string, ParsedMarkdownTask[]>();

  // Ensure headings are preserved in order
  groupHeadings.forEach((gh) => {
    groupsMap.set(gh.title, []);
  });

  taskBlocks.forEach((block) => {
    const grp = block.groupTitle || 'General';
    if (!groupsMap.has(grp)) {
      groupsMap.set(grp, []);
    }
    groupsMap.get(grp)!.push({
      title: block.detectedTitle,
      completed: block.rawTaskLine.includes('[x]') || block.rawTaskLine.includes('[X]'),
      taskId: block.detectedId,
      temporaryId: block.temporaryId,
      priority: block.detectedPriority || 'P1',
      blockedBy: block.detectedBlockedBy,
    });
  });

  const parsedGroups: ParsedGroup[] = [];
  groupsMap.forEach((tasks, title) => {
    parsedGroups.push({ title, tasks });
  });

  return parsedGroups;
}

export function populateCanvasWithGroups(
  editor: Editor,
  groups: ParsedGroup[],
  savedVisualState?: CanvasVisualDocument | null,
  rawMarkdown?: string
): { taskCount: number; groupCount: number } {
  // Clear existing task, group, and arrow shapes on canvas
  const existingShapes = editor
    .getCurrentPageShapes()
    .filter(
      (s) =>
        (s as any).type === 'task' ||
        (s as any).type === 'task-group' ||
        (s as any).type === 'arrow'
    );

  if (existingShapes.length > 0) {
    editor.deleteShapes(existingShapes.map((s) => s.id));
  }

  const validationReport = rawMarkdown ? validateMarkdownDocument(rawMarkdown) : null;
  const duplicateIds = validationReport?.duplicateIds || new Set<string>();
  const missingIdTaskIds = validationReport?.missingIdTaskIds || new Set<string>();
  const unresolvedBlockerMap = validationReport?.unresolvedBlockerMap || new Map<string, string[]>();

  const cardWidth = 320;
  const cardHeight = 110;
  const cardGap = 16;
  const groupPaddingX = 20;
  const groupHeaderHeight = 56;
  const groupPaddingTop = 16;
  const groupPaddingBottom = 20;

  const groupWidth = cardWidth + groupPaddingX * 2; // 360px
  const groupSpacingX = groupWidth + 40; // 400px

  const groupShapesToCreate: any[] = [];
  const taskShapesToCreate: any[] = [];
  const arrowShapesToCreate: any[] = [];
  const bindingsToCreate: any[] = [];

  // Map from normalized taskId -> shapeId for dependency resolution
  const taskIdToShapeId = new Map<string, string>();
  const tasksWithDependencies: Array<{
    blockedShapeId: string;
    blockedByStr: string;
  }> = [];

  // Index saved visual state for rapid retrieval
  const savedTaskMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  if (savedVisualState?.tasks) {
    for (const t of savedVisualState.tasks) {
      if (t.taskId) {
        savedTaskMap.set(t.taskId.toLowerCase(), t);
      }
    }
  }

  const savedGroupMap = new Map<string, { x: number; y: number; width: number; height: number; isCollapsed?: boolean }>();
  if (savedVisualState?.groups) {
    for (const g of savedVisualState.groups) {
      if (g.groupTitle) {
        savedGroupMap.set(g.groupTitle.toLowerCase(), g);
      }
    }
  }

  let totalTasks = 0;

  groups.forEach((group, groupIndex) => {
    const taskCount = group.tasks.length;
    totalTasks += taskCount;
    const completedCount = group.tasks.filter((t) => t.completed).length;

    const defaultCalculatedHeight = Math.max(
      180,
      groupHeaderHeight +
        groupPaddingTop +
        taskCount * cardHeight +
        Math.max(0, taskCount - 1) * cardGap +
        groupPaddingBottom
    );

    const defaultGroupX = 80 + groupIndex * groupSpacingX;
    const defaultGroupY = 80;

    const savedGroup = savedGroupMap.get(group.title.toLowerCase());
    const groupX = savedGroup ? savedGroup.x : defaultGroupX;
    const groupY = savedGroup ? savedGroup.y : defaultGroupY;
    const groupW = savedGroup && savedGroup.width ? savedGroup.width : groupWidth;
    const groupH = savedGroup && savedGroup.height ? savedGroup.height : defaultCalculatedHeight;

    // Create Group container shape
    groupShapesToCreate.push({
      id: createShapeId(),
      type: 'task-group' as const,
      x: groupX,
      y: groupY,
      props: {
        w: groupW,
        h: groupH,
        title: group.title,
        count: taskCount,
        completedCount,
      },
    });

    // Create Task shapes
    group.tasks.forEach((task, taskIndex) => {
      const defaultTaskX = groupX + groupPaddingX;
      const defaultTaskY =
        groupY +
        groupHeaderHeight +
        groupPaddingTop +
        taskIndex * (cardHeight + cardGap);

      const shapeId = createShapeId();
      const resolvedTaskId = task.taskId || task.temporaryId || `temp-task-${groupIndex + 1}-${taskIndex + 1}`;
      const normalizedId = resolvedTaskId.toLowerCase();

      // Only associate for arrow bindings if not duplicated collision
      const isDuplicate = task.taskId ? duplicateIds.has(task.taskId.toLowerCase()) : false;
      const isMissingId = !task.taskId || missingIdTaskIds.has(resolvedTaskId);
      const unresolvedBlockers = unresolvedBlockerMap.get(normalizedId);

      if (!isDuplicate) {
        taskIdToShapeId.set(normalizedId, shapeId);
      }

      if (task.blockedBy) {
        tasksWithDependencies.push({
          blockedShapeId: shapeId,
          blockedByStr: task.blockedBy,
        });
      }

      const savedTask = savedTaskMap.get(normalizedId);
      const taskX = savedTask ? savedTask.x : defaultTaskX;
      const taskY = savedTask ? savedTask.y : defaultTaskY;
      const taskW = savedTask && savedTask.width ? savedTask.width : cardWidth;
      const taskH = savedTask && savedTask.height ? savedTask.height : cardHeight;

      taskShapesToCreate.push({
        id: shapeId,
        type: 'task' as const,
        x: taskX,
        y: taskY,
        props: {
          w: taskW,
          h: taskH,
          title: task.title,
          completed: task.completed,
          priority: task.priority || 'P1',
          taskId: task.taskId,
          blockedBy: task.blockedBy,
          isDuplicateId: isDuplicate,
          hasMissingId: isMissingId,
          unresolvedBlockers,
        },
      });
    });
  });

  // Create native arrows from blocker task -> blocked task (ignoring nonexistent/duplicate targets)
  tasksWithDependencies.forEach(({ blockedShapeId, blockedByStr }) => {
    const blockerIds = blockedByStr
      .split(',')
      .map((id) => id.trim().toLowerCase())
      .filter(Boolean);

    blockerIds.forEach((blockerId) => {
      const blockerShapeId = taskIdToShapeId.get(blockerId);
      if (blockerShapeId && blockerShapeId !== blockedShapeId) {
        const arrowId = createShapeId();

        arrowShapesToCreate.push({
          id: arrowId,
          type: 'arrow' as const,
          props: {
            color: 'grey',
            size: 's',
            arrowheadEnd: 'arrow',
            arrowheadStart: 'none',
            bend: 0,
          },
        });

        bindingsToCreate.push(
          {
            fromId: arrowId,
            toId: blockerShapeId,
            type: 'arrow',
            props: {
              terminal: 'start',
              normalizedAnchor: { x: 0.5, y: 1 },
              isExact: false,
              isPrecise: false,
            },
          },
          {
            fromId: arrowId,
            toId: blockedShapeId,
            type: 'arrow',
            props: {
              terminal: 'end',
              normalizedAnchor: { x: 0.5, y: 0 },
              isExact: false,
              isPrecise: false,
            },
          }
        );
      }
    });
  });

  if (groupShapesToCreate.length > 0) {
    (editor.createShapes as any)(groupShapesToCreate);
  }
  if (taskShapesToCreate.length > 0) {
    (editor.createShapes as any)(taskShapesToCreate);
  }
  if (arrowShapesToCreate.length > 0) {
    (editor.createShapes as any)(arrowShapesToCreate);
  }
  if (bindingsToCreate.length > 0) {
    (editor.createBindings as any)(bindingsToCreate);
  }

  editor.zoomToFit({ animation: { duration: 250 } });
  return { taskCount: totalTasks, groupCount: groups.length };
}

export function seedMockTasks(
  editor: Editor,
  savedVisualState?: CanvasVisualDocument | null
) {
  const existingShapes = editor
    .getCurrentPageShapes()
    .filter((s) => (s as any).type === 'task' || (s as any).type === 'task-group');

  if (existingShapes.length === 0) {
    populateCanvasWithGroups(editor, INITIAL_MOCK_GROUPS, savedVisualState);
  }
}

export function loadTasksFromMarkdown(
  editor: Editor,
  markdown: string,
  savedVisualState?: CanvasVisualDocument | null
): { taskCount: number; groupCount: number } {
  const parsedGroups = parseTasksMarkdown(markdown);
  if (parsedGroups.length === 0) return { taskCount: 0, groupCount: 0 };
  return populateCanvasWithGroups(editor, parsedGroups, savedVisualState, markdown);
}
