import React, { useMemo, useState } from 'react';
import { TaskDocument, BranchConfig } from '../services/workspaceService';
import { scanTaskBlocks } from '../utils/markdownSync';

interface TaskDocumentExplorerProps {
  branch: BranchConfig;
  activeDocumentId: string;
  onSelectDocument: (docId: string) => void;
  onOpenNewDocumentModal: (presetFolder?: string) => void;
  onOpenNewFolderModal: () => void;
  onOpenRenameFolderModal: (folder: string, count: number) => void;
  onRenameDocument: (docId: string, currentName: string, currentFolder: string) => void;
  onDuplicateDocument: (docId: string) => void;
  onDeleteDocument: (docId: string, docPath: string) => void;
  onExportDocument: (doc: TaskDocument) => void;
}

export const TaskDocumentExplorer: React.FC<TaskDocumentExplorerProps> = ({
  branch,
  activeDocumentId,
  onSelectDocument,
  onOpenNewDocumentModal,
  onOpenNewFolderModal,
  onOpenRenameFolderModal,
  onRenameDocument,
  onDuplicateDocument,
  onDeleteDocument,
  onExportDocument,
}) => {
  // Collapsed folders state (all open by default)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [activeMenuFolder, setActiveMenuFolder] = useState<string | null>(null);

  // Separate root documents and folder-based documents
  const { rootDocuments, folderGroups } = useMemo(() => {
    const rootDocs: TaskDocument[] = [];
    const folderMap: Record<string, TaskDocument[]> = {};

    branch.taskDocuments.forEach((doc) => {
      const isRoot = !doc.folder || doc.folder === 'root' || doc.folder === '/' || doc.folder === '.';
      if (isRoot) {
        rootDocs.push(doc);
      } else {
        if (!folderMap[doc.folder]) {
          folderMap[doc.folder] = [];
        }
        folderMap[doc.folder].push(doc);
      }
    });

    const sortedFolderKeys = Object.keys(folderMap).sort((a, b) => a.localeCompare(b));
    return {
      rootDocuments: rootDocs,
      folderGroups: sortedFolderKeys.map((key) => ({
        folder: key,
        documents: folderMap[key],
      })),
    };
  }, [branch.taskDocuments]);

  const toggleFolder = (folder: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folder]: !prev[folder],
    }));
  };

  const renderDocumentRow = (doc: TaskDocument, isInFolder: boolean = false) => {
    const isActive = doc.id === activeDocumentId;
    const { taskBlocks } = scanTaskBlocks(doc.content);
    const totalTasks = taskBlocks.length;
    const completedTasks = taskBlocks.filter(
      (b) => b.rawTaskLine.includes('[x]') || b.rawTaskLine.includes('[X]')
    ).length;
    const hasUnsaved = doc.content !== doc.lastSavedContent;

    return (
      <div
        key={doc.id}
        className={`group relative flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
          isActive
            ? 'bg-[var(--primary-container)]/35 text-[var(--primary)] font-medium border border-[var(--primary)]/30'
            : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
        } ${isInFolder ? '' : ''}`}
        onClick={() => onSelectDocument(doc.id)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="material-symbols-outlined text-[14px] shrink-0 text-sky-400">
            description
          </span>
          <span className="font-mono text-[11px] truncate">{doc.name}</span>
          {hasUnsaved && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
              title="Cambios sin guardar"
            />
          )}
        </div>

        {/* Task Count Badge & Context Menu */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-mono opacity-80 bg-[var(--surface)] px-1 rounded border border-[var(--outline)]">
            {completedTasks}/{totalTasks}
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
              }}
              className="btn-m3-icon w-5 h-5 opacity-0 group-hover:opacity-100 hover:text-[var(--on-surface)] cursor-pointer"
              title="Opciones de archivo"
            >
              <span className="material-symbols-outlined text-[13px]">more_vert</span>
            </button>

            {/* Dropdown Options */}
            {activeMenuDocId === doc.id && (
              <div
                className="absolute right-0 top-full mt-1 w-44 bg-[var(--surface-container)] border border-[var(--outline)] rounded-md shadow-xl py-1 z-50 animate-fade-in"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuDocId(null);
                    onRenameDocument(doc.id, doc.name, doc.folder);
                  }}
                  className="w-full px-2.5 py-1 text-left text-xs text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  <span>Renombrar / Mover</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuDocId(null);
                    onDuplicateDocument(doc.id);
                  }}
                  className="w-full px-2.5 py-1 text-left text-xs text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>Duplicar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMenuDocId(null);
                    onExportDocument(doc);
                  }}
                  className="w-full px-2.5 py-1 text-left text-xs text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  <span>Descargar .md</span>
                </button>

                {branch.taskDocuments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuDocId(null);
                      onDeleteDocument(doc.id, doc.path);
                    }}
                    className="w-full px-2.5 py-1 text-left text-xs text-[var(--error)] hover:bg-rose-950/30 flex items-center gap-1.5 border-t border-[var(--outline)] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>Eliminar</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1 select-none">
      {/* Header with Title and Quick Add Buttons */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-[var(--primary)]">
            folder_special
          </span>
          <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
            Task MD ({branch.taskDocuments.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenNewFolderModal}
            className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-0.5 font-medium"
            title="Crear una nueva carpeta con nombre personalizado"
          >
            <span className="material-symbols-outlined text-[13px]">create_new_folder</span>
            <span>+ Carpeta</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenNewDocumentModal('')}
            className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-0.5 font-medium"
            title="Crear un nuevo archivo Task MD en la raíz"
          >
            <span className="material-symbols-outlined text-[13px]">note_add</span>
            <span>+ Archivo</span>
          </button>
        </div>
      </div>

      {/* Document and Folder Tree */}
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
        {/* 1. Root documents (rendered directly without any "Raíz" header label) */}
        {rootDocuments.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {rootDocuments.map((doc) => renderDocumentRow(doc, false))}
          </div>
        )}

        {/* 2. Folder groups (only rendered when real subfolders exist) */}
        {folderGroups.map(({ folder, documents }) => {
          const isCollapsed = Boolean(collapsedFolders[folder]);
          const folderLabel = `${folder}/`;

          return (
            <div key={folder} className="flex flex-col mt-1">
              {/* Folder Heading */}
              <div className="flex items-center justify-between px-2 py-1 rounded hover:bg-[var(--surface-container-high)] text-xs text-[var(--on-surface-variant)] group cursor-pointer">
                <button
                  type="button"
                  onClick={() => toggleFolder(folder)}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left font-mono font-medium text-[11px] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px] text-[var(--on-surface-variant)]">
                    {isCollapsed ? 'chevron_right' : 'expand_more'}
                  </span>
                  <span className="material-symbols-outlined text-[14px] text-amber-400">
                    folder
                  </span>
                  <span className="truncate text-[var(--on-surface)]">{folderLabel}</span>
                </button>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNewDocumentModal(folder);
                    }}
                    className="btn-m3-icon w-5 h-5 text-[var(--on-surface-variant)] hover:text-[var(--primary)] cursor-pointer"
                    title={`Añadir Task MD dentro de "${folderLabel}"`}
                  >
                    <span className="material-symbols-outlined text-[13px]">add</span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuFolder(activeMenuFolder === folder ? null : folder);
                      }}
                      className="btn-m3-icon w-5 h-5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
                      title="Opciones de carpeta"
                    >
                      <span className="material-symbols-outlined text-[13px]">more_horiz</span>
                    </button>

                    {activeMenuFolder === folder && (
                      <div
                        className="absolute right-0 top-full mt-1 w-44 bg-[var(--surface-container)] border border-[var(--outline)] rounded-md shadow-xl py-1 z-50 animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuFolder(null);
                            onOpenRenameFolderModal(folder, documents.length);
                          }}
                          className="w-full px-2.5 py-1 text-left text-xs text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] flex items-center gap-1.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">drive_file_rename_outline</span>
                          <span>Renombrar carpeta</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Document List in Folder */}
              {!isCollapsed && (
                <div className="flex flex-col gap-0.5 pl-4 border-l border-[var(--outline)] ml-3 my-0.5">
                  {documents.map((doc) => renderDocumentRow(doc, true))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
