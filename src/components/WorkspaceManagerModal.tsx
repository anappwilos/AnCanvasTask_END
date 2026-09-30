import React, { useState } from 'react';
import {
  Workspace,
  parseGitHubRepoInput,
  TaskDocument,
} from '../services/workspaceService';

interface WorkspaceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (id: string) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onSyncWorkspacesToSanity?: () => Promise<void>;
  onImportWorkspacesFromSanity?: () => Promise<void>;
  onSaveSingleWorkspaceToSanity?: (ws: Workspace) => Promise<void>;
  onOpenSyncDiffModal?: () => void;
  isSanityConfigured?: boolean;
}

export const WorkspaceManagerModal: React.FC<WorkspaceManagerModalProps> = ({
  isOpen,
  onClose,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  onShowToast,
  onSyncWorkspacesToSanity,
  onImportWorkspacesFromSanity,
  onSaveSingleWorkspaceToSanity,
  onOpenSyncDiffModal,
  isSanityConfigured = false,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [isSyncingSanity, setIsSyncingSanity] = useState<boolean>(false);
  const [isImportingSanity, setIsImportingSanity] = useState<boolean>(false);
  const [savingWsId, setSavingWsId] = useState<string | null>(null);

  // Form state for creating new workspace
  const [name, setName] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [description, setDescription] = useState('');

  // Inline delete confirmation state (workspace id to delete)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !repoInput.trim()) {
      onShowToast('Por favor completa el nombre del workspace y el repositorio de GitHub', 'warning');
      return;
    }

    const repoInfo = parseGitHubRepoInput(repoInput);
    const wsId = 'ws_' + Date.now();
    const branchName = defaultBranch.trim() || 'main';

    const initialDocs: TaskDocument[] = [
      {
        id: `doc_root_${Date.now()}`,
        name: 'TASKS.md',
        folder: '',
        path: 'TASKS.md',
        content: `# ${name.trim()} - Tareas del Repositorio\n\n## Tareas Iniciales\n- [ ] Configurar entorno y estructura del proyecto\n  id: init_task_1\n  priority: P0\n- [ ] Definir arquitectura y dependencias\n  id: init_task_2\n  priority: P1\n`,
        lastSavedContent: `# ${name.trim()} - Tareas del Repositorio\n\n## Tareas Iniciales\n- [ ] Configurar entorno y estructura del proyecto\n  id: init_task_1\n  priority: P0\n- [ ] Definir arquitectura y dependencias\n  id: init_task_2\n  priority: P1\n`,
        updatedAt: new Date().toISOString(),
      },
    ];

    const newWorkspace: Workspace = {
      id: wsId,
      name: name.trim(),
      githubRepo: {
        ...repoInfo,
        defaultBranch: branchName,
        isPrivate: false,
        description: description.trim() || undefined,
      },
      activeBranchName: branchName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      branches: [
        {
          name: branchName,
          isProtected: branchName === 'main' || branchName === 'master',
          lastCommit: {
            hash: Math.random().toString(16).substring(2, 9),
            message: `chore: inicializar workspace ${name.trim()} vinculado a ${repoInfo.fullName}`,
            author: 'Developer',
            timestamp: new Date().toISOString(),
          },
          activeDocumentId: initialDocs[0].id,
          taskDocuments: initialDocs,
        },
      ],
    };

    onCreateWorkspace(newWorkspace);
    onShowToast(`Workspace "${name.trim()}" creado y vinculado a GitHub`, 'success');
    setName('');
    setRepoInput('');
    setDescription('');
    setActiveTab('list');
  };

  const handleConfirmDelete = (wsId: string) => {
    onDeleteWorkspace(wsId);
    setConfirmDeleteId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-lg sm:rounded-lg shadow-xl flex flex-col overflow-hidden max-h-[90vh] pb-safe sm:pb-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-manager-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <h2 id="ws-manager-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
              Gestión de Workspaces & Repositorios GitHub
            </h2>
          </div>
          <button type="button" onClick={onClose} className="btn-m3-icon w-7 h-7 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[var(--outline)] px-4 bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'list'
                ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                : 'border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            }`}
          >
            Mis Workspaces ({workspaces.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'create'
                ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                : 'border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            }`}
          >
            + Conectar / Crear Workspace
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'list' ? (
            <div className="flex flex-col gap-3">
              {/* Sanity Cloud Persistence Bar */}
              <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--outline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-rose-600 flex items-center justify-center text-white font-bold text-[10px] shadow-xs shrink-0">
                    S
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-[var(--on-surface)]">Estructura en Sanity</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${
                          isSanityConfigured
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {isSanityConfigured ? 'Conectado' : 'Sin configurar'}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--on-surface-variant)] truncate">
                      Sincroniza y almacena tus workspaces como esquemas nativos en Sanity
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {onOpenSyncDiffModal && (
                    <button
                      type="button"
                      disabled={!isSanityConfigured}
                      onClick={onOpenSyncDiffModal}
                      className="btn-m3-primary px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                      title="Analizar y resolver diferencias, overrides y conflictos con Sanity Cloud"
                    >
                      <span className="material-symbols-outlined text-[14px]">sync_problem</span>
                      <span>Sincronizar & Overrides</span>
                    </button>
                  )}

                  {onSyncWorkspacesToSanity && (
                    <button
                      type="button"
                      disabled={isSyncingSanity || !isSanityConfigured}
                      onClick={async () => {
                        setIsSyncingSanity(true);
                        try {
                          await onSyncWorkspacesToSanity();
                        } finally {
                          setIsSyncingSanity(false);
                        }
                      }}
                      className="btn-m3-secondary px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Guardar todos los workspaces en Sanity Cloud"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isSyncingSanity ? 'animate-spin' : ''}`}>
                        {isSyncingSanity ? 'refresh' : 'cloud_upload'}
                      </span>
                      <span>{isSyncingSanity ? 'Sincronizando...' : 'Guardar'}</span>
                    </button>
                  )}

                  {onImportWorkspacesFromSanity && (
                    <button
                      type="button"
                      disabled={isImportingSanity || !isSanityConfigured}
                      onClick={async () => {
                        setIsImportingSanity(true);
                        try {
                          await onImportWorkspacesFromSanity();
                        } finally {
                          setIsImportingSanity(false);
                        }
                      }}
                      className="btn-m3-secondary px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Cargar workspaces remotos desde Sanity Cloud"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isImportingSanity ? 'animate-spin' : ''}`}>
                        {isImportingSanity ? 'refresh' : 'cloud_download'}
                      </span>
                      <span>{isImportingSanity ? 'Importando...' : 'Cargar'}</span>
                    </button>
                  )}
                </div>
              </div>

              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                const totalDocs = ws.branches.reduce(
                  (acc, b) => acc + b.taskDocuments.length,
                  0
                );
                const isConfirmingThis = confirmDeleteId === ws.id;

                return (
                  <div
                    key={ws.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-[var(--primary-container)]/20 border-[var(--primary)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] hover:border-[var(--outline-variant)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--on-surface)] font-sans truncate">
                            {ws.name}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded bg-[var(--primary)] text-[var(--on-primary)] text-[10px] font-mono">
                              Activo
                            </span>
                          )}
                        </div>

                        {/* GitHub Repo info */}
                        <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--on-surface-variant)] mt-1">
                          <svg className="w-3.5 h-3.5 fill-current shrink-0 opacity-70" viewBox="0 0 24 24">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                          </svg>
                          <a
                            href={ws.githubRepo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--primary)] hover:underline truncate"
                          >
                            {ws.githubRepo.fullName}
                          </a>
                        </div>

                        {ws.githubRepo.description && (
                          <p className="text-xs text-[var(--on-surface-variant)] mt-1 line-clamp-1">
                            {ws.githubRepo.description}
                          </p>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--on-surface-variant)] mt-2">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-sky-400">fork_right</span>
                            <span>{ws.branches.length} ramas ({ws.activeBranchName})</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] text-amber-400">description</span>
                            <span>{totalDocs} Task MD</span>
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onSaveSingleWorkspaceToSanity && isSanityConfigured && (
                          <button
                            type="button"
                            disabled={savingWsId === ws.id}
                            onClick={async () => {
                              setSavingWsId(ws.id);
                              try {
                                await onSaveSingleWorkspaceToSanity(ws);
                              } finally {
                                setSavingWsId(null);
                              }
                            }}
                            className="btn-m3-icon w-7 h-7 text-[var(--on-surface-variant)] hover:text-emerald-400 cursor-pointer"
                            title="Guardar este workspace en Sanity"
                          >
                            <span className={`material-symbols-outlined text-[15px] ${savingWsId === ws.id ? 'animate-spin' : ''}`}>
                              {savingWsId === ws.id ? 'refresh' : 'cloud_upload'}
                            </span>
                          </button>
                        )}

                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectWorkspace(ws.id);
                              onClose();
                            }}
                            className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer"
                          >
                            Abrir
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(isConfirmingThis ? null : ws.id)}
                          className="btn-m3-icon w-7 h-7 text-[var(--on-surface-variant)] hover:text-rose-400 cursor-pointer"
                          title="Eliminar workspace"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Delete Confirmation (No window.confirm, 100% iframe safe) */}
                    {isConfirmingThis && (
                      <div className="mt-3 p-2.5 rounded bg-rose-950/30 border border-rose-800/40 flex items-center justify-between gap-2 animate-fade-in">
                        <div className="flex items-center gap-1.5 text-xs text-rose-300">
                          <span className="material-symbols-outlined text-[15px]">warning</span>
                          <span>¿Eliminar este workspace y todos sus archivos?</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded text-xs text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(ws.id)}
                            className="px-2.5 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium cursor-pointer shadow-sm"
                          >
                            Sí, eliminar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleCreate} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--on-surface)]">
                  Nombre del Workspace
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Ecommerce Monorepo, SaaS Backend..."
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--on-surface)]">
                  Repositorio de GitHub (URL o usuario/repo)
                </label>
                <input
                  type="text"
                  required
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="ej. organizacion/mi-repo o https://github.com/org/repo"
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--on-surface)]">
                  Rama por defecto
                </label>
                <input
                  type="text"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  placeholder="main"
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--on-surface)]">
                  Descripción (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve resumen del propósito de este workspace"
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--outline)]">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="btn-m3-text px-3 py-1 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || !repoInput.trim()}
                  className="btn-m3-primary px-4 py-1.5 text-xs cursor-pointer shadow-sm"
                >
                  Crear Workspace
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[var(--surface)] border-t border-[var(--outline)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-m3-secondary px-3.5 py-1 text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
