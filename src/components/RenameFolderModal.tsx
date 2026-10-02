import React, { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";

interface RenameFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolder: string;
  docCount: number;
  onRenameFolder: (oldFolder: string, newFolder: string) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const RenameFolderModal: React.FC<RenameFolderModalProps> = ({
  isOpen,
  onClose,
  currentFolder,
  docCount,
  onRenameFolder,
  onShowToast,
}) => {
  const { t } = useTranslation();
  const [newFolderInput, setNewFolderInput] = useState(currentFolder);

  useEffect(() => {
    setNewFolderInput(currentFolder);
  }, [currentFolder, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNewFolder = newFolderInput.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanNewFolder) {
      onShowToast(t('toast.enterValidFolderName'), 'warning');
      return;
    }

    if (cleanNewFolder === currentFolder) {
      onClose();
      return;
    }

    onRenameFolder(currentFolder, cleanNewFolder);
    onShowToast(`Carpeta renombrada de "${currentFolder}/" a "${cleanNewFolder}/"`, 'success');
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
        aria-labelledby="rename-folder-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-amber-400">drive_file_rename_outline</span>
            <h2 id="rename-folder-modal-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
              Renombrar Carpeta
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-m3-icon w-7 h-7 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--on-surface)]">
              Nombre de la carpeta
            </label>
            <input
              type="text"
              required
              autoFocus
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              placeholder="ej. frontend, apps/web, services/core..."
              className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
            />
          </div>

          <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface-variant)] leading-relaxed">
            Se actualizará la ruta de los <strong>{docCount}</strong> archivo{docCount > 1 ? 's' : ''} Task MD contenidos en <code className="font-mono text-[var(--on-surface)]">{currentFolder}/</code>.
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
              disabled={!newFolderInput.trim()}
              className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm"
            >
              Renombrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
