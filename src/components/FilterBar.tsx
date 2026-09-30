import React, { useEffect, useRef, useState } from 'react';
import { TaskPriority, TaskStatus } from '../shapes/TaskShapeUtil';

export type TaskSortOption = 'default' | 'priority' | 'status' | 'title';

export interface TaskFilterState {
  status: TaskStatus | 'all';
  priority: TaskPriority | 'all';
  section: string | 'all';
  tag: string | 'all';
  onlyBlocked: boolean;
  sortBy: TaskSortOption;
}

interface FilterBarProps {
  filters: TaskFilterState;
  onFilterChange: (filters: TaskFilterState) => void;
  onResetFilters: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  availableSections: string[];
  availableTags: string[];
  totalTasksCount: number;
  filteredTasksCount: number;
  onOpenCommandPalette: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  searchQuery,
  onSearchChange,
  availableSections,
  availableTags,
  totalTasksCount,
  filteredTasksCount,
  onOpenCommandPalette,
}) => {
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!isFilterPopoverOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsFilterPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterPopoverOpen]);

  // Count active non-default filters
  const activeFiltersCount =
    (filters.status !== 'all' ? 1 : 0) +
    (filters.priority !== 'all' ? 1 : 0) +
    (filters.section !== 'all' ? 1 : 0) +
    (filters.tag !== 'all' ? 1 : 0) +
    (filters.onlyBlocked ? 1 : 0) +
    (filters.sortBy !== 'default' ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const hasActiveFilters = activeFiltersCount > 0;

  const statusOptions: Array<{ id: TaskStatus | 'all'; label: string }> = [
    { id: 'all', label: 'Todos los estados' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'todo', label: 'Todo (Pendiente)' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'review', label: 'Review' },
    { id: 'blocked', label: 'Blocked' },
    { id: 'done', label: 'Done (Completada)' },
  ];

  const priorityOptions: Array<{ id: TaskPriority | 'all'; label: string }> = [
    { id: 'all', label: 'Todas las prioridades' },
    { id: 'P0', label: 'P0 · Critical' },
    { id: 'P1', label: 'P1 · High' },
    { id: 'P2', label: 'P2 · Medium' },
    { id: 'P3', label: 'P3 · Low' },
  ];

  const sortOptions: Array<{ id: TaskSortOption; label: string }> = [
    { id: 'default', label: 'Orden del documento' },
    { id: 'priority', label: 'Prioridad (P0 → P3)' },
    { id: 'status', label: 'Estado' },
    { id: 'title', label: 'Título (A → Z)' },
  ];

  return (
    <div className="w-full bg-[var(--surface-container)] border-b border-[var(--outline)] px-3 sm:px-4 py-2 flex flex-col gap-2 select-none shrink-0 z-10">
      {/* Top row of FilterBar: Filter popover toggle + Search trigger + Quick view summary */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          {/* Filter Popover Button */}
          <div className="relative shrink-0" ref={popoverRef}>
            <button
              type="button"
              aria-expanded={isFilterPopoverOpen}
              aria-haspopup="true"
              aria-label="Abrir panel de filtros y ordenación"
              onClick={() => setIsFilterPopoverOpen(!isFilterPopoverOpen)}
              className={`btn-m3-secondary px-2.5 sm:px-3 py-1.5 text-xs font-medium cursor-pointer ${
                activeFiltersCount > (searchQuery ? 1 : 0)
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-container)]/20'
                  : ''
              }`}
              title="Abrir panel de filtros y ordenación"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span className="hidden xs:inline">Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[var(--primary)] text-[var(--on-primary)] text-[10px] font-bold flex items-center justify-center font-mono">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* Filter Popover Content */}
            {isFilterPopoverOpen && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute left-0 top-9 z-40 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-[var(--surface-container-high)] border border-[var(--outline)] rounded-lg shadow-lg p-3 flex flex-col gap-2.5 text-xs"
              >
                <div className="flex items-center justify-between border-b border-[var(--outline)] pb-2">
                  <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-sky-400">filter_list</span>
                    <span>Filtros avanzados</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFilterPopoverOpen(false)}
                    className="btn-m3-icon w-6 h-6 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>

                {/* 1. Estado */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                    Estado
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      onFilterChange({ ...filters, status: e.target.value as any })
                    }
                    className="w-full bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs font-sans focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Prioridad */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                    Prioridad
                  </label>
                  <select
                    value={filters.priority}
                    onChange={(e) =>
                      onFilterChange({ ...filters, priority: e.target.value as any })
                    }
                    className="w-full bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs font-sans focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                  >
                    {priorityOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Sección */}
                {availableSections.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                      Sección (Grupo)
                    </label>
                    <select
                      value={filters.section}
                      onChange={(e) =>
                        onFilterChange({ ...filters, section: e.target.value })
                      }
                      className="w-full bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs font-sans focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                    >
                      <option value="all">Todas las secciones</option>
                      {availableSections.map((sec) => (
                        <option key={sec} value={sec}>
                          ## {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 4. Etiqueta */}
                {availableTags.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                      Etiqueta
                    </label>
                    <select
                      value={filters.tag}
                      onChange={(e) =>
                        onFilterChange({ ...filters, tag: e.target.value })
                      }
                      className="w-full bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs font-sans focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                    >
                      <option value="all">Todas las etiquetas</option>
                      {availableTags.map((tag) => (
                        <option key={tag} value={tag}>
                          #{tag}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 5. Solo bloqueadas */}
                <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={filters.onlyBlocked}
                    onChange={(e) =>
                      onFilterChange({ ...filters, onlyBlocked: e.target.checked })
                    }
                    className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-[var(--on-surface)] font-medium">
                    Mostrar únicamente tareas bloqueadas
                  </span>
                </label>

                {/* 6. Ordenación */}
                <div className="flex flex-col gap-1 pt-1 border-t border-[var(--outline)]">
                  <label className="text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                    Ordenar por
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) =>
                      onFilterChange({ ...filters, sortBy: e.target.value as any })
                    }
                    className="w-full bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs font-sans focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                  >
                    {sortOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--outline)] mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onResetFilters();
                      setIsFilterPopoverOpen(false);
                    }}
                    className="btn-m3-text py-1 text-[11px] text-[var(--on-surface-variant)] hover:text-rose-400 cursor-pointer"
                  >
                    Restablecer
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFilterPopoverOpen(false)}
                    className="btn-m3-primary px-3 py-1 text-xs cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Command Palette Button (Cmd + K) on desktop */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="btn-m3-secondary px-3 py-1.5 text-xs cursor-pointer hidden sm:flex items-center gap-1.5 shrink-0"
            title="Abrir paleta de comandos y búsqueda global (Ctrl/Cmd + K)"
          >
            <span className="material-symbols-outlined text-[16px] text-sky-400">terminal</span>
            <span>Comandos</span>
            <kbd className="px-1.5 py-0.2 rounded bg-[var(--surface)] border border-[var(--outline)] font-mono text-[10px] text-[var(--on-surface-variant)]">
              ⌘K
            </kbd>
          </button>

          {/* Mobile Quick Search Input */}
          <div className="relative flex-1 sm:hidden min-w-[110px] max-w-[200px]">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-[var(--on-surface-variant)] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-[var(--surface)] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] border border-[var(--outline)] rounded pl-6 pr-5 py-1 text-xs font-sans focus:outline-none focus:border-[var(--primary)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Counter of matching tasks */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--on-surface-variant)] shrink-0">
          <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px]">
            <span className="sm:hidden">{filteredTasksCount}/{totalTasksCount}</span>
            <span className="hidden sm:inline">{filteredTasksCount} de {totalTasksCount} tareas</span>
          </span>
        </div>
      </div>

      {/* Active Filter Chips Bar (Visible when any filter or query is active) */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[var(--outline)]">
          <span className="text-[11px] text-[var(--on-surface-variant)] font-medium">
            Filtros activos:
          </span>

          {searchQuery.trim() && (
            <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--primary)]/60 text-[11px] text-[var(--primary)] font-medium flex items-center gap-1">
              <span>Búsqueda: &ldquo;{searchQuery}&rdquo;</span>
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="hover:text-rose-400 cursor-pointer font-bold"
                title="Quitar búsqueda"
              >
                ×
              </button>
            </span>
          )}

          {filters.status !== 'all' && (
            <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface)] font-medium flex items-center gap-1">
              <span>Estado: {filters.status.toUpperCase()}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, status: 'all' })}
                className="text-[var(--on-surface-variant)] hover:text-rose-400 cursor-pointer font-bold"
              >
                ×
              </button>
            </span>
          )}

          {filters.priority !== 'all' && (
            <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface)] font-mono font-medium flex items-center gap-1">
              <span>Prioridad: {filters.priority}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, priority: 'all' })}
                className="text-[var(--on-surface-variant)] hover:text-rose-400 cursor-pointer font-bold"
              >
                ×
              </button>
            </span>
          )}

          {filters.section !== 'all' && (
            <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface)] font-medium flex items-center gap-1">
              <span>Sección: ## {filters.section}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, section: 'all' })}
                className="text-[var(--on-surface-variant)] hover:text-rose-400 cursor-pointer font-bold"
              >
                ×
              </button>
            </span>
          )}

          {filters.tag !== 'all' && (
            <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface)] font-mono flex items-center gap-1">
              <span>Etiqueta: #{filters.tag}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, tag: 'all' })}
                className="text-[var(--on-surface-variant)] hover:text-rose-400 cursor-pointer font-bold"
              >
                ×
              </button>
            </span>
          )}

          {filters.onlyBlocked && (
            <span className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-300 font-medium flex items-center gap-1">
              <span>Solo bloqueadas</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, onlyBlocked: false })}
                className="hover:text-rose-400 cursor-pointer font-bold"
              >
                ×
              </button>
            </span>
          )}

          {filters.sortBy !== 'default' && (
            <span className="px-2 py-0.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface-variant)] font-medium flex items-center gap-1">
              <span>Orden: {filters.sortBy}</span>
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, sortBy: 'default' })}
                className="hover:text-rose-400 cursor-pointer font-bold"
              >
                ×
              </button>
            </span>
          )}

          {/* Reset All Button */}
          <button
            type="button"
            onClick={onResetFilters}
            className="text-[11px] text-[var(--primary)] hover:underline ml-1 cursor-pointer font-medium"
          >
            Limpiar todos
          </button>
        </div>
      )}
    </div>
  );
};
