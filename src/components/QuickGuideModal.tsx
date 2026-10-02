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
    { key: '⌘ / Ctrl + ⇧ + N', label: 'Normalización segura de Markdown (Diff Git)' },
    { key: 'ESC', label: 'Limpiar filtros activos o cerrar modal' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-title"
    >
      <div
        className="w-full sm:max-w-2xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none max-h-[90vh] sm:max-h-[85vh] pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[var(--outline)] rounded mx-auto my-2 sm:hidden" />

        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">keyboard</span>
            <h2 id="guide-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
              Atajos de Teclado y Formato TASKS.md
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-m3-icon w-7 h-7 cursor-pointer"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex flex-col gap-3 text-xs">
          {/* Section 1: Formato TASKS.md */}
          <div className="rounded bg-[var(--surface)] border border-[var(--outline)] p-2.5 flex flex-col gap-1.5">
            <span className="font-semibold text-xs text-[var(--on-surface)]">
              Formato de tareas en TASKS.md
            </span>
            <div className="p-2 rounded bg-[var(--surface-container)] font-mono text-[11px] text-[var(--on-surface)] border border-[var(--outline)] leading-relaxed">
              ## Sección<br />
              - [ ] Tarea pendiente<br />
              &nbsp;&nbsp;id: auth-1<br />
              &nbsp;&nbsp;priority: P0<br />
              &nbsp;&nbsp;blockedBy: db-setup
            </div>
          </div>

          {/* Section 2: Atajos de Teclado */}
          <div className="rounded bg-[var(--surface)] border border-[var(--outline)] p-2.5 flex flex-col gap-1.5">
            <span className="font-semibold text-xs text-[var(--on-surface)]">
              Atajos de teclado
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {shortcuts.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between gap-2 p-1.5 px-2 rounded bg-[var(--surface-container)] border border-[var(--outline)] text-[11px]"
                >
                  <span className="text-[var(--on-surface-variant)] truncate">{s.label}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[10px] font-mono font-medium text-[var(--primary)] shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-m3-primary px-4 py-1 text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
