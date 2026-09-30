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
  const [name, setName] = useState(initialName);
  const [folder, setFolder] = useState(initialFolder || 'root');
  const [customFolder, setCustomFolder] = useState('');
  const [isCustomFolder, setIsCustomFolder] = useState(false);

  useEffect(() => {
    setName(initialName);
    setFolder(initialFolder || 'root');
    setCustomFolder('');
    setIsCustomFolder(false);
  }, [initialName, initialFolder, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || 'TASKS.md';
    const finalFolder = isCustomFolder
      ? customFolder.trim()
      : folder === 'root' || folder === '/'
      ? ''
      : folder;

    const newPath = formatDocumentPath(finalFolder, cleanName);
    onRename(docId, cleanName, finalFolder);
    onShowToast(`Archivo actualizado a "${newPath}"`, 'success');
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
        aria-labelledby="rename-doc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-sky-400">edit_note</span>
            <h2 id="rename-doc-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
              Renombrar / Mover Archivo Task MD
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-m3-icon w-7 h-7 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--on-surface)]">
              Nombre del archivo
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
                value={customFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                placeholder="ej. frontend, backend, packages/core..."
                className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
              />
            ) : (
              <select
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
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

          <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] font-mono text-[var(--on-surface-variant)] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
            <span>Nueva ruta: <strong>{formatDocumentPath(isCustomFolder ? customFolder : folder === 'root' ? '' : folder, name)}</strong></span>
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
              disabled={!name.trim()}
              className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
