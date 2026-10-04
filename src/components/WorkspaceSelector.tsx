import React, { useState, useRef, useEffect } from 'react';
import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Workspace, BranchConfig, logWorkspaceTrace } from '../services/workspaceService';

interface WorkspaceSelectorProps {
  workspace: Workspace;
  allWorkspaces: Workspace[];
  activeBranch: BranchConfig;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectBranch: (branchName: string) => void;
  onOpenWorkspaceManager: () => void;
  onOpenCreateBranch: () => void;
  onOpenGitHubSync: () => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspace,
  allWorkspaces,
  activeBranch,
  onSelectWorkspace,
  onSelectBranch,
  onOpenWorkspaceManager,
  onOpenCreateBranch,
  onOpenGitHubSync,
}) => {
  const { i18n } = useLingui();
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

  return (
    <div id="div-workspaceselector-1" className="flex items-center gap-1 sm:gap-1.5 shrink-0">
      {/* Workspace & GitHub Repo Picker Dropdown */}
      <div id="div-workspaceselector-2" className="relative" ref={wsDropdownRef}>
        <button
          id="btn-workspace-selector-trigger"
          type="button"
          onClick={() => {
            setIsWorkspaceMenuOpen((prev) => !prev);
            setIsBranchMenuOpen(false);
          }}
          className="btn-m3-secondary flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-sans font-medium cursor-pointer shrink-0"
          title={`Workspace: ${workspace?.name || 'Principal'} (GitHub: ${workspace?.githubRepo?.fullName || 'GitHub'})`}
        >
          {/* GitHub Icon */}
          <svg className="w-3.5 h-3.5 fill-current shrink-0 opacity-80" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>

          <span className="font-semibold truncate max-w-[70px] sm:max-w-[120px]">
            {workspace?.name || 'Principal'}
          </span>

          <span className="material-symbols-outlined text-[14px] text-[var(--on-surface-variant)] shrink-0">
            arrow_drop_down
          </span>
        </button>

        {/* Workspace Dropdown Menu */}
        {isWorkspaceMenuOpen && (
          <div id="div-workspaceselector-3" className="absolute left-0 top-full mt-1 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] bg-[var(--surface-container)] border border-[var(--outline)] rounded-md shadow-md py-1 z-50 animate-fade-in select-none">
            <div id="div-workspaceselector-4" className="px-3 py-1.5 border-b border-[var(--outline)] flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                {i18n._(msg`Workspaces`)}
              </span>
              <button
                id="btn-manage-workspaces-header"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  logWorkspaceTrace('Clic en botón Administrar desde Barra Superior -> abriendo WorkspaceManagerModal');
                  setIsWorkspaceMenuOpen(false);
                  onOpenWorkspaceManager();
                }}
                className="text-[10px] text-[var(--primary)] hover:underline cursor-pointer font-medium"
              >
                {i18n._(msg`Administrar`)}
              </button>
            </div>

            <div id="div-workspaceselector-5" className="max-h-56 overflow-y-auto py-1">
              {(allWorkspaces || []).map((ws) => {
                const isCurrent = ws.id === workspace?.id;
                const totalDocs = (ws.branches || []).reduce(
                  (acc, b) => acc + (b.taskDocuments?.length || 0),
                  0
                );
                return (
                  <button
                    key={ws.id}
                    id={`btn-select-workspace-${ws.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      logWorkspaceTrace(`Clic para seleccionar Workspace desde Barra Superior: "${ws.name}" (${ws.id})`, {
                        id: ws.id,
                        name: ws.name,
                        esActual: isCurrent,
                      });
                      onSelectWorkspace(ws.id);
                      setIsWorkspaceMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[var(--primary-container)]/30 text-[var(--primary)] font-medium'
                        : 'text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <div id="div-workspaceselector-6" className="flex flex-col min-w-0">
                      <div id="div-workspaceselector-7" className="flex items-center gap-1.5">
                        <span className="font-semibold truncate">{ws.name}</span>
                        {isCurrent && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[var(--on-surface-variant)] truncate">
                        {ws.githubRepo?.fullName || 'GitHub'}
                      </span>
                    </div>

                    <div id="div-workspaceselector-8" className="flex flex-col items-end shrink-0 text-[10px] font-mono text-[var(--on-surface-variant)]">
                      <span>{(ws.branches || []).length} {i18n._(msg`Ramas`).toLowerCase()}</span>
                      <span>{totalDocs} {i18n._(msg`Task MD`)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div id="div-workspaceselector-9" className="pt-1 border-t border-[var(--outline)] px-2 py-1">
              <button
                id="btn-new-workspace-dropdown"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  logWorkspaceTrace('Clic en + Nuevo Workspace desde Barra Superior -> abriendo WorkspaceManagerModal');
                  setIsWorkspaceMenuOpen(false);
                  onOpenWorkspaceManager();
                }}
                className="btn-m3-secondary w-full py-1 text-xs justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>+ {i18n._(msg`Nuevo Workspace`)}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Branch Selector Dropdown */}
      <div id="div-workspaceselector-10" className="relative" ref={branchDropdownRef}>
        <button
          id="btn-branch-selector-trigger"
          type="button"
          onClick={() => {
            setIsBranchMenuOpen((prev) => !prev);
            setIsWorkspaceMenuOpen(false);
          }}
          className="btn-m3-secondary flex items-center gap-1.5 px-2 sm:px-2.5 py-1 text-xs font-mono font-medium cursor-pointer shrink-0"
          title={`${i18n._(msg`Rama actual`)}: ${activeBranch?.name || 'main'}`}
        >
          <span className="material-symbols-outlined text-[14px] text-sky-400 shrink-0">
            fork_right
          </span>
          <span className="font-medium truncate max-w-[70px] sm:max-w-[120px]">
            {activeBranch?.name || 'main'}
          </span>
          <span className="material-symbols-outlined text-[14px] text-[var(--on-surface-variant)] shrink-0">
            arrow_drop_down
          </span>
        </button>

        {/* Branch Dropdown Menu */}
        {isBranchMenuOpen && (
          <div id="div-workspaceselector-11" className="absolute left-0 top-full mt-1 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)] bg-[var(--surface-container)] border border-[var(--outline)] rounded-md shadow-md py-1 z-50 animate-fade-in select-none">
            <div id="div-workspaceselector-12" className="px-3 py-1.5 border-b border-[var(--outline)] flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                {i18n._(msg`Ramas`)} ({(workspace?.branches || []).length})
              </span>
              <button
                id="btn-sync-github-branch-header"
                type="button"
                onClick={() => {
                  setIsBranchMenuOpen(false);
                  onOpenGitHubSync();
                }}
                className="text-[10px] text-[var(--primary)] hover:underline cursor-pointer font-medium flex items-center gap-0.5"
              >
                <span className="material-symbols-outlined text-[12px]">sync</span>
                <span>{i18n._(msg`Sincronizar con GitHub`)}</span>
              </button>
            </div>

            <div id="div-workspaceselector-13" className="max-h-56 overflow-y-auto py-1">
              {(workspace?.branches || []).map((b) => {
                const isCurrent = b.name === activeBranch?.name;
                const docCount = b.taskDocuments?.length || 0;
                return (
                  <button
                    key={b.name}
                    id={`btn-select-branch-${b.name}`}
                    type="button"
                    onClick={() => {
                      onSelectBranch(b.name);
                      setIsBranchMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-start justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[var(--primary-container)]/30 text-[var(--primary)] font-medium'
                        : 'text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <div id="div-workspaceselector-14" className="flex flex-col min-w-0">
                      <div id="div-workspaceselector-15" className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-sky-400 shrink-0">
                          fork_right
                        </span>
                        <span className="font-mono font-medium truncate">{b.name}</span>
                        {b.isProtected && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/60 border border-amber-700/60 text-amber-300">
                            lock
                          </span>
                        )}
                      </div>
                      {b.lastCommit && (
                        <span className="text-[10px] text-[var(--on-surface-variant)] truncate pl-5">
                          {b.lastCommit.message}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-[var(--on-surface-variant)] shrink-0 pt-0.5">
                      {docCount} doc{docCount !== 1 ? 's' : ''}
                    </span>
                  </button>
                );
              })}
            </div>

            <div id="div-workspaceselector-16" className="pt-1 border-t border-[var(--outline)] px-2 py-1 flex items-center gap-1.5">
              <button
                id="btn-new-branch-dropdown"
                type="button"
                onClick={() => {
                  setIsBranchMenuOpen(false);
                  onOpenCreateBranch();
                }}
                className="btn-m3-secondary flex-1 py-1 text-xs justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>+ {i18n._(msg`Nueva rama`)}</span>
              </button>

              <button
                id="btn-commit-sync-branch-dropdown"
                type="button"
                onClick={() => {
                  setIsBranchMenuOpen(false);
                  onOpenGitHubSync();
                }}
                className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer text-sky-400"
                title={i18n._(msg`Sincronizar con GitHub`)}
              >
                <span className="material-symbols-outlined text-[14px]">commit</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* GitHub Repo Quick External Link */}
      {workspace.githubRepo.url && (
        <a
          href={workspace.githubRepo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-m3-icon w-6 h-6 hidden lg:inline-flex shrink-0 opacity-70 hover:opacity-100"
          title={`Abrir ${workspace.githubRepo.fullName} en GitHub`}
        >
          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
        </a>
      )}
    </div>
  );
};
