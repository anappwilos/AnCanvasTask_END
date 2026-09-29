import React, { useState, useMemo } from 'react';
import { TaskPriority, TaskStatus } from '../shapes/TaskShapeUtil';
import { scanTaskBlocks, TaskBlockInfo } from '../utils/markdownSync';
import { TaskFilterState } from './FilterBar';
import { SkeletonKanbanColumn } from './Skeletons';

export interface KanbanTask {
  taskId: string;
  temporaryId?: string;
  title: string;
  completed: boolean;
  priority: TaskPriority;
  status: TaskStatus;
  groupTitle: string;
  tags?: string[];
  subtasks?: { total: number; completed: number };
  blockedBy?: string;
  isDuplicateId?: boolean;
  hasMissingId?: boolean;
  unresolvedBlockers?: string[];
}

export interface KanbanBoardProps {
  markdown: string;
  onUpdateTask: (
    taskId: string,
    updates: {
      title?: string;
      completed?: boolean;
      priority?: TaskPriority;
      status?: TaskStatus;
      groupTitle?: string;
    }
  ) => void;
  onBatchUpdateTasks?: (
    taskIds: string[],
    updates: {
      completed?: boolean;
      priority?: TaskPriority;
      status?: TaskStatus;
    }
  ) => void;
  onDeleteTask: (taskId: string, title: string) => void;
  onBatchDeleteTasks?: (taskIds: string[]) => void;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  onOpenNewTaskModalWithGroup?: (groupOrStatus: string) => void;
  onOpenSampleProject?: () => void;
  searchQuery?: string;
  activeFilter?: 'all' | 'todo' | 'done' | 'critical' | 'blocked';
  filters?: TaskFilterState;
  onResetFilters?: () => void;
  isLoading?: boolean;
}

type GroupByMode = 'status' | 'section';

interface StatusColumnConfig {
  id: TaskStatus;
  label: string;
  icon: string;
  colorClass: string;
  badgeBg: string;
}

const STATUS_COLUMNS: StatusColumnConfig[] = [
  { id: 'backlog', label: 'Backlog', icon: 'inventory_2', colorClass: 'text-zinc-400', badgeBg: 'bg-zinc-800/60 text-zinc-300' },
  { id: 'todo', label: 'Todo', icon: 'pending_actions', colorClass: 'text-amber-400', badgeBg: 'bg-amber-950/40 text-amber-300 border-amber-800/40' },
  { id: 'in_progress', label: 'In Progress', icon: 'play_circle', colorClass: 'text-sky-400', badgeBg: 'bg-sky-950/40 text-sky-300 border-sky-800/40' },
  { id: 'review', label: 'Review', icon: 'rate_review', colorClass: 'text-purple-400', badgeBg: 'bg-purple-950/40 text-purple-300 border-purple-800/40' },
  { id: 'done', label: 'Done', icon: 'check_circle', colorClass: 'text-emerald-400', badgeBg: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40' },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; text: string; bg: string; border: string }> = {
  P0: { label: 'P0 · Critical', text: 'text-rose-400', bg: 'bg-rose-950/40', border: 'border-rose-800/60' },
  P1: { label: 'P1 · High', text: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-800/60' },
  P2: { label: 'P2 · Medium', text: 'text-sky-400', bg: 'bg-sky-950/40', border: 'border-sky-800/60' },
  P3: { label: 'P3 · Low', text: 'text-zinc-400', bg: 'bg-zinc-800/40', border: 'border-zinc-700/60' },
};

export function KanbanBoard({
  markdown,
  onUpdateTask,
  onBatchUpdateTasks,
  onDeleteTask,
  onBatchDeleteTasks,
  onSelectTask,
  selectedTaskId,
  onOpenNewTaskModalWithGroup,
  onOpenSampleProject,
  searchQuery = '',
  activeFilter = 'all',
  filters,
  onResetFilters,
  isLoading = false,
}: KanbanBoardProps) {
  const [groupBy, setGroupBy] = useState<GroupByMode>('status');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState<string>('');
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);

  // Parse tasks from markdown
  const { allTasks, sections } = useMemo(() => {
    const { taskBlocks, groupHeadings } = scanTaskBlocks(markdown);
    const secList = groupHeadings.map((g) => g.title);
    if (secList.length === 0) secList.push('General');

    const tasks: KanbanTask[] = taskBlocks.map((b) => {
      const isCompleted = b.rawTaskLine.includes('[x]') || b.rawTaskLine.includes('[X]');
      let status: TaskStatus = 'todo';

      if (isCompleted) {
        status = 'done';
      } else if (b.detectedStatus) {
        const s = b.detectedStatus.toLowerCase();
        if (s === 'backlog') status = 'backlog';
        else if (s === 'in_progress' || s === 'in progress' || s === 'progress') status = 'in_progress';
        else if (s === 'review') status = 'review';
        else if (s === 'blocked') status = 'blocked';
        else if (s === 'done') status = 'done';
        else status = 'todo';
      } else if (b.detectedBlockedBy) {
        status = 'todo';
      }

      return {
        taskId: b.detectedId || b.temporaryId,
        temporaryId: b.temporaryId,
        title: b.detectedTitle,
        completed: isCompleted,
        priority: b.detectedPriority || 'P1',
        status,
        groupTitle: b.groupTitle || 'General',
        tags: b.detectedTags,
        subtasks: b.detectedSubtasks,
        blockedBy: b.detectedBlockedBy,
      };
    });

    return { allTasks: tasks, sections: secList };
  }, [markdown]);

  // Filter & Sort tasks according to search, filters & sort state
  const filteredTasks = useMemo(() => {
    let result = allTasks.filter((t) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesId = t.taskId.toLowerCase().includes(q);
        const matchesGroup = t.groupTitle.toLowerCase().includes(q);
        const matchesTags = t.tags?.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesId && !matchesGroup && !matchesTags) return false;
      }

      // 2. Comprehensive Filters
      if (filters) {
        if (filters.status !== 'all') {
          if (filters.status === 'done' && !t.completed) return false;
          if (filters.status !== 'done' && (t.completed || t.status !== filters.status)) return false;
        }
        if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
        if (filters.section !== 'all' && t.groupTitle.toLowerCase() !== filters.section.toLowerCase()) return false;
        if (filters.tag !== 'all' && (!t.tags || !t.tags.some((tag) => tag.toLowerCase() === filters.tag.toLowerCase()))) return false;
        if (filters.onlyBlocked && (!t.blockedBy || t.completed)) return false;
      } else {
        // Fallback to activeFilter
        if (activeFilter === 'todo' && t.completed) return false;
        if (activeFilter === 'done' && !t.completed) return false;
        if (activeFilter === 'critical' && t.priority !== 'P0') return false;
        if (activeFilter === 'blocked' && (!t.blockedBy || t.completed)) return false;
      }

      return true;
    });

    // 3. Sorting
    const sortBy = filters?.sortBy || 'default';
    if (sortBy === 'priority') {
      const pOrder: Record<TaskPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
      result = [...result].sort((a, b) => pOrder[a.priority] - pOrder[b.priority]);
    } else if (sortBy === 'status') {
      const sOrder: Record<TaskStatus, number> = {
        backlog: 0,
        todo: 1,
        in_progress: 2,
        review: 3,
        blocked: 4,
        done: 5,
      };
      result = [...result].sort((a, b) => (sOrder[a.status] ?? 99) - (sOrder[b.status] ?? 99));
    } else if (sortBy === 'title') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [allTasks, searchQuery, activeFilter, filters]);

  // Multi-selection handlers
  const toggleSelectTask = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    if (groupBy === 'status') {
      const targetStatus = targetColumnId as TaskStatus;
      const isDone = targetStatus === 'done';
      onUpdateTask(taskId, {
        status: targetStatus,
        completed: isDone,
      });
    } else {
      // Group by section
      onUpdateTask(taskId, {
        groupTitle: targetColumnId,
      });
    }

    setDraggedTaskId(null);
  };

  // Batch actions
  const handleBatchSetCompleted = (completed: boolean) => {
    const ids = Array.from(selectedTaskIds);
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(ids, {
        completed,
        status: completed ? 'done' : 'todo',
      });
    } else {
      ids.forEach((id) =>
        onUpdateTask(id, { completed, status: completed ? 'done' : 'todo' })
      );
    }
    clearSelection();
  };

  const handleBatchSetPriority = (priority: TaskPriority) => {
    const ids = Array.from(selectedTaskIds);
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(ids, { priority });
    } else {
      ids.forEach((id) => onUpdateTask(id, { priority }));
    }
  };

  const handleBatchSetStatus = (status: TaskStatus) => {
    const ids = Array.from(selectedTaskIds);
    const isDone = status === 'done';
    if (onBatchUpdateTasks) {
      onBatchUpdateTasks(ids, { status, completed: isDone });
    } else {
      ids.forEach((id) => onUpdateTask(id, { status, completed: isDone }));
    }
    clearSelection();
  };

  const handleBatchDelete = () => {
    const ids = Array.from(selectedTaskIds);
    if (onBatchDeleteTasks) {
      onBatchDeleteTasks(ids);
    } else {
      ids.forEach((id) => {
        const t = allTasks.find((item) => item.taskId === id);
        onDeleteTask(id, t?.title || id);
      });
    }
    clearSelection();
  };

  const commitTitleEdit = (taskId: string) => {
    const clean = editingTitleText.trim();
    if (clean) {
      onUpdateTask(taskId, { title: clean });
    }
    setEditingTaskId(null);
  };

  const cyclePriority = (taskId: string, currentP: TaskPriority, e: React.MouseEvent) => {
    e.stopPropagation();
    const list: TaskPriority[] = ['P0', 'P1', 'P2', 'P3'];
    const nextIdx = (list.indexOf(currentP) + 1) % list.length;
    onUpdateTask(taskId, { priority: list[nextIdx] });
  };

  return (
    <div
      className="flex-1 w-full h-full flex flex-col overflow-hidden bg-[var(--surface)] select-none relative"
      onClick={() => {
        setActiveMenuTaskId(null);
      }}
    >
      {/* Kanban Sub-Header: Group Switcher & Stats */}
      <div className="h-11 px-4 border-b border-[var(--outline)] bg-[var(--surface-container)] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider hidden sm:inline">
            Organizar por:
          </span>
          <div className="flex items-center bg-[var(--surface)] p-0.5 rounded-full border border-[var(--outline)]">
            <button
              type="button"
              onClick={() => setGroupBy('status')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                groupBy === 'status'
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-xs'
                  : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              }`}
            >
              Estados
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('section')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                groupBy === 'section'
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-xs'
                  : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              }`}
            >
              Secciones
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--on-surface-variant)] font-mono">
          <span className="hidden sm:inline">
            Mostrando <strong>{filteredTasks.length}</strong> de {allTasks.length} tareas
          </span>
          {selectedTaskIds.size > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] font-semibold border border-[var(--primary)]/30">
              {selectedTaskIds.size} seleccionada{selectedTaskIds.size > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Columns Container with horizontal scroll or Empty States */}
      {isLoading ? (
        <div className="flex-1 w-full overflow-x-auto overflow-y-hidden p-3 sm:p-4 flex gap-4 items-stretch">
          <SkeletonKanbanColumn title="Backlog" />
          <SkeletonKanbanColumn title="Todo" />
          <SkeletonKanbanColumn title="In Progress" />
          <SkeletonKanbanColumn title="Review" />
          <SkeletonKanbanColumn title="Done" />
        </div>
      ) : allTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-3xl bg-[var(--surface-container)] border border-[var(--outline)] flex items-center justify-center text-[var(--on-surface-variant)] mb-4 shadow-sm">
            <span className="material-symbols-outlined text-[32px] text-sky-400">inventory_2</span>
          </div>
          <h3 className="text-base font-semibold text-[var(--on-surface)] font-sans mb-1">
            No hay tareas en el archivo TASKS.md
          </h3>
          <p className="text-xs text-[var(--on-surface-variant)] max-w-sm mb-6 leading-relaxed">
            Comienza creando tu primera tarea o carga un proyecto de ejemplo para explorar el flujo de trabajo en Canvas y Kanban.
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => onOpenNewTaskModalWithGroup?.('General')}
              className="btn-m3-primary px-4 py-2 text-xs cursor-pointer shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Crear primera tarea</span>
            </button>
            {onOpenSampleProject && (
              <button
                type="button"
                onClick={onOpenSampleProject}
                className="btn-m3-secondary px-4 py-2 text-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>Cargar ejemplo inicial</span>
              </button>
            )}
          </div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-container)] border border-[var(--outline)] flex items-center justify-center text-[var(--on-surface-variant)] mb-3 shadow-xs">
            <span className="material-symbols-outlined text-[28px] text-amber-400">filter_alt_off</span>
          </div>
          <h3 className="text-sm font-semibold text-[var(--on-surface)] font-sans mb-1">
            No hay tareas que coincidan con los filtros activos
          </h3>
          <p className="text-xs text-[var(--on-surface-variant)] max-w-xs mb-4">
            Prueba a cambiar el término de búsqueda o limpia los filtros para ver todas las {allTasks.length} tareas.
          </p>
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="btn-m3-secondary px-4 py-1.5 text-xs cursor-pointer text-[var(--primary)] border-[var(--primary)]/40 hover:bg-[var(--primary-container)]/20"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 w-full overflow-x-auto overflow-y-hidden p-3 sm:p-4 flex gap-4 items-stretch">
        {groupBy === 'status'
          ? STATUS_COLUMNS.map((col) => {
              const tasksInCol = filteredTasks.filter((t) => {
                if (col.id === 'done') return t.completed;
                if (col.id === 'todo') return !t.completed && (t.status === 'todo' || !t.status);
                return !t.completed && t.status === col.id;
              });

              const isDropTarget = dragOverColumn === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`w-72 sm:w-80 shrink-0 flex flex-col rounded-2xl bg-[var(--surface-container)] border transition-all duration-150 ${
                    isDropTarget
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-md'
                      : 'border-[var(--outline)]'
                  }`}
                >
                  {/* Column Header */}
                  <div className="px-3.5 py-3 border-b border-[var(--outline)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`material-symbols-outlined text-[18px] ${col.colorClass}`}>
                        {col.icon}
                      </span>
                      <h2 className="text-xs font-semibold text-[var(--on-surface)] font-sans truncate">
                        {col.label}
                      </h2>
                      <span
                        className={`text-[11px] font-mono font-medium px-2 py-0.2 rounded-full border border-transparent ${col.badgeBg}`}
                      >
                        {tasksInCol.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenNewTaskModalWithGroup?.(col.label)}
                      className="btn-m3-icon w-7 h-7 cursor-pointer hover:text-[var(--primary)]"
                      title={`Añadir tarea a ${col.label}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                  </div>

                  {/* Column Content / Tasks List */}
                  <div className="flex-1 p-2.5 overflow-y-auto flex flex-col gap-2.5">
                    {tasksInCol.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[var(--outline)] rounded-xl text-[var(--on-surface-variant)] gap-2">
                        <span className="text-xs font-sans">No hay tareas</span>
                        <button
                          type="button"
                          onClick={() => onOpenNewTaskModalWithGroup?.(col.label)}
                          className="text-[11px] font-medium text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          <span>Añadir tarea</span>
                        </button>
                      </div>
                    ) : (
                      tasksInCol.map((task) => {
                        const isSelected =
                          selectedTaskId === task.taskId || selectedTaskIds.has(task.taskId);
                        const isDragging = draggedTaskId === task.taskId;
                        const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.P1;

                        return (
                          <div
                            key={task.taskId}
                            draggable
                            tabIndex={0}
                            role="button"
                            aria-label={`Tarea ${task.title}, prioridad ${task.priority}, estado ${task.status}`}
                            onDragStart={(e) => handleDragStart(e, task.taskId)}
                            onClick={() => onSelectTask(task.taskId)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                if (e.target === e.currentTarget) {
                                  e.preventDefault();
                                  onSelectTask(task.taskId);
                                }
                              }
                            }}
                            className={`rounded-xl bg-[var(--surface)] border p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing transition-all duration-150 relative select-none shadow-xs group hover:border-[var(--on-surface-variant)] ${
                              isSelected
                                ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30 bg-[var(--surface-container-high)]'
                                : 'border-[var(--outline)]'
                            } ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${
                              task.completed ? 'opacity-70 bg-[var(--surface)]/80' : ''
                            }`}
                          >
                            {/* Card Top: Checkbox + Title / Edit + Priority Chip + Context Menu */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                {/* M3 Checkbox */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextCompleted = !task.completed;
                                    onUpdateTask(task.taskId, {
                                      completed: nextCompleted,
                                      status: nextCompleted ? 'done' : 'todo',
                                    });
                                  }}
                                  aria-label={task.completed ? 'Marcar pendiente' : 'Marcar completada'}
                                  className="p-1 -m-1 mt-0.5 flex-shrink-0 cursor-pointer rounded-full"
                                >
                                  <span
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                      task.completed
                                        ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--on-primary)]'
                                        : 'bg-[var(--surface-container)] border-[var(--outline)] hover:border-[var(--primary)]'
                                    }`}
                                  >
                                    {task.completed && (
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

                                {/* Title with inline edit */}
                                {editingTaskId === task.taskId ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={editingTitleText}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setEditingTitleText(e.target.value)}
                                    onBlur={() => commitTitleEdit(task.taskId)}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === 'Enter') commitTitleEdit(task.taskId);
                                      if (e.key === 'Escape') setEditingTaskId(null);
                                    }}
                                    className="w-full text-xs font-medium bg-[var(--surface-container)] border border-[var(--primary)] rounded-lg px-2 py-0.5 text-[var(--on-surface)] focus:outline-none -mt-0.5"
                                  />
                                ) : (
                                  <div
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingTaskId(task.taskId);
                                      setEditingTitleText(task.title);
                                    }}
                                    className="flex items-start gap-1 flex-1 min-w-0"
                                  >
                                    <span
                                      className={`text-xs font-medium leading-snug break-words ${
                                        task.completed
                                          ? 'line-through text-[var(--on-surface-variant)]'
                                          : 'text-[var(--on-surface)]'
                                      }`}
                                    >
                                      {task.title}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Priority Chip & Menu Trigger */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => cyclePriority(task.taskId, task.priority, e)}
                                  title="Clic para cambiar prioridad"
                                  className={`px-1.5 py-0.2 rounded-full border text-[10px] font-mono font-medium flex items-center gap-1 cursor-pointer transition-all hover:brightness-110 ${prio.text} ${prio.bg} ${prio.border}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  <span>{task.priority}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuTaskId(activeMenuTaskId === task.taskId ? null : task.taskId);
                                  }}
                                  className="btn-m3-icon w-6 h-6 p-0 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
                                  title="Más opciones"
                                >
                                  <span className="material-symbols-outlined text-[16px]">more_vert</span>
                                </button>
                              </div>
                            </div>

                            {/* Contextual Popover Menu */}
                            {activeMenuTaskId === task.taskId && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-10 right-2 z-30 bg-[var(--surface-container)] border border-[var(--outline)] rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 min-w-[150px] text-xs font-sans animate-slide-up"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuTaskId(null);
                                    setEditingTaskId(task.taskId);
                                    setEditingTitleText(task.title);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-left text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">edit</span>
                                  <span>Editar título</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuTaskId(null);
                                    toggleSelectTask(task.taskId, e);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-left text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">check_box</span>
                                  <span>{selectedTaskIds.has(task.taskId) ? 'Deseleccionar' : 'Seleccionar'}</span>
                                </button>

                                <div className="h-px bg-[var(--outline)] my-0.5" />

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuTaskId(null);
                                    onDeleteTask(task.taskId, task.title);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg text-left text-[var(--error)] hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[15px]">delete</span>
                                  <span>Eliminar tarea</span>
                                </button>
                              </div>
                            )}

                            {/* Middle Row: Tags & Subtasks */}
                            {(task.tags?.length || task.subtasks) && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {task.tags?.slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="px-1.5 py-0.2 rounded-md bg-[var(--surface-container-high)] border border-[var(--outline)] text-[10px] text-[var(--on-surface-variant)] font-sans"
                                  >
                                    #{t}
                                  </span>
                                ))}
                                {task.tags && task.tags.length > 2 && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-[var(--surface-container-high)] text-[10px] font-mono text-[var(--on-surface-variant)]">
                                    +{task.tags.length - 2}
                                  </span>
                                )}
                                {task.subtasks && (
                                  <span className="px-1.5 py-0.2 rounded-md bg-sky-950/40 border border-sky-800/60 text-[10px] font-mono text-sky-300 flex items-center gap-1">
                                    <span>✓</span>
                                    <span>{task.subtasks.completed}/{task.subtasks.total}</span>
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Bottom Row: #ID & Section / Blockers */}
                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[var(--outline)] mt-0.5">
                              <div className="flex items-center gap-1.5 truncate max-w-[160px]">
                                <span className="font-mono text-[11px] font-medium text-[var(--on-surface-variant)] bg-[var(--surface-container)] px-1.5 py-0.2 rounded-md border border-[var(--outline)]">
                                  #{task.taskId}
                                </span>
                                {task.blockedBy && !task.completed && (
                                  <span
                                    className="px-1.5 py-0.2 text-[10px] font-medium text-amber-300 bg-amber-950/80 border border-amber-800/80 rounded-md flex items-center gap-0.5"
                                    title={`Bloqueada por #${task.blockedBy}`}
                                  >
                                    <span>🔒</span>
                                    <span>#{task.blockedBy}</span>
                                  </span>
                                )}
                              </div>

                              <span className="text-[10px] font-mono text-[var(--on-surface-variant)] truncate max-w-[90px]">
                                {task.groupTitle}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          : sections.map((sec) => {
              const tasksInSec = filteredTasks.filter(
                (t) => t.groupTitle.toLowerCase() === sec.toLowerCase()
              );
              const isDropTarget = dragOverColumn === sec;

              return (
                <div
                  key={sec}
                  onDragOver={(e) => handleDragOver(e, sec)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, sec)}
                  className={`w-72 sm:w-80 shrink-0 flex flex-col rounded-2xl bg-[var(--surface-container)] border transition-all duration-150 ${
                    isDropTarget
                      ? 'border-[var(--primary)] bg-[var(--primary)]/5 shadow-md'
                      : 'border-[var(--outline)]'
                  }`}
                >
                  {/* Column Header */}
                  <div className="px-3.5 py-3 border-b border-[var(--outline)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[var(--primary)] font-mono text-xs font-bold">##</span>
                      <h2 className="text-xs font-semibold text-[var(--on-surface)] font-sans truncate">
                        {sec}
                      </h2>
                      <span className="text-[11px] font-mono text-[var(--on-surface-variant)] bg-[var(--surface)] px-2 py-0.2 rounded-full border border-[var(--outline)]">
                        {tasksInSec.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenNewTaskModalWithGroup?.(sec)}
                      className="btn-m3-icon w-7 h-7 cursor-pointer hover:text-[var(--primary)]"
                      title={`Añadir tarea a ${sec}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 p-2.5 overflow-y-auto flex flex-col gap-2.5">
                    {tasksInSec.length === 0 ? (
                      <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[var(--outline)] rounded-xl text-[var(--on-surface-variant)] gap-2">
                        <span className="text-xs font-sans">No hay tareas en esta sección</span>
                        <button
                          type="button"
                          onClick={() => onOpenNewTaskModalWithGroup?.(sec)}
                          className="text-[11px] font-medium text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          <span>Añadir tarea</span>
                        </button>
                      </div>
                    ) : (
                      tasksInSec.map((task) => {
                        const isSelected =
                          selectedTaskId === task.taskId || selectedTaskIds.has(task.taskId);
                        const isDragging = draggedTaskId === task.taskId;
                        const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.P1;

                        return (
                          <div
                            key={task.taskId}
                            draggable
                            tabIndex={0}
                            role="button"
                            aria-label={`Tarea ${task.title}, sección ${sec}, prioridad ${task.priority}`}
                            onDragStart={(e) => handleDragStart(e, task.taskId)}
                            onClick={() => onSelectTask(task.taskId)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                if (e.target === e.currentTarget) {
                                  e.preventDefault();
                                  onSelectTask(task.taskId);
                                }
                              }
                            }}
                            className={`rounded-xl bg-[var(--surface)] border p-3 flex flex-col gap-2 cursor-grab active:cursor-grabbing transition-all duration-150 relative select-none shadow-xs group hover:border-[var(--on-surface-variant)] ${
                              isSelected
                                ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30 bg-[var(--surface-container-high)]'
                                : 'border-[var(--outline)]'
                            } ${isDragging ? 'opacity-40 scale-95' : 'opacity-100'} ${
                              task.completed ? 'opacity-70 bg-[var(--surface)]/80' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextCompleted = !task.completed;
                                    onUpdateTask(task.taskId, {
                                      completed: nextCompleted,
                                      status: nextCompleted ? 'done' : 'todo',
                                    });
                                  }}
                                  className="p-1 -m-1 mt-0.5 flex-shrink-0 cursor-pointer rounded-full"
                                >
                                  <span
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                      task.completed
                                        ? 'bg-[var(--primary)] border-[var(--primary)] text-[var(--on-primary)]'
                                        : 'bg-[var(--surface-container)] border-[var(--outline)] hover:border-[var(--primary)]'
                                    }`}
                                  >
                                    {task.completed && (
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

                                <span
                                  className={`text-xs font-medium leading-snug break-words ${
                                    task.completed
                                      ? 'line-through text-[var(--on-surface-variant)]'
                                      : 'text-[var(--on-surface)]'
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => cyclePriority(task.taskId, task.priority, e)}
                                className={`px-1.5 py-0.2 rounded-full border text-[10px] font-mono font-medium flex items-center gap-1 cursor-pointer shrink-0 transition-all hover:brightness-110 ${prio.text} ${prio.bg} ${prio.border}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                <span>{task.priority}</span>
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[var(--outline)] mt-0.5">
                              <span className="font-mono text-[11px] text-[var(--on-surface-variant)] bg-[var(--surface-container)] px-1.5 py-0.2 rounded-md border border-[var(--outline)]">
                                #{task.taskId}
                              </span>
                              <span className="text-[10px] font-mono text-[var(--on-surface-variant)] uppercase">
                                {task.completed ? 'DONE' : task.status}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Floating Multi-Selection Contextual Toolbar (DESIGN.md Section 9 & 13) */}
      {selectedTaskIds.size > 0 && (
        <div className="fixed bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--surface-container-high)]/95 backdrop-blur-md border border-[var(--outline)] rounded-full px-4 py-2 shadow-2xl flex items-center gap-2 sm:gap-3 text-xs animate-slide-up max-w-[95vw] overflow-x-auto">
          <div className="flex items-center gap-1.5 pr-2 border-r border-[var(--outline)]">
            <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span className="font-semibold text-[var(--on-surface)] whitespace-nowrap">
              {selectedTaskIds.size} seleccionada{selectedTaskIds.size > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleBatchSetCompleted(true)}
              className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer text-emerald-400"
              title="Marcar todas como completadas"
            >
              <span className="material-symbols-outlined text-[15px]">check_circle</span>
              <span className="hidden sm:inline">Completar</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchSetCompleted(false)}
              className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer text-amber-400"
              title="Marcar todas como pendientes"
            >
              <span className="material-symbols-outlined text-[15px]">pending</span>
              <span className="hidden sm:inline">Pendiente</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchSetPriority('P0')}
              className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer text-rose-400"
              title="Asignar prioridad P0"
            >
              <span>P0</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchSetPriority('P1')}
              className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer text-amber-400"
              title="Asignar prioridad P1"
            >
              <span>P1</span>
            </button>

            <button
              type="button"
              onClick={() => handleBatchSetStatus('in_progress')}
              className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer text-sky-400"
              title="Mover a In Progress"
            >
              <span className="hidden sm:inline">In Progress</span>
              <span className="sm:hidden">Progreso</span>
            </button>

            <button
              type="button"
              onClick={handleBatchDelete}
              className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer text-rose-400 border-rose-900/60 hover:bg-rose-950/40"
              title="Eliminar seleccionadas"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
              <span className="hidden sm:inline">Eliminar</span>
            </button>
          </div>

          <button
            type="button"
            onClick={clearSelection}
            className="btn-m3-icon w-6 h-6 ml-1 cursor-pointer"
            title="Deseleccionar todas"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}
    </div>
  );
}
