import React, { useState } from 'react';
import { formatDocumentPath, TaskDocument } from '../services/workspaceService';

interface NewTaskDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  presetFolder?: string;
  existingFolders: string[];
  onCreateDocument: (doc: TaskDocument) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const NewTaskDocumentModal: React.FC<NewTaskDocumentModalProps> = ({
  isOpen,
  onClose,
  presetFolder = '',
  existingFolders,
  onCreateDocument,
  onShowToast,
}) => {
  const [docName, setDocName] = useState('TASKS.md');
  const [selectedFolder, setSelectedFolder] = useState<string>(presetFolder || 'root');
  const [customFolderInput, setCustomFolderInput] = useState('');
  const [isCustomFolder, setIsCustomFolder] = useState(false);
  const [template, setTemplate] = useState<'standard' | 'frontend' | 'backend' | 'bugs' | 'blank'>('standard');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalFolder = isCustomFolder
      ? customFolderInput.trim()
      : selectedFolder === 'root' || selectedFolder === '/'
      ? ''
      : selectedFolder;

    const cleanName = docName.trim() || 'TASKS.md';
    const finalPath = formatDocumentPath(finalFolder, cleanName);

    let starterContent = `# ${cleanName}\n\n## General\n- [ ] Nueva tarea de inicio\n  id: task_1\n  priority: P1\n`;

    if (template === 'frontend') {
      starterContent = `# Frontend Tasks - ${cleanName}\n\n## Interfaz & UI\n- [ ] Maquetar vista principal\n  id: fe_view_1\n  priority: P0\n- [ ] Ajustar accesibilidad y contraste\n  id: fe_a11y\n  priority: P1\n\n## Componentes & Estado\n- [ ] Conectar estado con store\n  id: fe_state\n  priority: P1\n`;
    } else if (template === 'backend') {
      starterContent = `# Backend Tasks - ${cleanName}\n\n## APIs & Endpoints\n- [ ] Crear endpoints CRUD\n  id: be_crud\n  priority: P0\n- [ ] Validar esquemas y payload con Zod\n  id: be_validation\n  priority: P1\n\n## Base de Datos\n- [ ] Ejecutar migraciones e índices\n  id: be_migrations\n  priority: P1\n`;
    } else if (template === 'bugs') {
      starterContent = `# Bug Tracker - ${cleanName}\n\n## Alta Prioridad (P0)\n- [ ] Bug crítico en producción\n  id: bug_crit_1\n  priority: P0\n\n## Bugs Menores\n- [ ] Corregir padding en móvil\n  id: bug_ui_2\n  priority: P2\n`;
    } else if (template === 'blank') {
      starterContent = `# ${cleanName}\n\n## Tareas\n- [ ] Tarea inicial\n  id: init_1\n  priority: P1\n`;
    }

    const newDoc: TaskDocument = {
      id: `doc_${Date.now()}`,
      name: cleanName,
      folder: finalFolder,
      path: finalPath,
      content: starterContent,
      lastSavedContent: starterContent,
      updatedAt: new Date().toISOString(),
    };

    onCreateDocument(newDoc);
    onShowToast(`Archivo "${finalPath}" creado con éxito`, 'success');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-lg sm:rounded-lg shadow-xl flex flex-col overflow-hidden pb-safe sm:pb-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-task-doc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-sky-400">note_add</span>
            <h2 id="new-task-doc-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
              Nuevo Archivo Task MD
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-m3-icon w-7 h-7 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
          {/* File Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--on-surface)]">
              Nombre del archivo (.md)
            </label>
            <input
              type="text"
              required
              autoFocus
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="TASKS.md, ROADMAP.md, SPRINT.md..."
              className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
            />
          </div>

          {/* Location / Folder */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--on-surface)]">
                Ubicación / Carpeta
              </label>
              <button
                type="button"
                onClick={() => setIsCustomFolder(!isCustomFolder)}
                className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer"
              >
                {isCustomFolder ? 'Elegir existente' : '+ Nueva carpeta'}
              </button>
            </div>

            {isCustomFolder ? (
              <input
                type="text"
                value={customFolderInput}
                onChange={(e) => setCustomFolderInput(e.target.value)}
                placeholder="ej. frontend, backend, packages/ui, mobile, docs..."
                className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
              />
            ) : (
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2 py-1.5 text-xs font-sans text-[var(--on-surface)] focus:outline-none cursor-pointer"
              >
                <option value="root">📁 Raíz (/)</option>
                <option value="frontend">📁 frontend/</option>
                <option value="backend">📁 backend/</option>
                {existingFolders
                  .filter((f) => f !== 'root' && f !== '/' && f !== 'frontend' && f !== 'backend' && f)
                  .map((f) => (
                    <option key={f} value={f}>
                      📁 {f}/
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Template */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--on-surface)]">
              Plantilla inicial de tareas
            </label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
              className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none cursor-pointer"
            >
              <option value="standard">Estándar (General + Tarea base)</option>
              <option value="frontend">Frontend Focus (UI, Componentes, Estado)</option>
              <option value="backend">Backend Focus (APIs, Zod, Database)</option>
              <option value="bugs">Bug Tracker (P0 críticos, UI bugs)</option>
              <option value="blank">En blanco</option>
            </select>
          </div>

          {/* Preview Path */}
          <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] font-mono text-[var(--on-surface-variant)] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
            <span>Ruta final: <strong>{formatDocumentPath(isCustomFolder ? customFolderInput : selectedFolder === 'root' ? '' : selectedFolder, docName)}</strong></span>
          </div>

          <div className="pt-2.5 flex items-center justify-end gap-2 border-t border-[var(--outline)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-m3-text px-3 py-1 text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!docName.trim()}
              className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm"
            >
              Crear Documento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
