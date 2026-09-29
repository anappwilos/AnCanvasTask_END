import { createClient } from '@sanity/client';
import { Editor } from 'tldraw';

export interface TaskVisualState {
  taskId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GroupVisualState {
  groupTitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isCollapsed?: boolean;
}

export interface CanvasVisualDocument {
  _id?: string;
  _type?: string;
  projectId?: string;
  tasks: TaskVisualState[];
  groups: GroupVisualState[];
  updatedAt: string;
}

export interface SanityConfig {
  projectId: string;
  dataset: string;
  apiVersion: string;
  token?: string;
  useCdn: boolean;
}

export interface SanityConnectionTestResult {
  ok: boolean;
  message: string;
  details?: string;
  latencyMs?: number;
  mode: 'authenticated' | 'public_read' | 'failed';
  existingDocsCount?: number;
}

const LOCAL_STORAGE_KEY_VISUAL_STATE = 'antaskcanvas_visual_state_v1';
const LOCAL_STORAGE_KEY_SANITY_CONFIG = 'antaskcanvas_sanity_config';

const DEFAULT_SANITY_CONFIG: SanityConfig = {
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || '',
  dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
  apiVersion: '2024-03-01',
  token: import.meta.env.VITE_SANITY_API_TOKEN || '',
  useCdn: false,
};

export function getSanityConfig(): SanityConfig {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY_SANITY_CONFIG);
    if (stored) {
      return { ...DEFAULT_SANITY_CONFIG, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Could not read Sanity config from storage', e);
  }
  return DEFAULT_SANITY_CONFIG;
}

export function saveSanityConfig(config: Partial<SanityConfig>) {
  try {
    const current = getSanityConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(LOCAL_STORAGE_KEY_SANITY_CONFIG, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Could not save Sanity config', e);
    return DEFAULT_SANITY_CONFIG;
  }
}

export function clearSanityConfig() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY_SANITY_CONFIG);
  } catch (e) {
    console.warn('Could not clear Sanity config', e);
  }
  return DEFAULT_SANITY_CONFIG;
}

/**
 * Tests connection with Sanity using provided credentials.
 */
export async function testSanityConnection(config: {
  projectId: string;
  dataset: string;
  apiVersion?: string;
  token?: string;
}): Promise<SanityConnectionTestResult> {
  const pId = config.projectId?.trim();
  const ds = config.dataset?.trim();
  const token = config.token?.trim();
  const apiVersion = config.apiVersion || '2024-03-01';

  if (!pId) {
    return {
      ok: false,
      mode: 'failed',
      message: 'Falta el Project ID de Sanity',
      details: 'Introduce el identificador del proyecto (disponible en manage.sanity.io).',
    };
  }

  if (!ds) {
    return {
      ok: false,
      mode: 'failed',
      message: 'Falta el Dataset de Sanity',
      details: 'Introduce el nombre del dataset (normalmente "production").',
    };
  }

  const startTime = Date.now();
  try {
    const client = createClient({
      projectId: pId,
      dataset: ds,
      apiVersion,
      token: token || undefined,
      useCdn: false,
    });

    const query = `count(*[_type == "canvasVisualState"])`;
    const count = await client.fetch<number>(query);
    const latencyMs = Date.now() - startTime;

    if (token) {
      return {
        ok: true,
        mode: 'authenticated',
        message: 'Conexión exitosa con Sanity (Lectura y Escritura)',
        details: `Dataset "${ds}" alcanzado correctamente en ${latencyMs}ms. Documentos de canvas encontrados: ${count}.`,
        latencyMs,
        existingDocsCount: count,
      };
    } else {
      return {
        ok: true,
        mode: 'public_read',
        message: 'Conexión exitosa (Modo solo lectura pública)',
        details: `Dataset "${ds}" alcanzado en ${latencyMs}ms. Para sincronizar y guardar posiciones en la nube, añade un API Token con permisos de Editor.`,
        latencyMs,
        existingDocsCount: count,
      };
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err?.message || String(err);
    const statusCode = err?.statusCode || err?.response?.statusCode;

    let userFriendlyMessage = 'No se pudo conectar con Sanity';
    let details = errorMsg;

    if (statusCode === 401 || statusCode === 403 || errorMsg.includes('Unauthorized') || errorMsg.includes('Forbidden')) {
      userFriendlyMessage = 'Error de autenticación o permisos (401/403)';
      details = 'El API Token no es válido o no tiene los permisos necesarios sobre este dataset. Verifica el token en manage.sanity.io.';
    } else if (statusCode === 404 || errorMsg.includes('not found') || errorMsg.includes('Dataset not found')) {
      userFriendlyMessage = 'Proyecto o Dataset no encontrado (404)';
      details = `Verifica que el Project ID "${pId}" y el Dataset "${ds}" existan y estén bien escritos.`;
    } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('CORS')) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'esta URL';
      userFriendlyMessage = 'Error de red o política CORS';
      details = `Asegúrate de agregar ${currentOrigin} en la configuración de CORS en manage.sanity.io (Project -> API -> CORS Origins -> Add CORS origin).`;
    }

    return {
      ok: false,
      mode: 'failed',
      message: userFriendlyMessage,
      details,
      latencyMs,
    };
  }
}

function getSanityClient() {
  const config = getSanityConfig();
  if (!config.projectId || !config.dataset) {
    return null;
  }

  return createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: config.apiVersion || '2024-03-01',
    token: config.token || undefined,
    useCdn: config.useCdn ?? false,
  });
}

/**
 * Loads visual layout from Sanity (or fallback local cache if Sanity is not connected).
 */
export async function loadCanvasVisualState(
  projectId: string = 'default'
): Promise<CanvasVisualDocument | null> {
  const docId = `canvasVisualState-${projectId}`;

  // 1. Try Sanity remote
  const client = getSanityClient();
  if (client) {
    try {
      const query = `*[_type == "canvasVisualState" && (_id == $id || projectId == $projectId)][0]`;
      const result = await client.fetch<CanvasVisualDocument>(query, {
        id: docId,
        projectId,
      });

      if (result && Array.isArray(result.tasks)) {
        // Cache locally for fast fallback
        try {
          localStorage.setItem(
            `${LOCAL_STORAGE_KEY_VISUAL_STATE}_${projectId}`,
            JSON.stringify(result)
          );
        } catch {}
        return result;
      }
    } catch (err) {
      console.warn('Error reading visual state from Sanity, using fallback cache:', err);
    }
  }

  // 2. Fallback to local storage cache
  try {
    const local = localStorage.getItem(`${LOCAL_STORAGE_KEY_VISUAL_STATE}_${projectId}`);
    if (local) {
      return JSON.parse(local);
    }
  } catch (e) {
    console.warn('Error reading local visual cache:', e);
  }

  return null;
}

/**
 * Saves visual layout (tasks & groups spatial coordinates) to Sanity.
 * Never saves task content, markdown or priorities - only taskId & geometry.
 */
export async function saveCanvasVisualState(
  state: { tasks: TaskVisualState[]; groups: GroupVisualState[] },
  projectId: string = 'default'
): Promise<{ success: boolean; remote: boolean }> {
  const docId = `canvasVisualState-${projectId}`;
  const docData: CanvasVisualDocument = {
    _id: docId,
    _type: 'canvasVisualState',
    projectId,
    tasks: state.tasks.map((t) => ({
      taskId: t.taskId,
      x: Math.round(t.x),
      y: Math.round(t.y),
      width: Math.round(t.width),
      height: Math.round(t.height),
    })),
    groups: state.groups.map((g) => ({
      groupTitle: g.groupTitle,
      x: Math.round(g.x),
      y: Math.round(g.y),
      width: Math.round(g.width),
      height: Math.round(g.height),
      isCollapsed: g.isCollapsed,
    })),
    updatedAt: new Date().toISOString(),
  };

  // 1. Always save to local visual cache
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY_VISUAL_STATE}_${projectId}`,
      JSON.stringify(docData)
    );
  } catch (e) {
    console.warn('Local visual cache save failed:', e);
  }

  // 2. Save to Sanity if client configured with token
  const client = getSanityClient();
  const config = getSanityConfig();

  if (client && config.token) {
    try {
      await client.createOrReplace(docData as any);
      return { success: true, remote: true };
    } catch (err) {
      console.warn('Could not persist visual state to Sanity:', err);
      return { success: true, remote: false };
    }
  }

  return { success: true, remote: false };
}

/**
 * Extracts current visual positions and dimensions of all task cards and groups from tldraw editor.
 */
export function extractVisualStateFromEditor(editor: Editor): {
  tasks: TaskVisualState[];
  groups: GroupVisualState[];
} {
  const shapes = editor.getCurrentPageShapes();
  const tasks: TaskVisualState[] = [];
  const groups: GroupVisualState[] = [];

  for (const rawShape of shapes) {
    const s = rawShape as any;
    if (s.type === 'task') {
      const taskId = s.props?.taskId;
      if (taskId) {
        tasks.push({
          taskId,
          x: s.x,
          y: s.y,
          width: s.props?.w || 320,
          height: s.props?.h || 110,
        });
      }
    } else if (s.type === 'task-group') {
      const groupTitle = s.props?.title;
      if (groupTitle) {
        groups.push({
          groupTitle,
          x: s.x,
          y: s.y,
          width: s.props?.w || 360,
          height: s.props?.h || 200,
        });
      }
    }
  }

  return { tasks, groups };
}
