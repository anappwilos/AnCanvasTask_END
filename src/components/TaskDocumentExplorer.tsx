import React, { useMemo, useState, useRef, useEffect } from 'react';
import { TaskDocument, BranchConfig, Workspace } from '../services/workspaceService';
import { scanTaskBlocks } from '../utils/markdownSync';

interface TaskDocumentExplorerProps {
  workspace: Workspace;
  allWorkspaces: Workspace[];
  activeBranch: BranchConfig;
  activeDocumentId: string;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectBranch: (branchName: string) => void;
  onOpenWorkspaceManager: () => void;
  onOpenCreateBranch: () => void;
  onOpenGitHubSync: () => void;
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
  workspace,
  allWorkspaces = [],
  activeBranch,
  activeDocumentId,
  onSelectWorkspace,
  onSelectBranch,
  onOpenWorkspaceManager,
  onOpenCreateBranch,
  onOpenGitHubSync,
  onSelectDocument,
  onOpenNewDocumentModal,
  onOpenNewFolderModal,
  onOpenRenameFolderModal,
  onRenameDocument,
  onDuplicateDocument,
  onDeleteDocument,
  onExportDocument,
}) => {
  const branch = activeBranch;
  const safeTaskDocuments = branch?.taskDocuments || [];
  const safeBranches = workspace?.branches || [];

  // Dropdown menus for Workspace and Branch
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);

  const wsDropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wsDropdownRef.current && !wsDropdownRef.current.contains(e.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
      if (branchDropdownRef.current && !branchDropdownRef.current.contains(e.target as Node)) {
        setIsBranchMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Collapsed folders state (all open by default)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [activeMenuDocId, setActiveMenuDocId] = useState<string | null>(null);
  const [activeMenuFolder, setActiveMenuFolder] = useState<string | null>(null);

  // Separate root documents and folder-based documents
  const { rootDocuments, folderGroups } = useMemo(() => {
    const rootDocs: TaskDocument[] = [];
    const folderMap: Record<string, TaskDocument[]> = {};

    safeTaskDocuments.forEach((doc) => {
      if (!doc) return;
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
        documents: folderMap[key] || [],
      })),
    };
  }, [safeTaskDocuments]);

  const toggleFolder = (folder: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folder]: !prev[folder],
    }));
  };

  const renderDocumentRow = (doc: TaskDocument, isInFolder: boolean = false) => {
    if (!doc) return null;
    const isActive = doc.id === activeDocumentId;
    const { taskBlocks } = scanTaskBlocks(doc.content || '');
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
        }`}
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

                {safeTaskDocuments.length > 1 && (
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
    <div className="flex flex-col gap-1.5 select-none">
      {/* 1. Integrated Workspace & Branch Bar */}
      <div className="relative flex items-center gap-1 pb-2 border-b border-[var(--outline)]">
        {/* Workspace Dropdown */}
        <div className="flex-1 min-w-0" ref={wsDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setIsWorkspaceMenuOpen((prev) => !prev);
              setIsBranchMenuOpen(false);
            }}
            className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] border border-[var(--outline)] text-xs text-[var(--on-surface)] transition-colors cursor-pointer"
            title={`Workspace: ${workspace?.name || 'Principal'}`}
          >
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <svg className="w-3.5 h-3.5 fill-current shrink-0 opacity-80" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="font-semibold truncate">{workspace?.name || 'Principal'}</span>
            </div>
            <span className="material-symbols-outlined text-[14px] text-[var(--on-surface-variant)] shrink-0">
              arrow_drop_down
            </span>
          </button>
        </div>

        {/* Branch Dropdown */}
        <div className="flex-1 min-w-0" ref={branchDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setIsBranchMenuOpen((prev) => !prev);
              setIsWorkspaceMenuOpen(false);
            }}
            className="w-full flex items-center justify-between gap-1 px-2 py-1 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-high)] border border-[var(--outline)] text-xs font-mono text-[var(--on-surface)] transition-colors cursor-pointer"
            title={`Rama actual: ${branch?.name || 'main'}`}
          >
            <div className="flex items-center gap-1 min-w-0 truncate">
              <span className="material-symbols-outlined text-[13px] text-sky-400 shrink-0">
                fork_right
              </span>
              <span className="font-medium truncate">{branch?.name || 'main'}</span>
            </div>
            <span className="material-symbols-outlined text-[14px] text-[var(--on-surface-variant)] shrink-0">
              arrow_drop_down
            </span>
          </button>
        </div>

        {/* Workspace Dropdown Menu (Full Width of Header to Prevent Any Text Clipping) */}
        {isWorkspaceMenuOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--surface-container)] border border-[var(--outline)] rounded-md shadow-2xl py-1 z-50 animate-fade-in select-none">
            <div className="px-3 py-1.5 border-b border-[var(--outline)] flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                Workspaces ({allWorkspaces.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsWorkspaceMenuOpen(false);
                  onOpenWorkspaceManager();
                }}
                className="text-[10px] text-[var(--primary)] hover:underline cursor-pointer font-medium"
              >
                Administrar
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto py-1">
              {allWorkspaces.map((ws) => {
                const isCurrent = ws.id === workspace?.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      setIsWorkspaceMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[var(--primary-container)]/30 text-[var(--primary)] font-medium'
                        : 'text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold truncate">{ws.name}</span>
                      <span className="text-[10px] font-mono text-[var(--on-surface-variant)] truncate">
                        {ws.githubRepo?.fullName || 'GitHub'}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-1 border-t border-[var(--outline)] px-2 py-1">
              <button
                type="button"
                onClick={() => {
                  setIsWorkspaceMenuOpen(false);
                  onOpenWorkspaceManager();
                }}
                className="btn-m3-secondary w-full py-1 text-xs justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>+ Nuevo Workspace</span>
              </button>
            </div>
          </div>
        )}

        {/* Branch Dropdown Menu (Full Width of Header to Prevent Any Text Clipping) */}
        {isBranchMenuOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-[var(--surface-container)] border border-[var(--outline)] rounded-md shadow-2xl py-1 z-50 animate-fade-in select-none">
            <div className="px-3 py-1.5 border-b border-[var(--outline)] flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                Ramas ({safeBranches.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsBranchMenuOpen(false);
                  onOpenGitHubSync();
                }}
                className="text-[10px] text-sky-400 hover:underline cursor-pointer font-medium flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[12px]">sync</span>
                <span>Git Status</span>
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto py-1">
              {safeBranches.map((b) => {
                const isCurrent = b.name === branch?.name;
                const docCount = b.taskDocuments?.length || 0;
                return (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => {
                      onSelectBranch(b.name);
                      setIsBranchMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[var(--primary-container)]/30 text-[var(--primary)] font-medium'
                        : 'text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 truncate font-mono">
                      <span className="material-symbols-outlined text-[13px] text-sky-400 shrink-0">
                        fork_right
                      </span>
                      <span className="truncate">{b.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--on-surface-variant)] shrink-0">
                      {docCount} doc{docCount !== 1 ? 's' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-1 border-t border-[var(--outline)] px-2 py-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsBranchMenuOpen(false);
                  onOpenCreateBranch();
                }}
                className="btn-m3-secondary flex-1 py-1 text-xs justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[13px]">add</span>
                <span>+ Nueva Rama</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Files & Folders Header with Title and Quick Add Buttons */}
      <div className="flex items-center justify-between px-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[15px] text-[var(--primary)]">
            folder_special
          </span>
          <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
            TASK MD ({safeTaskDocuments.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenNewFolderModal}
            className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-0.5 font-medium"
            title="Crear una nueva carpeta"
          >
            <span className="material-symbols-outlined text-[13px]">create_new_folder</span>
            <span>+ Carpeta</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenNewDocumentModal('')}
            className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-0.5 font-medium"
            title="Crear un nuevo archivo Task MD"
          >
            <span className="material-symbols-outlined text-[13px]">note_add</span>
            <span>+ Archivo</span>
          </button>
        </div>
      </div>

      {/* 3. Document and Folder Tree */}
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
        {/* Root documents */}
        {rootDocuments.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {rootDocuments.map((doc) => renderDocumentRow(doc, false))}
          </div>
        )}

        {/* Folder groups */}
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
