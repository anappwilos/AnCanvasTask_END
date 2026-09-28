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
