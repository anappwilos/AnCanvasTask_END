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

export interface SanityTestingTaskDocument {
  _id: string;
  _type: 'task';
  taskId: string;
  title: string;
  completed: boolean;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  groupTitle: string;
  blockedBy?: string;
  tags?: string[];
  subtasks?: Array<{ title: string; completed: boolean }>;
  description?: string;
  updatedAt: string;
}

export interface SanityWriteTestResult {
  ok: boolean;
  message: string;
  details?: string;
  latencyMs?: number;
  dataset?: string;
  document?: any;
  action: 'created' | 'verified' | 'failed';
}

/**
 * Executes a real live write mutation to Sanity (dataset `production` or active dataset)
 * and immediately verifies that the document exists and can be retrieved.
 */
export async function writeTestingTaskToSanity(
  configOverride?: Partial<SanityConfig>,
  customTask?: Partial<SanityTestingTaskDocument>
): Promise<SanityWriteTestResult> {
  const config = { ...getSanityConfig(), ...configOverride };
  if (!config.projectId || !config.dataset) {
    return {
      ok: false,
      action: 'failed',
      message: 'Falta configuración de Sanity',
      details: 'Introduce un Project ID y Dataset válidos.',
    };
  }

  if (!config.token) {
    return {
      ok: false,
      action: 'failed',
      message: 'Se requiere API Token con permisos de escritura',
      details: 'Para escribir datos en el dataset de Sanity necesitas un token de tipo "Editor".',
    };
  }

  const client = createClient({
    projectId: config.projectId,
    dataset: config.dataset,
    apiVersion: config.apiVersion || '2024-03-01',
    token: config.token,
    useCdn: false,
  });

  const now = new Date();
  const testDocId = customTask?._id || `task-test-schema-${Date.now().toString(36)}`;
  const testTaskId = customTask?.taskId || `test-${Math.floor(1000 + Math.random() * 9000)}`;

  const testDocument: SanityTestingTaskDocument = {
    _id: testDocId,
    _type: 'task',
    taskId: testTaskId,
    title: customTask?.title || 'Tarea de Prueba - Verificación de Escritura Sanity',
    completed: customTask?.completed ?? false,
    status: customTask?.status || 'in_progress',
    priority: customTask?.priority || 'P0',
    groupTitle: customTask?.groupTitle || 'Autenticación & Nube',
    tags: customTask?.tags || ['sanity-test', 'production-write', 'schema-v1'],
    subtasks: customTask?.subtasks || [
      { title: 'Validar schema task en Sanity', completed: true },
      { title: 'Comprobar persistencia en dataset ' + config.dataset, completed: true },
      { title: 'Sincronizar con el lienzo infinito', completed: false },
    ],
    description:
      customTask?.description ||
      `Documento de prueba generado por AnTaskCanvas a las ${now.toLocaleTimeString()} para comprobar mutaciones en el dataset "${config.dataset}".`,
    updatedAt: now.toISOString(),
  };

  const startTime = Date.now();
  try {
    // 1. Write document to Sanity
    const createResult = await client.createOrReplace(testDocument as any);

    // 2. Immediate read verification (Read-After-Write)
    const verifiedDoc = await client.fetch(`*[_id == $id][0]`, { id: testDocId });
    const latencyMs = Date.now() - startTime;

    if (!verifiedDoc) {
      return {
        ok: false,
        action: 'failed',
        message: 'Escritura completada pero el documento no se pudo leer',
        details: `El documento ${testDocId} fue enviado pero no se encontró en la consulta inmediata.`,
        latencyMs,
        dataset: config.dataset,
      };
    }

    return {
      ok: true,
      action: 'created',
      message: `Documento "${testDocument.title}" escrito con éxito en "${config.dataset}"`,
      details: `ID: ${verifiedDoc._id} | Tipo: ${verifiedDoc._type} | Verificado en ${latencyMs}ms.`,
      latencyMs,
      dataset: config.dataset,
      document: verifiedDoc,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      ok: false,
      action: 'failed',
      message: 'Error al escribir documento en Sanity',
      details: err?.message || String(err),
      latencyMs,
      dataset: config.dataset,
    };
  }
}

/**
 * Deletes a test document from Sanity.
 */
export async function deleteDocumentFromSanity(
  docId: string,
  configOverride?: Partial<SanityConfig>
): Promise<{ ok: boolean; message: string }> {
  const config = { ...getSanityConfig(), ...configOverride };
  if (!config.projectId || !config.dataset || !config.token) {
    return { ok: false, message: 'Falta token de autenticación para eliminar' };
  }

  try {
    const client = createClient({
      projectId: config.projectId,
      dataset: config.dataset,
      apiVersion: config.apiVersion || '2024-03-01',
      token: config.token,
      useCdn: false,
    });

    await client.delete(docId);
    return { ok: true, message: `Documento ${docId} eliminado con éxito` };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Error al eliminar documento' };
  }
}

/**
 * Fetches recent documents stored in Sanity dataset (both task and canvasVisualState).
 */
export async function fetchSanityDocumentsList(
  configOverride?: Partial<SanityConfig>
): Promise<Array<{ _id: string; _type: string; title?: string; taskId?: string; projectId?: string; _updatedAt?: string }>> {
  const config = { ...getSanityConfig(), ...configOverride };
  if (!config.projectId || !config.dataset) return [];

  try {
    const client = createClient({
      projectId: config.projectId,
      dataset: config.dataset,
      apiVersion: config.apiVersion || '2024-03-01',
      token: config.token || undefined,
      useCdn: false,
    });

    const query = `*[_type in ["task", "canvasVisualState"]] | order(_updatedAt desc)[0...15] {
      _id,
      _type,
      title,
      taskId,
      projectId,
      _updatedAt,
      updatedAt
    }`;
    const results = await client.fetch(query);
    return Array.isArray(results) ? results : [];
  } catch (err) {
    console.warn('Error fetching Sanity documents list:', err);
    return [];
  }
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
