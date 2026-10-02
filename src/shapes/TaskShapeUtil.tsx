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
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

export type TaskShapeProps = {
  w: number;
  h: number;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  taskId?: string;
  status?: TaskStatus;
  tags?: string[];
  subtasks?: { total: number; completed: number };
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
    status,
    tags,
    subtasks,
    blockedBy,
    isDuplicateId,
    hasMissingId,
    unresolvedBlockers,
    w,
    h,
  } = shape.props;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSelected, setIsSelected] = useState(false);

  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  useEffect(() => {
    let isMounted = true;
    const checkSelection = () => {
      queueMicrotask(() => {
        if (!isMounted) return;
        try {
          const selected = editor.getSelectedShapeIds().includes(shape.id);
          setIsSelected((prev) => (prev !== selected ? selected : prev));
        } catch {
          // ignore
        }
      });
    };
    checkSelection();
    const unsub = editor.store.listen(checkSelection);
    return () => {
      isMounted = false;
      unsub();
    };
  }, [editor, shape.id]);

  const toggleCompleted = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    editor.updateShape({
      id: shape.id,
      type: 'task',
      props: {
        completed: !completed,
        status: !completed ? 'done' : 'todo',
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

  const priorityConfig: Record<TaskPriority, { label: string; dot: string; text: string }> = {
    P0: { label: 'P0 · Critical', dot: 'bg-rose-500', text: 'text-rose-400' },
    P1: { label: 'P1 · High', dot: 'bg-amber-500', text: 'text-amber-400' },
    P2: { label: 'P2 · Medium', dot: 'bg-blue-500', text: 'text-blue-400' },
    P3: { label: 'P3 · Low', dot: 'bg-zinc-500', text: 'text-zinc-400' },
  };

  const currentPriority = priorityConfig[priority] || priorityConfig.P1;

  const statusConfig: Record<string, { label: string; text: string }> = {
    backlog: { label: 'Backlog', text: 'text-slate-400' },
    todo: { label: 'Todo', text: 'text-amber-400' },
    in_progress: { label: 'In Progress', text: 'text-blue-400' },
    review: { label: 'Review', text: 'text-purple-400' },
    done: { label: 'Done', text: 'text-emerald-400' },
    blocked: { label: 'Blocked', text: 'text-rose-400' },
  };

  const normalizedStatus = completed ? 'done' : status || 'todo';
  const currentStatus = statusConfig[normalizedStatus] || statusConfig.todo;

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
        className={`w-full h-full rounded-md bg-[var(--surface-container)] border transition-colors duration-120 select-none flex flex-col justify-between p-2.5 relative ${
          isSelected
            ? 'border-[var(--primary)] ring-1 ring-[var(--primary)] bg-[var(--surface-container-high)]'
            : isDuplicateId
            ? 'border-rose-600/80 bg-rose-950/20'
            : completed
            ? 'border-[var(--outline)] bg-[var(--surface)] opacity-75'
            : 'border-[var(--outline)] hover:border-[var(--on-surface-variant)]'
        }`}
      >
        {/* Top Row: Checkbox + Title / Inline Edit + Context Menu + Priority */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Checkbox */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleCompleted}
              aria-label={completed ? 'Marcar tarea como pendiente' : 'Marcar tarea como completada'}
              className="mt-0.5 flex-shrink-0 flex items-center justify-center cursor-pointer focus:outline-none"
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                  completed
                    ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--on-primary)]'
                    : 'bg-[var(--surface-container-high)] border-[var(--outline)] hover:border-[var(--primary)]'
                }`}
              >
                {completed && (
                  <svg
                    className="w-2.5 h-2.5 stroke-current stroke-[3]"
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
                className="w-full text-xs font-medium bg-[var(--surface)] border border-[var(--primary)] rounded px-1.5 py-0.5 text-[var(--on-surface)] focus:outline-none -mt-0.5"
              />
            ) : (
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                title="Doble clic para editar título"
                className="group/title flex items-start gap-1 flex-1 cursor-text min-w-0"
              >
                <span
                  className={`text-xs font-medium leading-snug transition-colors line-clamp-2 ${
                    completed ? 'text-[var(--on-surface-variant)] line-through' : 'text-[var(--on-surface)]'
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
                  className="opacity-0 group-hover/title:opacity-100 transition-opacity text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] p-0.5 shrink-0 cursor-pointer"
                  title="Editar título"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Discreet Priority Indicator */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={cyclePriority}
              title="Clic para cambiar prioridad (P0-P3)"
              className={`px-1.5 py-0.5 text-[11px] font-mono font-medium rounded border border-[var(--outline)] bg-[var(--surface)] hover:border-[var(--on-surface-variant)] cursor-pointer shrink-0 transition-colors flex items-center gap-1 ${currentPriority.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${currentPriority.dot}`} />
              <span>{priority}</span>
            </button>

            {/* Contextual Action Menu Trigger ⋮ */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="w-5 h-5 flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] rounded hover:bg-[var(--surface-container-high)] cursor-pointer"
              title="Más acciones"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Popover Contextual Menu */}
        {isMenuOpen && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-8 right-2 z-50 bg-[var(--surface-container)] border border-[var(--outline)] rounded-md shadow-lg p-1 flex flex-col gap-0.5 min-w-[150px] text-xs font-sans"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                toggleCompleted(e);
              }}
              className="px-2 py-1 rounded text-left text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-2 cursor-pointer"
            >
              <span>{completed ? '↺ Marcar pendiente' : '✓ Marcar completada'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                cyclePriority(e);
              }}
              className="px-2 py-1 rounded text-left text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-2 cursor-pointer"
            >
              <span>⚡ Cambiar prioridad</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                editor.setSelectedShapes([shape.id]);
              }}
              className="px-2 py-1 rounded text-left text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-2 cursor-pointer"
            >
              <span>🔍 Ver detalles</span>
            </button>

            <div className="h-px bg-[var(--outline)] my-0.5" />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
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
              className="px-2 py-1 rounded text-left text-[var(--error)] hover:bg-[var(--surface-container-high)] flex items-center gap-2 cursor-pointer"
            >
              <span>🗑 Eliminar</span>
            </button>
          </div>
        )}

        {/* Middle Row: Unboxed Tags & Subtask progress */}
        {(tags?.length || subtasks) && (
          <div className="flex items-center gap-1.5 flex-wrap py-0.5 text-[10px] text-[var(--on-surface-variant)]">
            {tags?.slice(0, 3).map((t) => (
              <span key={t} className="font-mono text-[var(--on-surface-variant)]">
                #{t}
              </span>
            ))}
            {tags && tags.length > 3 && (
              <span className="font-mono text-[var(--on-surface-variant)]">
                +{tags.length - 3}
              </span>
            )}
            {subtasks && (
              <span className="font-mono text-[var(--on-surface-variant)] flex items-center gap-0.5">
                <span>✓</span>
                <span>{subtasks.completed}/{subtasks.total}</span>
              </span>
            )}
          </div>
        )}

        {/* Bottom Row: Metadata & Status */}
        <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)] pt-1.5 border-t border-[var(--outline)] mt-0.5">
          <div className="flex items-center gap-1.5 truncate max-w-[200px]">
            {taskId ? (
              <span className="text-[var(--on-surface-variant)] font-mono text-[11px] truncate tracking-tight" title={`ID: ${taskId}`}>
                #{taskId}
              </span>
            ) : (
              <span className="text-[var(--on-surface-variant)] font-mono text-[11px] italic">sin-id</span>
            )}

            {isDuplicateId && (
              <span
                className="px-1 py-0.2 text-[10px] font-semibold text-rose-400 border border-rose-800/80 rounded"
                title="ID duplicado en TASKS.md"
              >
                dup
              </span>
            )}

            {hasMissingId && (
              <span
                className="px-1 py-0.2 text-[10px] font-semibold text-amber-400 border border-amber-800/80 rounded"
                title="Tarea sin ID explícito en TASKS.md"
              >
                sin-id
              </span>
            )}

            {unresolvedBlockers && unresolvedBlockers.length > 0 && (
              <span
                className="px-1 py-0.2 text-[10px] font-semibold text-amber-400 border border-amber-800/80 rounded"
                title={`Dependencia no resuelta: #${unresolvedBlockers.join(', #')}`}
              >
                dep?
              </span>
            )}

            {blockedBy && !completed && !unresolvedBlockers?.length && (
              <span
                className="text-[10px] font-mono text-amber-400 flex items-center gap-0.5"
                title={`Bloqueada por #${blockedBy}`}
              >
                <span>🔒</span>
                <span>#{blockedBy}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className={`text-[10px] font-mono uppercase tracking-wider ${currentStatus.text}`}>
              {currentStatus.label}
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
    status: T.string.optional(),
    tags: T.arrayOf(T.string).optional(),
    subtasks: T.object({ total: T.number, completed: T.number }).optional(),
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
        path.roundRect(0, 0, shape.props.w, shape.props.h, 5);
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
        path.roundRect(0, 0, shape.props.w, shape.props.h, 6);
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
        <div className="w-full h-full rounded-md bg-[var(--surface-container)]/30 border border-[var(--outline)] p-3 flex flex-col justify-start select-none transition-colors">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--outline)] pb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--on-surface-variant)] font-mono text-xs font-semibold">##</span>
              <h2 className="text-xs font-semibold text-[var(--on-surface)] font-sans tracking-tight truncate max-w-[220px]">
                {title}
              </h2>
            </div>
            {count > 0 && (
              <span className="text-[11px] font-mono text-[var(--on-surface-variant)] tabular-nums">
                {completedCount > 0
                  ? `${completedCount}/${count} completadas`
                  : `${count} ${count === 1 ? 'tarea' : 'tareas'}`}
              </span>
            )}
          </div>
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
  status?: TaskStatus;
  tags?: string[];
  subtasks?: { total: number; completed: number };
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
        status: 'todo',
        taskId: 'oauth',
      },
      {
        title: 'Persistir sesión',
        completed: false,
        priority: 'P0',
        status: 'todo',
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
        status: 'todo',
        taskId: 'profile',
      },
      {
        title: 'Añadir avatar',
        completed: true,
        priority: 'P3',
        status: 'done',
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
    const isCompleted = block.rawTaskLine.includes('[x]') || block.rawTaskLine.includes('[X]');
    groupsMap.get(grp)!.push({
      title: block.detectedTitle,
      completed: isCompleted,
      taskId: block.detectedId,
      temporaryId: block.temporaryId,
      priority: block.detectedPriority || 'P1',
      status: (block.detectedStatus as any) || (isCompleted ? 'done' : 'todo'),
      tags: block.detectedTags,
      subtasks: block.detectedSubtasks,
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
          status: task.status,
          tags: task.tags,
          subtasks: task.subtasks,
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
