import { CanvasVisualDocument } from './sanityService';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  isPrivate?: boolean;
  description?: string;
}

export interface TaskDocument {
  id: string;
  name: string;
  folder: string; // '' or 'root' for root level, 'frontend', 'backend', 'packages/core', etc.
  path: string; // e.g. 'TASKS.md', 'frontend/TASKS.md', 'backend/TASKS.md'
  content: string;
  lastSavedContent: string;
  updatedAt: string;
  visualState?: CanvasVisualDocument | null;
}

export interface BranchCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface BranchConfig {
  name: string;
  isProtected?: boolean;
  lastCommit?: BranchCommit;
  taskDocuments: TaskDocument[];
  activeDocumentId: string;
}

export interface Workspace {
  id: string;
  name: string;
  githubRepo: GitHubRepoInfo;
  branches: BranchConfig[];
  activeBranchName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceStoreState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  githubToken?: string;
}

const STORAGE_KEY = 'antask_workspaces_v2';
const GITHUB_TOKEN_KEY = 'antask_github_token';

// Default Monorepo sample markdown tasks
const SAMPLE_ROOT_MARKDOWN = `# Proyecto Monorepo - Roadmap Global

## Arquitectura & Infraestructura
- [ ] Configurar CI/CD Pipelines en GitHub Actions
  id: root_cicd
  priority: P0
- [ ] Definir variables de entorno y secrets en repositorio
  id: root_env
  priority: P1
- [x] Configurar estructura de paquetes y workspaces
  id: root_monorepo
  priority: P0

## Seguridad & Gobernanza
- [ ] Auditoría de dependencias y escaneo de vulnerabilidades
  id: root_audit
  priority: P2
  blockedBy: root_cicd
- [x] Políticas de ramas y protección de main
  id: root_branch_rules
  priority: P1
`;

const SAMPLE_FRONTEND_MARKDOWN = `# Frontend Tasks - Aplicación Web React / Next.js

## Interfaz & Diseño
- [ ] Implementar sistema de diseño sobrio según UNIVERSAL_WEB_DESIGN_GUIDELINES
  id: fe_design_system
  priority: P0
- [ ] Configurar tema claro y oscuro con soporte de alto contraste
  id: fe_theme
  priority: P1
- [x] Crear barra de navegación y panel lateral colapsable
  id: fe_shell
  priority: P1

## Vistas & Componentes
- [ ] Integrar vista espacial con Canvas interactivo
  id: fe_canvas
  priority: P0
  blockedBy: fe_design_system
- [ ] Desarrollar tablero Kanban drag-and-drop con filtros
  id: fe_kanban
  priority: P1
  blockedBy: fe_canvas
- [ ] Implementar Command Palette accesible (Cmd+K)
  id: fe_command_palette
  priority: P2
`;

const SAMPLE_BACKEND_MARKDOWN = `# Backend Tasks - APIs & Base de Datos

## Autenticación & Usuarios
- [ ] Implementar autenticación OAuth 2.0 y JWT seguros
  id: be_auth_jwt
  priority: P0
- [ ] Endpoints de gestión de perfil y roles (RBAC)
  id: be_user_profile
  priority: P1
  blockedBy: be_auth_jwt
- [x] Inicializar esquemas de datos y validaciones Zod
  id: be_schemas
  priority: P0

## Sincronización & APIs
- [ ] API REST para sincronizar documentos Markdown y tareas
  id: be_sync_api
  priority: P0
  blockedBy: be_schemas
- [ ] Webhook de GitHub para recibir eventos push y pull_request
  id: be_github_webhooks
  priority: P1
  blockedBy: be_sync_api
- [ ] Conectar persistencia en Sanity / Firestore
  id: be_db_persist
  priority: P2
`;

export function getInitialDefaultWorkspaces(): Workspace[] {
  const defaultWs: Workspace = {
    id: 'ws_antask_monorepo',
    name: 'AnTask Monorepo',
    githubRepo: {
      owner: 'antask-org',
      repo: 'antask-platform',
      fullName: 'antask-org/antask-platform',
      url: 'https://github.com/antask-org/antask-platform',
      defaultBranch: 'main',
      isPrivate: false,
      description: 'Plataforma monorepo con tareas distribuidas en raíz, frontend y backend.',
    },
    activeBranchName: 'main',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    branches: [
      {
        name: 'main',
        isProtected: true,
        lastCommit: {
          hash: '7a9c1f2',
          message: 'feat: inicializar estructura de tareas monorepo',
          author: 'AnTask Lead',
          timestamp: new Date().toISOString(),
        },
        activeDocumentId: 'doc_root_tasks',
        taskDocuments: [
          {
            id: 'doc_root_tasks',
            name: 'TASKS.md',
            folder: 'root',
            path: 'TASKS.md',
            content: SAMPLE_ROOT_MARKDOWN,
            lastSavedContent: SAMPLE_ROOT_MARKDOWN,
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'doc_frontend_tasks',
            name: 'TASKS.md',
            folder: 'frontend',
            path: 'frontend/TASKS.md',
            content: SAMPLE_FRONTEND_MARKDOWN,
            lastSavedContent: SAMPLE_FRONTEND_MARKDOWN,
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'doc_backend_tasks',
            name: 'TASKS.md',
            folder: 'backend',
            path: 'backend/TASKS.md',
            content: SAMPLE_BACKEND_MARKDOWN,
            lastSavedContent: SAMPLE_BACKEND_MARKDOWN,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      {
        name: 'feature/auth-v2',
        isProtected: false,
        lastCommit: {
          hash: 'e4d8b3a',
          message: 'chore(auth): refactorizar flujo de autenticación y tokens',
          author: 'Dev Sec',
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        },
        activeDocumentId: 'doc_auth_frontend',
        taskDocuments: [
          {
            id: 'doc_auth_frontend',
            name: 'TASKS.md',
            folder: 'frontend',
            path: 'frontend/TASKS.md',
            content: `# Feature Auth v2 - Frontend Tasks

## Autenticación Refactor
- [ ] Diseñar pantalla de Login con passkeys y 2FA
  id: auth_fe_passkey
  priority: P0
- [ ] Manejar estado de expiración de sesión con modal discreto
  id: auth_fe_session_expiry
  priority: P1
- [x] Sanitizar inputs de credenciales
  id: auth_fe_sanitize
  priority: P0
`,
            lastSavedContent: `# Feature Auth v2 - Frontend Tasks

## Autenticación Refactor
- [ ] Diseñar pantalla de Login con passkeys y 2FA
  id: auth_fe_passkey
  priority: P0
- [ ] Manejar estado de expiración de sesión con modal discreto
  id: auth_fe_session_expiry
  priority: P1
- [x] Sanitizar inputs de credenciales
  id: auth_fe_sanitize
  priority: P0
`,
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'doc_auth_backend',
            name: 'TASKS.md',
            folder: 'backend',
            path: 'backend/TASKS.md',
            content: `# Feature Auth v2 - Backend Tasks

## Endpoints Seguros
- [ ] Endpoints de rotación de Refresh Tokens
  id: auth_be_refresh
  priority: P0
- [ ] Rate limiting en ruta /api/auth/login
  id: auth_be_rate_limit
  priority: P0
- [x] Almacenar hashing argon2id
  id: auth_be_argon2
  priority: P0
`,
            lastSavedContent: `# Feature Auth v2 - Backend Tasks

## Endpoints Seguros
- [ ] Endpoints de rotación de Refresh Tokens
  id: auth_be_refresh
  priority: P0
- [ ] Rate limiting en ruta /api/auth/login
  id: auth_be_rate_limit
  priority: P0
- [x] Almacenar hashing argon2id
  id: auth_be_argon2
  priority: P0
`,
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    ],
  };

  return [defaultWs];
}

export function loadWorkspaceStore(): WorkspaceStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const token = localStorage.getItem(GITHUB_TOKEN_KEY) || undefined;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.workspaces && Array.isArray(parsed.workspaces) && parsed.workspaces.length > 0) {
        return {
          workspaces: parsed.workspaces,
          activeWorkspaceId: parsed.activeWorkspaceId || parsed.workspaces[0].id,
          githubToken: token,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to load workspace store, resetting to initial state:', err);
  }

  const defaultWorkspaces = getInitialDefaultWorkspaces();
  const initialState: WorkspaceStoreState = {
    workspaces: defaultWorkspaces,
    activeWorkspaceId: defaultWorkspaces[0].id,
  };
  saveWorkspaceStore(initialState);
  return initialState;
}

export function saveWorkspaceStore(state: WorkspaceStoreState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
      })
    );
    if (state.githubToken) {
      localStorage.setItem(GITHUB_TOKEN_KEY, state.githubToken);
    } else {
      localStorage.removeItem(GITHUB_TOKEN_KEY);
    }
  } catch (err) {
    console.error('Error saving workspace store to localStorage:', err);
  }
}

// Helpers for Workspace resolution
export function getActiveWorkspace(store: WorkspaceStoreState): Workspace {
  const ws = store.workspaces.find((w) => w.id === store.activeWorkspaceId);
  return ws || store.workspaces[0];
}

export function getActiveBranch(workspace: Workspace): BranchConfig {
  const branch = workspace.branches.find((b) => b.name === workspace.activeBranchName);
  return branch || workspace.branches[0];
}

export function getActiveDocument(branch: BranchConfig): TaskDocument {
  const doc = branch.taskDocuments.find((d) => d.id === branch.activeDocumentId);
  return doc || branch.taskDocuments[0];
}

// Helper to normalize path e.g. folder="frontend", name="TASKS.md" -> "frontend/TASKS.md"
export function formatDocumentPath(folder: string, name: string): string {
  const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, '');
  const cleanName = name.trim().replace(/^\/+/g, '') || 'TASKS.md';
  if (!cleanFolder || cleanFolder === 'root' || cleanFolder === '.') {
    return cleanName;
  }
  return `${cleanFolder}/${cleanName}`;
}

// Parse repository identifier e.g. "https://github.com/owner/repo" or "owner/repo"
export function parseGitHubRepoInput(input: string): { owner: string; repo: string; url: string; fullName: string } {
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^https?:\/\/(www\.)?github\.com\//, '');
  cleaned = cleaned.replace(/\.git$/, '');
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');

  const parts = cleaned.split('/');
  const owner = parts[0] || 'usuario';
  const repo = parts[1] || 'mi-repositorio';
  const fullName = `${owner}/${repo}`;
  const url = `https://github.com/${fullName}`;

  return { owner, repo, fullName, url };
}
