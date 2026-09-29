import React, { useState, useMemo } from 'react';
import {
  AppUserSettings,
  clearRecentFilesHistory,
  resetUserSettingsToDefault,
} from '../services/settingsService';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppUserSettings;
  onUpdateSettings: (newSettings: AppUserSettings) => void;
  onOpenSanityConfig: () => void;
  onOpenFilePicker: () => void;
  onResetCanvasLayout: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

type SettingsSection =
  | 'general'
  | 'appearance'
  | 'workspace'
  | 'canvas'
  | 'kanban'
  | 'files'
  | 'accessibility'
  | 'advanced';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenSanityConfig,
  onOpenFilePicker,
  onResetCanvasLayout,
  onShowToast,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [searchFilter, setSearchFilter] = useState('');
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  if (!isOpen) return null;

  const handleUpdate = <K extends keyof AppUserSettings>(key: K, value: AppUserSettings[K]) => {
    const updated = { ...settings, [key]: value };
    onUpdateSettings(updated);
  };

  const handleExecuteResetSettings = () => {
    const defaults = resetUserSettingsToDefault();
    onUpdateSettings(defaults);
    setIsResetConfirmOpen(false);
    onShowToast('Preferencias restablecidas a los valores predeterminados', 'success');
  };

  const handleClearRecents = () => {
    clearRecentFilesHistory();
    handleUpdate('recentFiles', []);
    onShowToast('Historial de archivos recientes limpiado', 'info');
  };

  const sectionsList: Array<{ id: SettingsSection; label: string; icon: string; desc: string }> = [
    { id: 'general', label: 'General', icon: 'settings', desc: 'Vista inicial y confirmaciones' },
    { id: 'appearance', label: 'Apariencia', icon: 'palette', desc: 'Tema y densidad visual' },
    { id: 'workspace', label: 'Workspace', icon: 'space_dashboard', desc: 'Comportamiento de paneles' },
    { id: 'canvas', label: 'Canvas', icon: 'grid_view', desc: 'Cuadrícula, zoom y snapping' },
    { id: 'kanban', label: 'Kanban', icon: 'view_kanban', desc: 'Columnas, etiquetas y checklist' },
    { id: 'files', label: 'Archivos', icon: 'folder_open', desc: 'Historial reciente y nube' },
    { id: 'accessibility', label: 'Accesibilidad', icon: 'accessibility_new', desc: 'Movimiento y atajos' },
    { id: 'advanced', label: 'Avanzado', icon: 'tune', desc: 'Zona de mantenimiento y reset' },
  ];

  const filteredSections = searchFilter.trim()
    ? sectionsList.filter(
        (sec) =>
          sec.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
          sec.desc.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : sectionsList;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div
        className="w-full sm:max-w-3xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-lg sm:rounded-lg shadow-xl flex flex-col overflow-hidden animate-slide-up sm:animate-none h-[88vh] sm:h-[640px] max-h-[90vh] pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[var(--outline)] rounded mx-auto my-2 sm:hidden" />

        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-[var(--outline)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[var(--surface-container-high)] border border-[var(--outline)] flex items-center justify-center text-[var(--primary)]">
              <span className="material-symbols-outlined text-[17px]">settings</span>
            </div>
            <div>
              <h2 id="settings-dialog-title" className="text-sm font-semibold text-[var(--on-surface)]">
                Configuración & Preferencias
              </h2>
              <p className="text-[11px] text-[var(--on-surface-variant)]">
                Personaliza la interfaz, el comportamiento del espacio de trabajo y persistencia
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick search input */}
            <div className="hidden sm:flex items-center bg-[var(--surface-container-high)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs text-[var(--on-surface)] gap-1.5 focus-within:border-[var(--primary)]">
              <span className="material-symbols-outlined text-[14px] text-[var(--on-surface-variant)]">search</span>
              <input
                type="text"
                placeholder="Buscar ajuste..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-28 text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)]"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">close</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-m3-icon w-7 h-7 cursor-pointer"
              aria-label="Cerrar ajustes"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>

        {/* Mobile Tab Bar */}
        <div className="sm:hidden flex overflow-x-auto border-b border-[var(--outline)] bg-[var(--surface)] px-2 py-1.5 gap-1 shrink-0">
          {sectionsList.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setActiveSection(sec.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeSection === sec.id
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] font-semibold'
                  : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] bg-[var(--surface-container)]'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{sec.icon}</span>
              <span>{sec.label}</span>
            </button>
          ))}
        </div>

        {/* Desktop Layout: Sidebar + Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Left Sidebar */}
          <aside className="w-52 bg-[var(--surface)] border-r border-[var(--outline)] p-2 hidden sm:flex flex-col gap-0.5 shrink-0 select-none overflow-y-auto">
            {filteredSections.map((sec) => {
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-colors text-left cursor-pointer ${
                    isActive
                      ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)] font-semibold border-l-2 border-l-[var(--primary)]'
                      : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-[var(--primary)]' : ''}`}>
                    {sec.icon}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{sec.label}</span>
                  </div>
                </button>
              );
            })}
          </aside>

          {/* Right Content Pane */}
          <main className="flex-1 p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-xs">
            {/* GENERAL SECTION */}
            {activeSection === 'general' && (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--on-surface)]">General</h3>
                  <p className="text-[var(--on-surface-variant)] mt-0.5">
                    Comportamiento inicial y confirmaciones de seguridad
                  </p>
                </div>

                {/* Default View */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Vista inicial al abrir</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Selecciona el modo predeterminado de inicio</span>
                  </div>
                  <select
                    value={settings.defaultView}
                    onChange={(e) => handleUpdate('defaultView', e.target.value as 'canvas' | 'kanban')}
                    className="bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value="canvas">Lienzo (Canvas)</option>
                    <option value="kanban">Tablero Kanban</option>
                  </select>
                </div>

                {/* Confirm Delete with Dependents */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Confirmar eliminación con dependencias</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">
                      Avisa con diálogo explícito si la tarea eliminada bloquea a otras tareas
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confirmDeleteWithDependents}
                    onChange={(e) => handleUpdate('confirmDeleteWithDependents', e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* APPEARANCE SECTION */}
            {activeSection === 'appearance' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--on-surface)]">Apariencia</h3>
                  <p className="text-[var(--on-surface-variant)] mt-0.5">
                    Tema visual y escala de densidad conforme a DESIGN.md
                  </p>
                </div>

                {/* Theme Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-[var(--on-surface)]">Tema de color</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dark', label: 'Oscuro', icon: 'dark_mode' },
                      { id: 'light', label: 'Claro', icon: 'light_mode' },
                      { id: 'system', label: 'Seguir Sistema', icon: 'devices' },
                    ].map((t) => {
                      const isSelected = settings.theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleUpdate('theme', t.id as any)}
                          className={`p-2.5 rounded border text-left transition-colors cursor-pointer flex flex-col gap-1.5 ${
                            isSelected
                              ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                              : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px] text-sky-400">{t.icon}</span>
                          <span className="font-medium text-xs text-[var(--on-surface)]">{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Density Selection */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <label className="font-semibold text-[var(--on-surface)]">Densidad de la interfaz</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'compact', label: 'Compacta', desc: 'Menor padding y alturas para más datos' },
                      { id: 'normal', label: 'Normal', desc: 'Equilibrio estándar de productividad' },
                      { id: 'comfortable', label: 'Cómoda', desc: 'Mayor separación táctil y amplitud' },
                    ].map((d) => {
                      const isSelected = settings.density === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleUpdate('density', d.id as any)}
                          className={`p-2.5 rounded border text-left transition-colors cursor-pointer flex flex-col gap-0.5 ${
                            isSelected
                              ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                              : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                          }`}
                        >
                          <span className="font-medium text-xs text-[var(--on-surface)]">{d.label}</span>
                          <span className="text-[10px] text-[var(--on-surface-variant)] leading-snug">{d.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* WORKSPACE SECTION */}
            {activeSection === 'workspace' && (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--on-surface)]">Workspace</h3>
                  <p className="text-[var(--on-surface-variant)] mt-0.5">
                    Organización de paneles laterales y distribución del espacio
                  </p>
                </div>

                {/* Show Sidebar Default */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Mostrar panel lateral de inicio</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Mantener la barra de navegación abierta en desktop</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.workspaceShowSidebar}
                    onChange={(e) => handleUpdate('workspaceShowSidebar', e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* CANVAS SECTION */}
            {activeSection === 'canvas' && (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--on-surface)]">Canvas</h3>
                  <p className="text-[var(--on-surface-variant)] mt-0.5">
                    Comportamiento visual del lienzo y alineación interactiva
                  </p>
                </div>

                {/* Show Grid */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Mostrar cuadrícula de fondo</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Guía visual de puntos en el lienzo infinito</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.canvasShowGrid}
                    onChange={(e) => handleUpdate('canvasShowGrid', e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>

                {/* Snap to Grid */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Alineación magnética (Snapping)</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Alinear tarjetas automáticamente con los ejes</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.canvasSnapToGrid}
                    onChange={(e) => handleUpdate('canvasSnapToGrid', e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* KANBAN SECTION */}
            {activeSection === 'kanban' && (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--on-surface)]">Kanban</h3>
                  <p className="text-[var(--on-surface-variant)] mt-0.5">
                    Opciones de visualización de columnas y tarjetas del tablero
                  </p>
                </div>

                {/* Default Group By */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Agrupación predeterminada</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Cómo se distribuyen las columnas en el tablero</span>
                  </div>
                  <select
                    value={settings.kanbanDefaultGroupBy}
                    onChange={(e) => handleUpdate('kanbanDefaultGroupBy', e.target.value as 'status' | 'section')}
                    className="bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                  >
                    <option value="status">Por Estados (Backlog, Todo, In Progress...)</option>
                    <option value="section">Por Secciones de TASKS.md</option>
                  </select>
                </div>

                {/* Show Tags in Kanban Cards */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Mostrar etiquetas (#tags)</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Mostrar etiquetas en las tarjetas Kanban</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.kanbanShowTags}
                    onChange={(e) => handleUpdate('kanbanShowTags', e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>

                {/* Show Subtasks in Kanban */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Mostrar progreso de subtareas</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Indicador de checklist (ej. 2/4) en tarjetas</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.kanbanShowSubtasks}
                    onChange={(e) => handleUpdate('kanbanShowSubtasks', e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* FILES & RECENTS SECTION */}
            {activeSection === 'files' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--on-surface)]">Archivos Recientes</h3>
                    <p className="text-[var(--on-surface-variant)] mt-0.5">
                      Historial de documentos TASKS.md abiertos recientemente
                    </p>
                  </div>
                  {settings.recentFiles && settings.recentFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearRecents}
                      className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      Limpiar historial
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {(!settings.recentFiles || settings.recentFiles.length === 0) ? (
                    <div className="p-4 rounded bg-[var(--surface)] border border-[var(--outline)] text-center text-[var(--on-surface-variant)] text-xs">
                      No hay archivos recientes registrados.
                    </div>
                  ) : (
                    settings.recentFiles.map((file) => (
                      <div
                        key={file.name}
                        className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-sky-400 shrink-0">description</span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-[var(--on-surface)] truncate font-mono text-xs">{file.name}</span>
                            <span className="text-[10px] text-[var(--on-surface-variant)] font-mono">
                              {new Date(file.lastOpened).toLocaleDateString()} · {file.taskCount || 0} tareas
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Cloud Persistence */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4 mt-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Persistencia Visual en la Nube (Sanity)</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Guarda las coordenadas espaciales del canvas</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSanityConfig();
                    }}
                    className="btn-m3-secondary px-3 py-1 text-xs cursor-pointer shrink-0"
                  >
                    Configurar
                  </button>
                </div>
              </div>
            )}

            {/* ACCESSIBILITY SECTION */}
            {activeSection === 'accessibility' && (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--on-surface)]">Accesibilidad & Atajos</h3>
                  <p className="text-[var(--on-surface-variant)] mt-0.5">
                    Opciones de contraste, movimiento y mapa de atajos de teclado
                  </p>
                </div>

                {/* Reduced Motion */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Reducir animaciones (Reduced Motion)</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Minimiza o desactiva transiciones y efectos de movimiento</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.accessibilityReducedMotion}
                    onChange={(e) => handleUpdate('accessibilityReducedMotion', e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>

                {/* High Contrast */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Modo de alto contraste</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Refuerza bordes y separadores de la interfaz</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.accessibilityHighContrast}
                    onChange={(e) => handleUpdate('accessibilityHighContrast', e.target.checked)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer"
                  />
                </div>

                {/* Keyboard Shortcuts Reference Table */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <span className="font-semibold text-xs text-[var(--on-surface)]">Atajos de Teclado Principales</span>
                  <div className="rounded border border-[var(--outline)] bg-[var(--surface)] overflow-hidden divide-y divide-[var(--outline)]">
                    {[
                      { key: 'Ctrl/Cmd + K', desc: 'Búsqueda global y Command Palette' },
                      { key: 'Ctrl/Cmd + ,', desc: 'Abrir Configuración y Preferencias' },
                      { key: '?', desc: 'Abrir Guía rápida de sintaxis y ayuda' },
                      { key: 'Esc', desc: 'Cerrar modal o deseleccionar tarea' },
                      { key: 'D / Delete', desc: 'Eliminar tarea seleccionada (con confirmación)' },
                      { key: 'Space + Arrastrar', desc: 'Desplazamiento panorámico (Pan) en Canvas' },
                    ].map((item) => (
                      <div key={item.key} className="p-2 px-2.5 flex items-center justify-between gap-3 text-xs">
                        <span className="text-[var(--on-surface-variant)]">{item.desc}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-container)] text-[var(--on-surface)] font-mono text-[10px] border border-[var(--outline)]">
                          {item.key}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ADVANCED SECTION */}
            {activeSection === 'advanced' && (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--on-surface)]">Avanzado</h3>
                  <p className="text-[var(--on-surface-variant)] mt-0.5">
                    Acciones de mantenimiento y restablecimiento de configuración
                  </p>
                </div>

                {/* Reset Layout */}
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--on-surface)]">Reiniciar lienzo del Canvas</span>
                    <span className="text-[var(--on-surface-variant)] text-[11px]">Restaura la distribución espacial de las tarjetas</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onResetCanvasLayout();
                    }}
                    className="btn-m3-secondary px-3 py-1 text-xs cursor-pointer text-amber-400 border-amber-800/60 shrink-0"
                  >
                    Reiniciar lienzo
                  </button>
                </div>

                {/* Danger Zone: Reset Preferences */}
                <div className="p-3 rounded bg-rose-950/20 border border-rose-900/40 flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    <span>Restablecer preferencias</span>
                  </div>
                  <p className="text-[var(--on-surface-variant)] leading-relaxed text-[11px]">
                    Se restablecerán los ajustes visuales y de comportamiento a sus valores de fábrica.
                    <strong className="text-[var(--on-surface)]"> Tus tareas y archivos TASKS.md no se modificarán.</strong>
                  </p>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsResetConfirmOpen(true)}
                      className="btn-m3-secondary px-3 py-1 text-xs text-rose-300 border-rose-800 hover:bg-rose-950/60 cursor-pointer"
                    >
                      Restablecer valores predeterminados
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[var(--on-surface-variant)] font-mono">
            AnTaskCanvas
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm"
          >
            Listo
          </button>
        </div>
      </div>

      {/* Confirmation Sub-Modal for Resetting Settings */}
      {isResetConfirmOpen && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80"
          onClick={() => setIsResetConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[var(--surface-container)] border border-[var(--outline)] rounded-lg shadow-xl p-4 flex flex-col gap-2.5"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-reset-title"
          >
            <h4 id="confirm-reset-title" className="font-semibold text-xs text-rose-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>¿Restablecer preferencias?</span>
            </h4>
            <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed">
              Se restablecerán los ajustes visuales y de comportamiento. Tus tareas y archivos no se modificarán.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--outline)]">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="btn-m3-text px-3 py-1 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteResetSettings}
                className="btn-m3-primary bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1 text-xs cursor-pointer"
              >
                Restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
