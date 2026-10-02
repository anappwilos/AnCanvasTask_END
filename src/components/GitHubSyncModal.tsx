import React, { useState } from 'react';
import { Workspace, BranchConfig } from '../services/workspaceService';

interface GitHubSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  branch: BranchConfig;
  githubToken?: string;
  onSaveGitHubToken: (token: string) => void;
  onCommitBranch: (commitMessage: string, author: string) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const GitHubSyncModal: React.FC<GitHubSyncModalProps> = ({
  isOpen,
  onClose,
  workspace,
  branch,
  githubToken,
  onSaveGitHubToken,
  onCommitBranch,
  onShowToast,
}) => {
  const [tokenInput, setTokenInput] = useState(githubToken || '');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [authorName, setAuthorName] = useState('Nico Alarcones');
  const [activeTab, setActiveTab] = useState<'commit' | 'history' | 'settings'>('commit');

  if (!isOpen) return null;

  // Identify modified files in branch
  const modifiedDocs = branch.taskDocuments.filter(
    (doc) => doc.content !== doc.lastSavedContent
  );

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) {
      onShowToast('Por favor escribe un mensaje de commit', 'warning');
      return;
    }

    onCommitBranch(commitMessage.trim(), authorName.trim() || 'Developer');
    onShowToast(`Cambios confirmados en la rama "${branch.name}"`, 'success');
    setCommitMessage('');
  };

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingToken(true);
    setTimeout(() => {
      onSaveGitHubToken(tokenInput.trim());
      setIsSavingToken(false);
      onShowToast(
        tokenInput.trim()
          ? 'GitHub Personal Access Token configurado'
          : 'Token de GitHub eliminado',
        'success'
      );
    }, 200);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-lg sm:rounded-lg shadow-xl flex flex-col overflow-hidden max-h-[90vh] pb-safe sm:pb-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby="github-sync-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <div>
              <h2 id="github-sync-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
                GitHub Repository & Git Status
              </h2>
              <p className="text-[11px] font-mono text-[var(--on-surface-variant)]">
                {workspace.githubRepo.fullName} · rama: <strong>{branch.name}</strong>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn-m3-icon w-7 h-7 cursor-pointer">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--outline)] px-4 bg-[var(--surface)]">
          <button
            type="button"
            onClick={() => setActiveTab('commit')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'commit'
                ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                : 'border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            }`}
          >
            Confirmar Cambios ({modifiedDocs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'history'
                ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                : 'border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            }`}
          >
            Historial de Commits
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                : 'border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
            }`}
          >
            Token & Conexión
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {activeTab === 'commit' ? (
            <div className="flex flex-col gap-3.5">
              {/* Changed files list */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--on-surface)]">
                  Archivos Task MD en esta rama:
                </span>
                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                  {branch.taskDocuments.map((doc) => {
                    const isMod = doc.content !== doc.lastSavedContent;
                    return (
                      <div
                        key={doc.id}
                        className={`px-2.5 py-1.5 rounded border text-xs font-mono flex items-center justify-between ${
                          isMod
                            ? 'bg-amber-950/20 border-amber-700/60 text-amber-200'
                            : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isMod ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="truncate">{doc.path}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold shrink-0">
                          {isMod ? 'Modificado' : 'Al día'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Commit form */}
              <form onSubmit={handleCommit} className="flex flex-col gap-3 pt-2 border-t border-[var(--outline)]">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--on-surface)]">
                    Mensaje de Commit
                  </label>
                  <input
                    type="text"
                    required
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="ej. feat(tasks): actualizar roadmap de autenticación y frontend"
                    className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-[var(--on-surface)]">
                    Autor del commit
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    disabled={!commitMessage.trim()}
                    className="btn-m3-primary px-4 py-1.5 text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[15px]">commit</span>
                    <span>Confirmar a {branch.name}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : activeTab === 'history' ? (
            <div className="flex flex-col gap-3">
              {branch.lastCommit ? (
                <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-sky-400 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">commit</span>
                      <span>#{branch.lastCommit.hash}</span>
                    </span>
                    <span className="text-[var(--on-surface-variant)] text-[10px]">
                      {new Date(branch.lastCommit.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--on-surface)]">
                    {branch.lastCommit.message}
                  </p>
                  <span className="text-[11px] text-[var(--on-surface-variant)]">
                    Por <strong>{branch.lastCommit.author}</strong> en rama <code>{branch.name}</code>
                  </span>
                </div>
              ) : (
                <p className="text-xs text-[var(--on-surface-variant)] text-center py-6">
                  No hay commits registrados en esta rama aún.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSaveToken} className="flex flex-col gap-3">
              <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] text-xs text-[var(--on-surface-variant)] leading-relaxed">
                Introduce un <strong>GitHub Personal Access Token (classic o fine-grained)</strong> para sincronizar ramas directamente con la API REST de GitHub.
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[var(--on-surface)]">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingToken}
                  className="btn-m3-primary px-4 py-1.5 text-xs cursor-pointer shadow-sm"
                >
                  {isSavingToken ? 'Guardando...' : 'Guardar Token'}
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
