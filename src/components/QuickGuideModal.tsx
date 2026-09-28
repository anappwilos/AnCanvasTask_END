import React from 'react';

interface QuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSampleProject?: () => void;
}

export const QuickGuideModal: React.FC<QuickGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenSampleProject,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘ / Ctrl + K', label: 'Abrir paleta de comandos y búsqueda global' },
    { key: 'N', label: 'Crear nueva tarea en modal rápido' },
    { key: 'V', label: 'Cambiar a vista espacial Canvas' },
    { key: 'K', label: 'Cambiar a vista de Tablero Kanban' },
    { key: 'A', label: 'Auto-organizar Canvas jerárquicamente (DAG)' },
    { key: '⌘ / Ctrl + S', label: 'Guardar y exportar archivo TASKS.md' },
    { key: 'T', label: 'Alternar tema claro / oscuro' },
    { key: 'P', label: 'Ver problemas de sintaxis y diagnóstico' },
    { key: 'M', label: 'Ver archivo TASKS.md en vivo' },
    { key: 'ESC', label: 'Limpiar filtros activos o cerrar modal' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
    >
      <div
        className="w-full sm:max-w-2xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none max-h-[90vh] sm:max-h-[85vh] pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--outline)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--primary-container)]/50 border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)]">
              <span className="material-symbols-outlined text-[18px]">help</span>
            </div>
            <div>
              <h2 id="guide-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
                Guía de Inicio Rápido & Atajos
              </h2>
              <p className="text-xs text-[var(--on-surface-variant)]">
                Todo lo que necesitas saber sobre AnTaskCanvas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-m3-icon w-8 h-8 cursor-pointer"
            aria-label="Cerrar guía"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Section 1: Concept & Single Source of Truth */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--outline)] p-4 flex flex-col gap-2">
            <h3 className="font-semibold text-sm text-[var(--on-surface)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-sky-400">description</span>
              <span>1. Single Source of Truth: TASKS.md</span>
            </h3>
            <p className="text-[var(--on-surface-variant)] leading-relaxed">
              El archivo <code className="text-[var(--primary)] font-mono font-semibold">TASKS.md</code> es la verdad absoluta de tus tareas.
              Las secciones <code className="text-[var(--on-surface)] font-mono">## Nombre</code> definen grupos, y las líneas <code className="text-[var(--on-surface)] font-mono">- [ ] Título</code> definen tareas.
            </p>
            <div className="mt-1 p-2.5 rounded-xl bg-[var(--surface-container)] font-mono text-[11px] text-[var(--on-surface)] border border-[var(--outline)] leading-relaxed">
              ## Mi Sección<br />
              - [ ] Tarea importante<br />
              &nbsp;&nbsp;id: tarea-1<br />
              &nbsp;&nbsp;priority: P0<br />
              &nbsp;&nbsp;blockedBy: otra-tarea
            </div>
          </div>

          {/* Section 2: Vistas Duales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--outline)] p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-400">grid_view</span>
                <span>Vista Canvas (Espacial)</span>
              </span>
              <p className="text-[var(--on-surface-variant)] leading-relaxed text-[11px]">
                Arrastra y organiza tarjetas libremente en un lienzo infinito. Conecta dependencias visuales y utiliza <em>Auto organizar (DAG)</em> para ordenar el flujo jerárquico.
              </p>
            </div>

            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--outline)] p-3.5 flex flex-col gap-1.5">
              <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-purple-400">view_kanban</span>
                <span>Vista Kanban (Columnas)</span>
              </span>
              <p className="text-[var(--on-surface-variant)] leading-relaxed text-[11px]">
                Gestiona el ciclo de vida por estados (<em>Backlog, Todo, In Progress, Review, Done</em>) o por secciones temáticas con arrastrar y soltar fluido.
              </p>
            </div>
          </div>

          {/* Section 3: Tabla de Atajos de Teclado */}
          <div className="rounded-2xl bg-[var(--surface)] border border-[var(--outline)] p-4 flex flex-col gap-2.5">
            <h3 className="font-semibold text-sm text-[var(--on-surface)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-400">keyboard</span>
              <span>Atajos de Teclado Esenciales</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              {shortcuts.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--surface-container)] border border-[var(--outline)]/60 text-[11px]"
                >
                  <span className="text-[var(--on-surface-variant)] truncate">{s.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-container-high)] border border-[var(--outline)] text-[10px] font-mono font-bold text-[var(--primary)] shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-between">
          {onOpenSampleProject ? (
            <button
              type="button"
              onClick={() => {
                onOpenSampleProject();
                onClose();
              }}
              className="btn-m3-secondary px-3 py-1.5 text-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Cargar ejemplo inicial</span>
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="btn-m3-primary px-5 py-1.5 text-xs cursor-pointer shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
