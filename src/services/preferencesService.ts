export type ThemePreference = 'dark' | 'light' | 'system';
export type DensityPreference = 'compact' | 'normal' | 'comfortable';
export type DefaultViewPreference = 'canvas' | 'kanban';
export type ExportFormatPreference = 'markdown' | 'json';

export interface UserPreferences {
  theme: ThemePreference;
  density: DensityPreference;
  defaultView: DefaultViewPreference;
  confirmDelete: boolean;
  sidebarOpenByDefault: boolean;
  canvasGrid: boolean;
  canvasSnap: boolean;
  exportFormat: ExportFormatPreference;
  recentFiles: string[];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  density: 'normal',
  defaultView: 'canvas',
  confirmDelete: true,
  sidebarOpenByDefault: true,
  canvasGrid: true,
  canvasSnap: true,
  exportFormat: 'markdown',
  recentFiles: ['TASKS.md'],
};

const PREFS_STORAGE_KEY = 'antask_user_preferences';

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      recentFiles: Array.isArray(parsed.recentFiles) && parsed.recentFiles.length > 0
        ? parsed.recentFiles.slice(0, 8)
        : DEFAULT_PREFERENCES.recentFiles,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or disabled localStorage errors
  }
}

export function addRecentFile(fileName: string): string[] {
  if (!fileName || !fileName.trim()) return DEFAULT_PREFERENCES.recentFiles;
  const current = loadUserPreferences();
  const filtered = current.recentFiles.filter(
    (f) => f.toLowerCase() !== fileName.trim().toLowerCase()
  );
  const updated = [fileName.trim(), ...filtered].slice(0, 8);
  saveUserPreferences({ ...current, recentFiles: updated });
  return updated;
}

export function clearRecentFiles(): void {
  const current = loadUserPreferences();
  saveUserPreferences({ ...current, recentFiles: ['TASKS.md'] });
}
