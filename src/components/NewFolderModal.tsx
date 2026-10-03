import React, { useState } from 'react';
import { useTranslation } from "react-i18next";
import { formatDocumentPath, TaskDocument } from '../services/workspaceService';

interface NewFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingFolders: string[];
  onCreateFolderWithDoc: (doc: TaskDocument) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const NewFolderModal: React.FC<NewFolderModalProps> = ({
  isOpen,
  onClose,
  existingFolders,
  onCreateFolderWithDoc,
  onShowToast,
}) => {
  const { t } = useTranslation();
  const [folderName, setFolderName] = useState('');
  const [docName, setDocName] = useState('TASKS.md');

  if (!isOpen) return null;

  const quickFolderSuggestions = ['frontend', 'backend', 'packages/ui', 'api', 'mobile', 'infra', 'docs', 'shared'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFolder = folderName.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanFolder) {
      onShowToast('Por favor introduce un nombre para la carpeta', 'warning');
      return;
    }

    const cleanDocName = docName.trim() || 'TASKS.md';
    const finalPath = formatDocumentPath(cleanFolder, cleanDocName);

    const starterContent = `# ${cleanDocName} - ${cleanFolder}\n\n## Tareas Iniciales\n- [ ] Configurar módulo ${cleanFolder}\n  id: ${cleanFolder.replace(/[^a-zA-Z0-9]/g, '_')}_init\n  priority: P0\n`;

    const newDoc: TaskDocument = {
      id: `doc_${Date.now()}`,
      name: cleanDocName,
      folder: cleanFolder,
      path: finalPath,
      content: starterContent,
      lastSavedContent: starterContent,
      updatedAt: new Date().toISOString(),
    };

    onCreateFolderWithDoc(newDoc);
    onShowToast(`Carpeta "${cleanFolder}/" creada con "${cleanDocName}"`, 'success');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-lg sm:rounded-lg shadow-xl flex flex-col overflow-hidden pb-safe sm:pb-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-folder-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="div-newfoldermodal-1" className="px-4 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div id="div-newfoldermodal-2" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-400">create_new_folder</span>
            <h2 id="new-folder-modal-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
              Nueva Carpeta para Task MD
            </h2>
          </div>
          <button id="btn-newfoldermodal-1" type="button" onClick={onClose} className="btn-m3-icon w-7 h-7 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
          {/* Folder Name Input */}
          <div id="div-newfoldermodal-3" className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--on-surface)]">
              Nombre o ruta de la carpeta
            </label>
            <input
              type="text"
              required
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="ej. frontend, backend, packages/ui, mobile, docs..."
              className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
            />

            {/* Quick Suggestions Chips */}
            <div id="div-newfoldermodal-4" className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-[10px] text-[var(--on-surface-variant)]">{t('common.suggestions')}:</span>
              {quickFolderSuggestions
                .filter((s) => !existingFolders.includes(s))
                .slice(0, 5)
                .map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setFolderName(sug)}
                    className="px-2 py-0.5 rounded bg-[var(--surface)] hover:bg-[var(--surface-container-high)] border border-[var(--outline)] text-[10px] font-mono text-[var(--on-surface)] cursor-pointer transition-colors"
                  >
                    📁 {sug}/
                  </button>
                ))}
            </div>
          </div>

          {/* Initial Task MD file */}
          <div id="div-newfoldermodal-5" className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--on-surface)]">
              Archivo inicial (.md)
            </label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="TASKS.md"
              className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
            />
          </div>

          {/* Path Preview */}
          <div id="div-newfoldermodal-6" className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] font-mono text-[var(--on-surface-variant)] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
            <span>{t('common.finalPath')}: <strong>{formatDocumentPath(folderName, docName)}</strong></span>
          </div>

          <div id="div-newfoldermodal-7" className="pt-2.5 flex items-center justify-end gap-2 border-t border-[var(--outline)]">
            <button
              type="button"
              onClick={onClose}
              className="btn-m3-text px-3 py-1 text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!folderName.trim()}
              className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm"
            >
              Crear Carpeta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
