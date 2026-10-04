import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import React, { useState, useEffect } from 'react';
import { formatDocumentPath } from '../services/workspaceService';

interface RenameDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: string;
  initialName: string;
  initialFolder: string;
  existingFolders: string[];
  onRename: (docId: string, newName: string, newFolder: string) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const RenameDocumentModal: React.FC<RenameDocumentModalProps> = ({
  isOpen,
  onClose,
  docId,
  initialName,
  initialFolder,
  existingFolders,
  onRename,
  onShowToast,
}) => {
  const { _ } = useLingui();
  const [name, setName] = useState(initialName);
  const [folderInput, setFolderInput] = useState(initialFolder || '');

  useEffect(() => {
    setName(initialName);
    setFolderInput(initialFolder || '');
  }, [initialName, initialFolder, isOpen]);

  if (!isOpen) return null;

  const quickFolderChips = [
    { label: _(msg`Directorio raíz`), value: '' },
    { label: 'frontend/', value: 'frontend' },
    { label: 'backend/', value: 'backend' },
    ...existingFolders
      .filter((f) => f && f !== 'root' && f !== '/' && f !== 'frontend' && f !== 'backend')
      .map((f) => ({ label: `${f}/`, value: f })),
    { label: 'packages/ui/', value: 'packages/ui' },
    { label: 'mobile/', value: 'mobile' },
    { label: 'docs/', value: 'docs' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || 'TASKS.md';
    const cleanFolder = folderInput.trim().replace(/^\/+|\/+$/g, '');

    const newPath = formatDocumentPath(cleanFolder, cleanName);
    onRename(docId, cleanName, cleanFolder);
    onShowToast(_(msg`Archivo actualizado a "${newPath}"`), 'success');
    onClose();
  };

  return (
    <div
      id="modal-rename-doc-overlay"
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="modal-rename-doc-dialog"
        className="w-full sm:max-w-md bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-md sm:rounded-md shadow-md flex flex-col overflow-hidden pb-safe sm:pb-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-doc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="div-renamedocumentmodal-1" className="px-4 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div id="div-renamedocumentmodal-2" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-[var(--primary)]">edit_note</span>
            <h2 id="rename-doc-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
              {_(msg`Renombrar / Mover Archivo Task MD`)}
            </h2>
          </div>
          <button id="btn-renamedocumentmodal-1" type="button" onClick={onClose} className="btn-m3-icon w-7 h-7 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
          <div id="div-renamedocumentmodal-3" className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--on-surface)]">
              {_(msg`Nombre del archivo`)}
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
            />
          </div>

          <div id="div-renamedocumentmodal-4" className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--on-surface)]">
              {_(msg`Nombre o ruta de la carpeta (ej. frontend, backend, packages/ui, o vacío para raíz)`)}
            </label>
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder={_(msg`frontend, backend, packages/ui, mobile...`)}
              className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
            />

            {/* Quick Folder Chips */}
            <div id="div-renamedocumentmodal-5" className="flex items-center gap-1.5 flex-wrap mt-1">
              {quickFolderChips.slice(0, 6).map((chip) => {
                const isSelected = folderInput.trim().replace(/^\/+|\/+$/g, '') === chip.value;
                const chipKey = chip.value.replace(/[^a-zA-Z0-9]/g, '-') || 'root';
                return (
                  <button
                    key={chip.label}
                    id={`btn-rename-chip-${chipKey}`}
                    type="button"
                    onClick={() => setFolderInput(chip.value)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] font-medium'
                        : 'bg-[var(--surface)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] border-[var(--outline)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div id="div-renamedocumentmodal-6" className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] font-mono text-[var(--on-surface-variant)] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
            <span>{_(msg`Nueva ruta:`)} <strong>{formatDocumentPath(folderInput, name)}</strong></span>
          </div>

          <div id="div-renamedocumentmodal-7" className="pt-2.5 flex items-center justify-end gap-2 border-t border-[var(--outline)]">
            <button
              id="btn-cancel-rename-doc"
              type="button"
              onClick={onClose}
              className="btn-m3-text px-3 py-1 text-xs cursor-pointer"
            >
              {_(msg`Cancelar`)}
            </button>
            <button
              id="btn-submit-rename-doc"
              type="submit"
              disabled={!name.trim()}
              className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm"
            >
              {_(msg`Guardar Cambios`)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
