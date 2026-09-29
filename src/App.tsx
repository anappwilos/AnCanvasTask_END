import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createShapeId,
  Editor,
  Tldraw,
} from 'tldraw';
import {
  CanvasVisualDocument,
  extractVisualStateFromEditor,
  getSanityConfig,
  loadCanvasVisualState,
  saveCanvasVisualState,
  saveSanityConfig,
} from './services/sanityService';
import {
  ITaskGroupShape,
  ITaskShape,
  loadTasksFromMarkdown,
  ParsedGroup,
  parseTasksMarkdown,
  seedMockTasks,
  TaskGroupShapeUtil,
  TaskPriority,
  TaskShapeUtil,
  TaskStatus,
} from './shapes/TaskShapeUtil';
import { applyAutoLayout } from './utils/autoLayout';
import { KanbanBoard } from './components/KanbanBoard';
import { TaskDetailsPanel } from './components/TaskDetailsPanel';
import { CommandPalette, CommandPaletteAction, CommandPaletteTask } from './components/CommandPalette';
import { FilterBar, TaskFilterState } from './components/FilterBar';
import { ToastContainer, ToastItem, ToastType } from './components/ToastSystem';
import { QuickGuideModal } from './components/QuickGuideModal';
import { SettingsModal } from './components/SettingsModal';
import { ImportExportModal } from './components/ImportExportModal';
import {
  AppUserSettings,
  loadUserSettings,
  saveUserSettings,
  recordRecentFile,
} from './services/settingsService';
import {
  addTaskToMarkdown,
  deleteTaskFromMarkdown,
  findDependentTasks,
  moveTaskToGroupInMarkdown,
  scanTaskBlocks,
  updateTaskInMarkdown,
  validateMarkdownDocument,
} from './utils/markdownSync';

export type SyncStatus = 'idle' | 'saving' | 'synced' | 'local' | 'loading';

export const SAMPLE_MARKDOWN = `# Proyecto AnTaskCanvas - Developer Tasks

## Autenticación
- [ ] Configurar OAuth
  id: oauth
  priority: P0
- [ ] Persistir sesión
  id: session
  priority: P0
  blockedBy: oauth

## Perfil
- [ ] Crear pantalla de perfil
  id: profile
  priority: P2
- [x] Añadir avatar
  id: avatar
  priority: P3
  blockedBy: profile
`;

interface DeleteWarningInfo {
  shapeId: string;
  taskId: string;
  title: string;
  dependents: Array<{ taskId: string; title: string; groupTitle: string }>;
}

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);

  // User Settings & Preferences State (DESIGN.md Section 4 & Fase 7)
  const [userSettings, setUserSettings] = useState<AppUserSettings>(() => loadUserSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isImportExportOpen, setIsImportExportOpen] = useState<boolean>(false);

  // Compute effective theme based on userSettings (including system preference)
  const effectiveTheme = useMemo<'dark' | 'light'>(() => {
    if (userSettings.theme === 'system') {
      return typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return userSettings.theme;
  }, [userSettings.theme]);

  // Sync theme, density, high contrast, and reduced motion attributes with document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', userSettings.density);
  }, [userSettings.density]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-contrast',
      userSettings.accessibilityHighContrast ? 'high' : 'normal'
    );
  }, [userSettings.accessibilityHighContrast]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-reduced-motion',
      userSettings.accessibilityReducedMotion ? 'true' : 'false'
    );
  }, [userSettings.accessibilityReducedMotion]);

  const handleUpdateSettings = useCallback((newSettings: AppUserSettings) => {
    setUserSettings(newSettings);
    saveUserSettings(newSettings);
  }, []);

  // Shell Layout State (DESIGN.md Section 3 & 16)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'canvas' | 'kanban'>(() => userSettings.defaultView || 'canvas');
  const [selectedTaskShapeId, setSelectedTaskShapeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'todo' | 'done' | 'critical' | 'blocked'>('all');

  // Advanced Filters State (DESIGN.md Section 6 & 7)
  const [taskFilters, setTaskFilters] = useState<TaskFilterState>({
    status: 'all',
    priority: 'all',
    section: 'all',
    tag: 'all',
    onlyBlocked: false,
    sortBy: 'default',
  });

  // Command Palette & Recent Tasks State (DESIGN.md Section 12 & 15)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [recentTaskIds, setRecentTaskIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('antask_recent_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const pushRecentTask = useCallback((taskId: string) => {
    if (!taskId) return;
    setRecentTaskIds((prev) => {
      const filtered = prev.filter((id) => id.toLowerCase() !== taskId.toLowerCase());
      const next = [taskId, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('antask_recent_tasks', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Global Keyboard Shortcuts (Cmd/Ctrl + K, Cmd/Ctrl + ,, ?, Escape)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
        return;
      }

      if (e.key === '?' && !isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsQuickGuideOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Modals state
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [isViewMarkdownOpen, setIsViewMarkdownOpen] = useState<boolean>(false);
  const [isSanityModalOpen, setIsSanityModalOpen] = useState<boolean>(false);
  const [isAutoLayoutConfirmOpen, setIsAutoLayoutConfirmOpen] = useState<boolean>(false);
  const [isProblemsModalOpen, setIsProblemsModalOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isQuickGuideOpen, setIsQuickGuideOpen] = useState<boolean>(false);
  const [deleteWarningState, setDeleteWarningState] = useState<DeleteWarningInfo | null>(null);

  // Operations and Loading state (DESIGN.md Section 1 & 3)
  const [isAutoOrganizing, setIsAutoOrganizing] = useState<boolean>(false);
  const [isLoadingDocument, setIsLoadingDocument] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Undo history stack for destructive task deletions
  const undoStackRef = useRef<Array<{ markdown: string; label: string }>>([]);

  // Toast System State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (message: string, type: ToastType = 'info', action?: { label: string; onClick: () => void }) => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      setToasts((prev) => [...prev.slice(-3), { id, message, type, action }]);
    },
    []
  );

  const handleDismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (msg: string, type: ToastType = 'info') => {
      pushToast(msg, type);
    },
    [pushToast]
  );

  // Online / Offline network status listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      pushToast('Conexión reestablecida', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      pushToast('Sin conexión a internet. Los cambios se guardarán localmente.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushToast]);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('P1');
  const [newTaskGroup, setNewTaskGroup] = useState<string>('Autenticación');
  const [customGroupInput, setCustomGroupInput] = useState<string>('');
  const [isCustomGroup, setIsCustomGroup] = useState<boolean>(false);

  // Markdown and sync
  const [currentFileName, setCurrentFileName] = useState<string>('TASKS.md');
  const [markdownInput, setMarkdownInput] = useState<string>(SAMPLE_MARKDOWN);
  const [lastSavedMarkdown, setLastSavedMarkdown] = useState<string>(SAMPLE_MARKDOWN);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef<number>(0);

  // Sanity settings form state
  const [sanityProjectId, setSanityProjectId] = useState<string>('');
  const [sanityDataset, setSanityDataset] = useState<string>('production');
  const [sanityToken, setSanityToken] = useState<string>('');

  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);
  const markdownRef = useRef<string>(markdownInput);
  markdownRef.current = markdownInput;

  const customShapeUtils = useMemo(() => [TaskGroupShapeUtil, TaskShapeUtil], []);


  // Validation Report computed reactively
  const validationReport = useMemo(
    () => validateMarkdownDocument(markdownInput),
    [markdownInput]
  );

  // Load initial Sanity configuration
  useEffect(() => {
    const config = getSanityConfig();
    setSanityProjectId(config.projectId || '');
    setSanityDataset(config.dataset || 'production');
    setSanityToken(config.token || '');
  }, []);

  const parsedGroups = useMemo(() => {
    return parseTasksMarkdown(markdownInput);
  }, [markdownInput]);

  const existingSections = useMemo(() => {
    const { groupHeadings } = scanTaskBlocks(markdownInput);
    const titles = groupHeadings.map((g) => g.title);
    return titles.length > 0 ? titles : ['General'];
  }, [markdownInput]);

  const triggerDebouncedVisualSave = useCallback((editorInstance: Editor) => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    setSyncStatus('saving');
    debouncedSaveRef.current = setTimeout(async () => {
      const visualState = extractVisualStateFromEditor(editorInstance);
      if (visualState.tasks.length > 0 || visualState.groups.length > 0) {
        const res = await saveCanvasVisualState(visualState);
        setSyncStatus(res.remote ? 'synced' : 'local');
      } else {
        setSyncStatus('idle');
      }
    }, 700);
  }, []);

  // Listen for delete requests from task cards
  useEffect(() => {
    const handleDeleteRequest = (e: Event) => {
      const customEvent = e as CustomEvent<{
        shapeId: string;
        taskId: string;
        title: string;
      }>;
      const { shapeId, taskId, title } = customEvent.detail;
      const dependents = findDependentTasks(markdownRef.current, taskId);

      setDeleteWarningState({
        shapeId,
        taskId,
        title,
        dependents,
      });
    };

    window.addEventListener('antask-request-delete-task', handleDeleteRequest);
    return () => {
      window.removeEventListener('antask-request-delete-task', handleDeleteRequest);
    };
  }, []);

  // Selection and Zoom state for Canvas (DESIGN.md Section 14)
  const [canvasZoom, setCanvasZoom] = useState<number>(100);
  const [selectedTaskIdsOnCanvas, setSelectedTaskIdsOnCanvas] = useState<string[]>([]);

  // Selection and Zoom synchronization with editor
  useEffect(() => {
    if (!editor) return;

    const updateSelectionAndZoom = () => {
      try {
        const zoom = Math.round(editor.getZoomLevel() * 100);
        setCanvasZoom(zoom);
      } catch {
        // ignore
      }

      const selected = editor.getSelectedShapes();
      const taskShapes = selected.filter((s) => (s as any).type === 'task');
      const taskIds = taskShapes
        .map((s) => ((s as any).props?.taskId || (s as any).props?.temporaryId || s.id) as string)
        .filter(Boolean);

      setSelectedTaskIdsOnCanvas(taskIds);

      if (taskShapes.length === 1) {
        setSelectedTaskShapeId(taskShapes[0].id);
      } else if (taskShapes.length === 0 && activeView === 'canvas') {
        setSelectedTaskShapeId(null);
      }
    };

    updateSelectionAndZoom();
    const unsub = editor.store.listen(updateSelectionAndZoom);
    return () => unsub();
  }, [editor, activeView]);

  // Sync theme with editor user preferences
  useEffect(() => {
    if (editor) {
      editor.user.updateUserPreferences({ colorScheme: effectiveTheme === 'dark' ? 'dark' : 'light' });
    }
  }, [editor, effectiveTheme]);

  const handleMount = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);
      editorInstance.user.updateUserPreferences({ colorScheme: effectiveTheme === 'dark' ? 'dark' : 'light' });

      // Async initialization of visual state
      const initVisualState = async () => {
        setSyncStatus('loading');
        const savedVisualState = await loadCanvasVisualState();
        if (savedVisualState) {
          setSyncStatus(getSanityConfig().token ? 'synced' : 'local');
        } else {
          setSyncStatus('idle');
        }

        // Reconstruct tasks from TASKS.md using visual state positions
        seedMockTasks(editorInstance, savedVisualState);
      };

      initVisualState();

      // Set up store listener to sync task content edits, moves between groups, and visual persistence
      const unsubscribe = editorInstance.store.listen((entry) => {
        let hasVisualChange = false;
        const changes = entry.changes as any;

        if (changes.updated) {
          for (const id of Object.keys(changes.updated)) {
            const [from, to] = changes.updated[id] || [];
            if (to?.typeName === 'shape' || from?.typeName === 'shape') {
              hasVisualChange = true;

              // 1. Detect task attribute changes (title, completed, priority)
              if (to?.type === 'task' && from?.type === 'task') {
                const toProps = to.props || {};
                const fromProps = from.props || {};
                const isTitleChanged = toProps.title !== fromProps.title;
                const isCompletedChanged = toProps.completed !== fromProps.completed;
                const isPriorityChanged = toProps.priority !== fromProps.priority;

                if (isTitleChanged || isCompletedChanged || isPriorityChanged) {
                  const taskId = toProps.taskId || fromProps.taskId;
                  if (taskId) {
                    setMarkdownInput((currentMd) =>
                      updateTaskInMarkdown(currentMd, taskId, {
                        title: toProps.title,
                        completed: toProps.completed,
                        priority: toProps.priority,
                      })
                    );
                  }
                }

                // 2. Detect moving task into another group bounding box
                const isPositionChanged = to.x !== from.x || to.y !== from.y;
                if (isPositionChanged) {
                  const taskId = toProps.taskId || fromProps.taskId;
                  if (taskId) {
                    const taskCenterX = to.x + (toProps.w || 320) / 2;
                    const taskCenterY = to.y + 40;

                    // Find all task-group shapes on canvas
                    const groupShapes = editorInstance
                      .getCurrentPageShapes()
                      .filter((s) => (s as any).type === 'task-group');

                    for (const gShape of groupShapes) {
                      const g = gShape as any;
                      const gW = g.props?.w || 360;
                      const gH = g.props?.h || 240;

                      if (
                        taskCenterX >= g.x &&
                        taskCenterX <= g.x + gW &&
                        taskCenterY >= g.y &&
                        taskCenterY <= g.y + gH
                      ) {
                        const targetGroupTitle = g.props?.title;
                        if (targetGroupTitle) {
                          setMarkdownInput((curr) => {
                            const updated = moveTaskToGroupInMarkdown(
                              curr,
                              taskId,
                              targetGroupTitle
                            );
                            return updated;
                          });
                        }
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        if (!hasVisualChange && changes.added) {
          for (const id of Object.keys(changes.added)) {
            if (changes.added[id]?.typeName === 'shape') {
              hasVisualChange = true;
              break;
            }
          }
        }

        if (!hasVisualChange && changes.removed) {
          for (const id of Object.keys(changes.removed)) {
            if (changes.removed[id]?.typeName === 'shape') {
              hasVisualChange = true;
              break;
            }
          }
        }

        if (hasVisualChange) {
          triggerDebouncedVisualSave(editorInstance);
        }
      });

      return () => {
        unsubscribe();
      };
    },
    [effectiveTheme, triggerDebouncedVisualSave]
  );

  const handleZoomToFit = useCallback(() => {
    if (editor) {
      editor.zoomToFit({ animation: { duration: 250 } });
    }
  }, [editor]);

  const handleZoomIn = useCallback(() => {
    if (editor) {
      editor.zoomIn(undefined, { animation: { duration: 200 } });
    }
  }, [editor]);

  const handleZoomOut = useCallback(() => {
    if (editor) {
      editor.zoomOut(undefined, { animation: { duration: 200 } });
    }
  }, [editor]);

  const handleResetZoom = useCallback(() => {
    if (editor) {
      editor.resetZoom(undefined, { animation: { duration: 200 } });
    }
  }, [editor]);

  const handleResetLayout = useCallback(async () => {
    if (editor) {
      const currentShapes = editor
        .getCurrentPageShapes()
        .filter(
          (s) =>
            (s as any).type === 'task' ||
            (s as any).type === 'task-group' ||
            (s as any).type === 'arrow'
        );
      if (currentShapes.length > 0) {
        editor.deleteShapes(currentShapes.map((s) => s.id));
      }
      seedMockTasks(editor, null);
      triggerDebouncedVisualSave(editor);
      showToast('Canvas reiniciado al estado inicial');
    }
  }, [editor, triggerDebouncedVisualSave]);

  const parsedStats = useMemo(() => {
    const groups = parseTasksMarkdown(markdownInput);
    const totalTasks = groups.reduce((acc, g) => acc + g.tasks.length, 0);
    const completedTasks = groups.reduce(
      (acc, g) => acc + g.tasks.filter((t) => t.completed).length,
      0
    );
    const criticalTasks = groups.reduce(
      (acc, g) => acc + g.tasks.filter((t) => t.priority === 'P0').length,
      0
    );
    const blockedTasks = groups.reduce(
      (acc, g) => acc + g.tasks.filter((t) => Boolean(t.blockedBy) && !t.completed).length,
      0
    );

    return {
      groupCount: groups.length,
      taskCount: totalTasks,
      completedCount: completedTasks,
      criticalCount: criticalTasks,
      blockedCount: blockedTasks,
    };
  }, [markdownInput]);

  const hasUnsavedChanges = useMemo(
    () => markdownInput !== lastSavedMarkdown,
    [markdownInput, lastSavedMarkdown]
  );

  // File Import Processor
  const processLoadedFile = useCallback(
    async (file: File) => {
      const lowerName = file.name.toLowerCase();
      const isMd =
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.markdown') ||
        lowerName.endsWith('.txt') ||
        file.type.includes('markdown') ||
        file.type.includes('text/plain');

      if (!isMd) {
        showToast('Por favor selecciona o arrastra un archivo Markdown válido (.md)');
        return;
      }

      try {
        const text = await file.text();
        setCurrentFileName(file.name);
        setMarkdownInput(text);
        setLastSavedMarkdown(text);

        if (editor) {
          const savedVisualState = await loadCanvasVisualState();
          const { taskCount, groupCount } = loadTasksFromMarkdown(
            editor,
            text,
            savedVisualState
          );
          const recents = recordRecentFile(file.name, taskCount, groupCount);
          setUserSettings((prev) => ({ ...prev, recentFiles: recents }));

          if (taskCount > 0 || groupCount > 0) {
            triggerDebouncedVisualSave(editor);
            pushToast(`"${file.name}" cargado (${taskCount} tareas en ${groupCount} secciones)`, 'success');
          } else {
            pushToast(`"${file.name}" cargado, pero no contiene tareas válidas (- [ ] ...)`, 'warning');
          }
        } else {
          pushToast(`"${file.name}" cargado en memoria`, 'info');
        }
      } catch (err) {
        pushToast(`Error al leer "${file.name}"`, 'error');
      }
    },
    [editor, triggerDebouncedVisualSave, pushToast]
  );

  const handleImportMarkdownFromModal = useCallback(
    async (newText: string, fileName: string, mode: 'replace' | 'merge') => {
      let finalMarkdown = newText;
      if (mode === 'merge') {
        finalMarkdown = markdownInput.trim() + '\n\n' + newText.trim() + '\n';
      }

      const cleanFileName = fileName || 'TASKS.md';
      setCurrentFileName(cleanFileName);
      setMarkdownInput(finalMarkdown);
      setLastSavedMarkdown(finalMarkdown);

      if (editor) {
        const savedVisualState = await loadCanvasVisualState();
        const { taskCount, groupCount } = loadTasksFromMarkdown(
          editor,
          finalMarkdown,
          savedVisualState
        );
        const recents = recordRecentFile(cleanFileName, taskCount, groupCount);
        setUserSettings((prev) => ({ ...prev, recentFiles: recents }));
        triggerDebouncedVisualSave(editor);
        pushToast(
          mode === 'replace'
            ? `Documento reemplazado (${taskCount} tareas en ${groupCount} secciones)`
            : `Contenido combinado (${taskCount} tareas en ${groupCount} secciones)`,
          'success'
        );
      }
    },
    [editor, markdownInput, triggerDebouncedVisualSave, pushToast]
  );

  const handleExportMarkdownFromModal = useCallback(
    (content: string, fileName: string, format: 'md' | 'json') => {
      try {
        const mimeType =
          format === 'json'
            ? 'application/json;charset=utf-8'
            : 'text/markdown;charset=utf-8';
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = url;
        downloadAnchor.download = fileName || (format === 'json' ? 'TASKS.json' : 'TASKS.md');
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        document.body.removeChild(downloadAnchor);
        URL.revokeObjectURL(url);

        setLastSavedMarkdown(markdownInput);
        pushToast(`Archivo "${fileName}" descargado con éxito`, 'success');
      } catch (err) {
        pushToast('Error al exportar archivo', 'error');
      }
    },
    [markdownInput, pushToast]
  );

  const handleOpenFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processLoadedFile(files[0]);
    }
  };

  const handleExportFile = useCallback(() => {
    try {
      const blob = new Blob([markdownInput], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = currentFileName || 'TASKS.md';
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      setLastSavedMarkdown(markdownInput);
      pushToast(`Archivo "${currentFileName || 'TASKS.md'}" guardado`, 'success');
    } catch (err) {
      pushToast('Error al exportar archivo', 'error');
    }
  }, [markdownInput, currentFileName, pushToast]);

  // Drag & Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processLoadedFile(file);
    }
  };

  const handleApplyMarkdown = useCallback(async () => {
    if (!editor) return;
    const savedVisualState = await loadCanvasVisualState();
    const { taskCount, groupCount } = loadTasksFromMarkdown(
      editor,
      markdownInput,
      savedVisualState
    );
    if (taskCount > 0 || groupCount > 0) {
      setIsImportExportOpen(false);
      setLastSavedMarkdown(markdownInput);
      showToast(`${taskCount} tareas aplicadas al canvas`);
      triggerDebouncedVisualSave(editor);
    } else {
      showToast('No se detectaron tareas válidas');
    }
  }, [editor, markdownInput, triggerDebouncedVisualSave]);

  // Focus a specific task on the canvas
  const handleFocusTaskOnCanvas = (targetTaskId?: string, targetTitle?: string) => {
    if (!editor || !targetTaskId) return;

    const shapes = editor.getCurrentPageShapes();
    const taskShape = shapes.find((s) => {
      if ((s as any).type !== 'task') return false;
      const tProps = (s as any).props || {};
      return (
        tProps.taskId?.toLowerCase() === targetTaskId.toLowerCase() ||
        tProps.title?.toLowerCase() === targetTitle?.toLowerCase()
      );
    });

    if (taskShape) {
      setIsProblemsModalOpen(false);
      editor.select(taskShape.id);
      setSelectedTaskShapeId(taskShape.id);
      editor.zoomToSelection({ animation: { duration: 300 } });
      showToast(`Enfocado: "${(taskShape.props as any)?.title || targetTaskId}"`);
    } else {
      showToast(`No se encontró la tarjeta #${targetTaskId} en el canvas`);
    }
  };

  // Focus a specific section group on canvas
  const handleFocusSectionOnCanvas = (sectionTitle: string) => {
    if (!editor) return;
    const shapes = editor.getCurrentPageShapes();
    const groupShape = shapes.find(
      (s) =>
        (s as any).type === 'task-group' &&
        (s as any).props?.title?.toLowerCase() === sectionTitle.toLowerCase()
    );

    if (groupShape) {
      editor.select(groupShape.id);
      editor.zoomToSelection({ animation: { duration: 300 } });
      showToast(`Sección: "${sectionTitle}"`);
    }
  };

  // Create New Task Handler
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !editor) return;

    const groupTitle = isCustomGroup
      ? customGroupInput.trim() || 'General'
      : newTaskGroup.trim();

    const { updatedMarkdown, taskId } = addTaskToMarkdown(markdownInput, {
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      groupTitle,
    });

    setMarkdownInput(updatedMarkdown);

    const allShapes = editor.getCurrentPageShapes();
    const targetGroupShape = allShapes.find(
      (s) =>
        (s as any).type === 'task-group' &&
        (s as any).props?.title?.toLowerCase() === groupTitle.toLowerCase()
    ) as any;

    let targetX = 80;
    let targetY = 160;

    if (targetGroupShape) {
      const tasksInGroup = allShapes.filter(
        (s) =>
          (s as any).type === 'task' &&
          s.x >= targetGroupShape.x &&
          s.x <= targetGroupShape.x + (targetGroupShape.props?.w || 360)
      );

      targetX = targetGroupShape.x + 20;
      targetY = targetGroupShape.y + 70 + tasksInGroup.length * 126;

      const neededHeight = 80 + (tasksInGroup.length + 1) * 126 + 20;
      if (neededHeight > (targetGroupShape.props?.h || 240)) {
        editor.updateShape({
          id: targetGroupShape.id,
          type: 'task-group',
          props: {
            h: neededHeight,
            count: (targetGroupShape.props?.count || 0) + 1,
          },
        } as any);
      }
    } else {
      const groupCount = allShapes.filter((s) => (s as any).type === 'task-group').length;
      const newGroupX = 80 + groupCount * 400;
      const newGroupY = 80;

      editor.createShape({
        id: createShapeId(),
        type: 'task-group' as const,
        x: newGroupX,
        y: newGroupY,
        props: {
          w: 360,
          h: 240,
          title: groupTitle,
          count: 1,
          completedCount: 0,
        },
      } as any);

      targetX = newGroupX + 20;
      targetY = newGroupY + 70;
    }

    const newShapeId = createShapeId();
    editor.createShape({
      id: newShapeId,
      type: 'task' as const,
      x: targetX,
      y: targetY,
      props: {
        w: 320,
        h: 110,
        title: newTaskTitle.trim(),
        completed: false,
        priority: newTaskPriority,
        taskId,
      },
    } as any);

    triggerDebouncedVisualSave(editor);

    setNewTaskTitle('');
    setNewTaskPriority('P1');
    setIsNewTaskModalOpen(false);
    showToast(`Tarea #${taskId} creada en "${groupTitle}"`);
  };

  // Load Sample Project Helper
  const handleLoadSampleProject = useCallback(async () => {
    setIsLoadingDocument(true);
    setCurrentFileName('TASKS.md');
    setMarkdownInput(SAMPLE_MARKDOWN);
    setLastSavedMarkdown(SAMPLE_MARKDOWN);

    if (editor) {
      const currentShapes = editor.getCurrentPageShapes().filter(
        (s) =>
          (s as any).type === 'task' ||
          (s as any).type === 'task-group' ||
          (s as any).type === 'arrow'
      );
      if (currentShapes.length > 0) {
        editor.deleteShapes(currentShapes.map((s) => s.id));
      }
      seedMockTasks(editor, null);
      triggerDebouncedVisualSave(editor);
    }
    setTimeout(() => {
      setIsLoadingDocument(false);
      pushToast('Proyecto de ejemplo cargado', 'success');
    }, 150);
  }, [editor, triggerDebouncedVisualSave, pushToast]);

  // Confirm Delete Task Handler with Undo Action (DESIGN.md Section 9)
  const handleConfirmDeleteTask = () => {
    if (!deleteWarningState || !editor) return;
    const { shapeId, taskId, title } = deleteWarningState;
    const priorMarkdown = markdownInput;

    const updatedMarkdown = deleteTaskFromMarkdown(markdownInput, taskId);
    setMarkdownInput(updatedMarkdown);

    const allShapes = editor.getCurrentPageShapes();
    const arrowShapesToDelete = allShapes.filter((s) => {
      if ((s as any).type !== 'arrow') return false;
      const bindings = (editor.getBindingsInvolvingShape?.(s) as any[]) || [];
      return bindings.some(
        (b) => b.toId === shapeId || b.fromId === shapeId
      );
    });

    const shapesToDelete = [shapeId, ...arrowShapesToDelete.map((a) => a.id)];
    editor.deleteShapes(shapesToDelete as any);

    if (selectedTaskShapeId === shapeId) {
      setSelectedTaskShapeId(null);
    }

    setDeleteWarningState(null);
    triggerDebouncedVisualSave(editor);

    pushToast(`Tarea #${taskId} eliminada`, 'info', {
      label: 'Deshacer',
      onClick: async () => {
        setMarkdownInput(priorMarkdown);
        if (editor) {
          const visual = await loadCanvasVisualState();
          loadTasksFromMarkdown(editor, priorMarkdown, visual);
          triggerDebouncedVisualSave(editor);
        }
        pushToast(`Tarea "${title}" restaurada`, 'success');
      },
    });
  };

  // Execute Auto-Layout (DAG hierarchical organizing via Dagre) with local feedback
  const handleExecuteAutoLayout = () => {
    if (!editor) return;
    setIsAutoLayoutConfirmOpen(false);
    setIsAutoOrganizing(true);

    setTimeout(() => {
      try {
        const { taskCount, groupCount } = applyAutoLayout(editor, markdownInput);
        if (taskCount > 0 || groupCount > 0) {
          triggerDebouncedVisualSave(editor);
          pushToast(`Canvas organizado (${taskCount} tareas en ${groupCount} secciones)`, 'success');
        } else {
          pushToast('No hay tareas para organizar', 'info');
        }
      } catch (err) {
        pushToast('Error al organizar el canvas', 'error');
      } finally {
        setIsAutoOrganizing(false);
      }
    }, 100);
  };

  const handleSaveSanityConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSanityConfig({
      projectId: sanityProjectId.trim(),
      dataset: sanityDataset.trim(),
      token: sanityToken.trim(),
    });
    setIsSanityModalOpen(false);
    showToast('Configuración de Sanity guardada');
    if (editor) {
      triggerDebouncedVisualSave(editor);
    }
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownInput);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  // Kanban update callbacks
  const handleUpdateTaskFromKanban = useCallback(
    (
      taskId: string,
      updates: {
        title?: string;
        completed?: boolean;
        priority?: TaskPriority;
        status?: TaskStatus;
        groupTitle?: string;
      }
    ) => {
      setMarkdownInput((currentMd) => {
        let updatedMd = currentMd;

        if (updates.groupTitle) {
          updatedMd = moveTaskToGroupInMarkdown(updatedMd, taskId, updates.groupTitle);
        }

        if (
          updates.title !== undefined ||
          updates.completed !== undefined ||
          updates.priority !== undefined ||
          updates.status !== undefined
        ) {
          updatedMd = updateTaskInMarkdown(updatedMd, taskId, {
            title: updates.title,
            completed: updates.completed,
            priority: updates.priority,
            status: updates.status,
          });
        }

        return updatedMd;
      });

      if (editor) {
        const shapes = editor.getCurrentPageShapes();
        const taskShape = shapes.find((s) => {
          if ((s as any).type !== 'task') return false;
          const p = (s as any).props || {};
          return (p.taskId && p.taskId.toLowerCase() === taskId.toLowerCase()) || s.id === taskId;
        });

        if (taskShape) {
          editor.updateShape({
            id: taskShape.id,
            type: 'task',
            props: {
              ...(updates.title !== undefined ? { title: updates.title } : {}),
              ...(updates.completed !== undefined ? { completed: updates.completed } : {}),
              ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
              ...(updates.status !== undefined ? { status: updates.status } : {}),
            },
          } as any);
        }
      }
    },
    [editor]
  );

  const handleBatchUpdateTasksFromKanban = useCallback(
    (
      taskIds: string[],
      updates: {
        completed?: boolean;
        priority?: TaskPriority;
        status?: TaskStatus;
      }
    ) => {
      setMarkdownInput((currentMd) => {
        let updatedMd = currentMd;
        for (const taskId of taskIds) {
          updatedMd = updateTaskInMarkdown(updatedMd, taskId, updates);
        }
        return updatedMd;
      });

      if (editor) {
        const shapes = editor.getCurrentPageShapes();
        for (const taskId of taskIds) {
          const taskShape = shapes.find((s) => {
            if ((s as any).type !== 'task') return false;
            const p = (s as any).props || {};
            return (p.taskId && p.taskId.toLowerCase() === taskId.toLowerCase()) || s.id === taskId;
          });
          if (taskShape) {
            editor.updateShape({
              id: taskShape.id,
              type: 'task',
              props: {
                ...(updates.completed !== undefined ? { completed: updates.completed } : {}),
                ...(updates.priority !== undefined ? { priority: updates.priority } : {}),
                ...(updates.status !== undefined ? { status: updates.status } : {}),
              },
            } as any);
          }
        }
      }
      showToast(`${taskIds.length} tareas actualizadas`);
    },
    [editor]
  );

  const handleBatchDeleteTasksFromKanban = useCallback(
    (taskIds: string[]) => {
      const priorMarkdown = markdownInput;

      setMarkdownInput((currentMd) => {
        let updatedMd = currentMd;
        for (const taskId of taskIds) {
          updatedMd = deleteTaskFromMarkdown(updatedMd, taskId);
        }
        return updatedMd;
      });

      if (editor) {
        const shapes = editor.getCurrentPageShapes();
        const shapesToDelete: string[] = [];
        for (const taskId of taskIds) {
          const taskShape = shapes.find((s) => {
            if ((s as any).type !== 'task') return false;
            const p = (s as any).props || {};
            return (p.taskId && p.taskId.toLowerCase() === taskId.toLowerCase()) || s.id === taskId;
          });
          if (taskShape) {
            shapesToDelete.push(taskShape.id);
          }
        }
        if (shapesToDelete.length > 0) {
          editor.deleteShapes(shapesToDelete as any);
        }
        triggerDebouncedVisualSave(editor);
      }

      pushToast(`${taskIds.length} tareas eliminadas`, 'info', {
        label: 'Deshacer',
        onClick: async () => {
          setMarkdownInput(priorMarkdown);
          if (editor) {
            const visual = await loadCanvasVisualState();
            loadTasksFromMarkdown(editor, priorMarkdown, visual);
            triggerDebouncedVisualSave(editor);
          }
          pushToast(`${taskIds.length} tareas restauradas`, 'success');
        },
      });
    },
    [editor, markdownInput, pushToast, triggerDebouncedVisualSave]
  );

  // All Parsed Tasks for navigation and linking
  const allParsedTasks = useMemo(() => {
    const { taskBlocks } = scanTaskBlocks(markdownInput);
    return taskBlocks.map((b) => {
      const isCompleted = b.rawTaskLine.includes('[x]') || b.rawTaskLine.includes('[X]');
      return {
        taskId: b.detectedId || b.temporaryId,
        title: b.detectedTitle,
        groupTitle: b.groupTitle || 'General',
        completed: isCompleted,
        priority: (b.detectedPriority || 'P1') as TaskPriority,
        status: ((b.detectedStatus as any) || (isCompleted ? 'done' : 'todo')) as TaskStatus,
        tags: b.detectedTags,
        blockedBy: b.detectedBlockedBy,
      };
    });
  }, [markdownInput]);

  // All Available Tags in markdown
  const allAvailableTags = useMemo(() => {
    const tagSet = new Set<string>();
    allParsedTasks.forEach((t) => {
      t.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet);
  }, [allParsedTasks]);

  // Command Palette Actions (DESIGN.md Section 12)
  const commandActions = useMemo<CommandPaletteAction[]>(
    () => [
      {
        id: 'new-task',
        title: 'Crear nueva tarea',
        shortcut: 'N',
        icon: 'add_circle',
        category: 'action',
        perform: () => {
          setIsNewTaskModalOpen(true);
        },
      },
      {
        id: 'view-canvas',
        title: 'Cambiar a vista Canvas',
        shortcut: 'V',
        icon: 'grid_view',
        category: 'view',
        perform: () => {
          setActiveView('canvas');
        },
      },
      {
        id: 'view-kanban',
        title: 'Cambiar a vista Kanban',
        shortcut: 'K',
        icon: 'view_kanban',
        category: 'view',
        perform: () => {
          setActiveView('kanban');
        },
      },
      {
        id: 'auto-organize',
        title: 'Auto organizar Canvas jerárquicamente (DAG)',
        shortcut: 'A',
        icon: 'account_tree',
        category: 'action',
        perform: () => {
          setIsAutoLayoutConfirmOpen(true);
        },
      },
      {
        id: 'toggle-theme',
        title: `Cambiar a tema ${effectiveTheme === 'dark' ? 'claro' : 'oscuro'}`,
        shortcut: 'T',
        icon: effectiveTheme === 'dark' ? 'light_mode' : 'dark_mode',
        category: 'action',
        perform: () => {
          handleUpdateSettings({
            ...userSettings,
            theme: effectiveTheme === 'dark' ? 'light' : 'dark',
          });
        },
      },
      {
        id: 'open-settings',
        title: 'Abrir configuración y preferencias',
        shortcut: '⌘,',
        icon: 'settings',
        category: 'action',
        perform: () => {
          setIsSettingsOpen(true);
        },
      },
      {
        id: 'import-export-modal',
        title: 'Importar / Exportar TASKS.md o JSON',
        shortcut: '⌘E',
        icon: 'sync_alt',
        category: 'action',
        perform: () => {
          setIsImportExportOpen(true);
        },
      },
      {
        id: 'save-file',
        title: 'Guardar archivo TASKS.md',
        shortcut: '⌘S',
        icon: 'save',
        category: 'action',
        perform: () => {
          handleExportFile();
        },
      },
      {
        id: 'view-markdown',
        title: 'Ver TASKS.md en vivo',
        shortcut: 'M',
        icon: 'code',
        category: 'action',
        perform: () => {
          setIsViewMarkdownOpen(true);
        },
      },
      {
        id: 'problems-modal',
        title: 'Ver diagnóstico y problemas de sintaxis',
        shortcut: 'P',
        icon: 'warning',
        category: 'action',
        perform: () => {
          setIsProblemsModalOpen(true);
        },
      },
      {
        id: 'quick-guide',
        title: 'Guía rápida y atajos de teclado',
        shortcut: '?',
        icon: 'help',
        category: 'action',
        perform: () => {
          setIsQuickGuideOpen(true);
        },
      },
      {
        id: 'load-sample-project',
        title: 'Cargar proyecto de ejemplo inicial',
        shortcut: '',
        icon: 'refresh',
        category: 'action',
        perform: () => {
          handleLoadSampleProject();
        },
      },
      {
        id: 'reset-filters',
        title: 'Limpiar todos los filtros y búsqueda',
        shortcut: 'ESC',
        icon: 'filter_alt_off',
        category: 'action',
        perform: () => {
          setSearchQuery('');
          setTaskFilters({
            status: 'all',
            priority: 'all',
            section: 'all',
            tag: 'all',
            onlyBlocked: false,
            sortBy: 'default',
          });
          setActiveFilter('all');
        },
      },
    ],
    [effectiveTheme, handleExportFile]
  );

  // Filtered tasks count computed
  const filteredTasksCount = useMemo(() => {
    return allParsedTasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchId = t.taskId.toLowerCase().includes(q);
        const matchGroup = t.groupTitle.toLowerCase().includes(q);
        const matchTags = t.tags?.some((tag) => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchId && !matchGroup && !matchTags) return false;
      }

      if (taskFilters.status !== 'all') {
        if (taskFilters.status === 'done' && !t.completed) return false;
        if (taskFilters.status !== 'done' && (t.completed || t.status !== taskFilters.status)) return false;
      }

      if (taskFilters.priority !== 'all' && t.priority !== taskFilters.priority) return false;
      if (taskFilters.section !== 'all' && t.groupTitle.toLowerCase() !== taskFilters.section.toLowerCase()) return false;
      if (taskFilters.tag !== 'all' && (!t.tags || !t.tags.some((tag) => tag.toLowerCase() === taskFilters.tag.toLowerCase()))) return false;
      if (taskFilters.onlyBlocked && (!t.blockedBy || t.completed)) return false;

      return true;
    }).length;
  }, [allParsedTasks, searchQuery, taskFilters]);

  // Navigate to task from Command Palette or search
  const handleSelectTaskFromPalette = useCallback(
    (taskId: string) => {
      setSelectedTaskShapeId(taskId);
      pushRecentTask(taskId);
      const found = allParsedTasks.find(
        (t) => t.taskId.toLowerCase() === taskId.toLowerCase()
      );
      if (found) {
        if (activeView === 'canvas') {
          handleFocusTaskOnCanvas(found.taskId, found.title);
        }
      }
    },
    [allParsedTasks, activeView, pushRecentTask, handleFocusTaskOnCanvas]
  );

  // Selected Task Details Helper
  const selectedTaskData = useMemo(() => {
    if (!selectedTaskShapeId) return null;

    const { taskBlocks } = scanTaskBlocks(markdownInput);

    if (editor) {
      const shape = (editor.getShape(selectedTaskShapeId as any) ||
        editor.getCurrentPageShapes().find((s) => {
          if ((s as any).type !== 'task') return false;
          const p = (s as any).props || {};
          return p.taskId === selectedTaskShapeId || p.temporaryId === selectedTaskShapeId || s.id === selectedTaskShapeId;
        })) as any;

      if (shape && shape.type === 'task') {
        const tProps = shape.props || {};
        const resId = tProps.taskId || tProps.temporaryId || selectedTaskShapeId;
        const matchedBlock = taskBlocks.find(
          (b) =>
            (b.detectedId && b.detectedId.toLowerCase() === resId.toLowerCase()) ||
            b.temporaryId.toLowerCase() === resId.toLowerCase()
        );

        return {
          shapeId: shape.id,
          taskId: resId,
          title: tProps.title || '',
          completed: Boolean(tProps.completed),
          priority: (tProps.priority || 'P1') as TaskPriority,
          status: (tProps.status || (tProps.completed ? 'done' : 'todo')) as TaskStatus,
          tags: tProps.tags || matchedBlock?.detectedTags || [],
          subtasks: tProps.subtasks || matchedBlock?.detectedSubtasks,
          blockedBy: tProps.blockedBy || matchedBlock?.detectedBlockedBy || '',
          groupTitle: matchedBlock?.groupTitle || 'General',
        };
      }
    }

    const block = taskBlocks.find(
      (b) =>
        (b.detectedId && b.detectedId.toLowerCase() === selectedTaskShapeId.toLowerCase()) ||
        b.temporaryId.toLowerCase() === selectedTaskShapeId.toLowerCase()
    );

    if (block) {
      const isCompleted = block.rawTaskLine.includes('[x]') || block.rawTaskLine.includes('[X]');
      return {
        shapeId: selectedTaskShapeId,
        taskId: block.detectedId || block.temporaryId,
        title: block.detectedTitle,
        completed: isCompleted,
        priority: block.detectedPriority || 'P1',
        status: (block.detectedStatus as any) || (isCompleted ? 'done' : 'todo'),
        tags: block.detectedTags || [],
        subtasks: block.detectedSubtasks,
        blockedBy: block.detectedBlockedBy || '',
        groupTitle: block.groupTitle || 'General',
      };
    }

    return null;
  }, [selectedTaskShapeId, editor, markdownInput]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col w-screen h-screen overflow-hidden font-sans relative bg-[var(--surface)] text-[var(--on-surface)]"
    >
      {/* Hidden file picker input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        className="hidden"
        aria-hidden="true"
      />

      {/* Top App Bar (DESIGN.md Section 3: Lightweight, global actions, clean M3 surface) */}
      <header className="h-14 bg-[var(--surface-container)] border-b border-[var(--outline)] px-3 sm:px-4 flex items-center justify-between z-20 select-none flex-shrink-0 gap-2 sm:gap-4 transition-colors">
        {/* Left Section: Sidebar Toggle & Project Name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="btn-m3-icon shrink-0 cursor-pointer"
            title={isSidebarOpen ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
            aria-label="Toggle Sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isSidebarOpen ? 'menu_open' : 'menu'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
            <h1 className="text-sm font-semibold tracking-tight text-[var(--on-surface)] font-sans hidden md:inline-block">
              AnTask<span className="text-[var(--primary)]">Canvas</span>
            </h1>
          </div>

          {/* Current File and Unsaved Changes Indicator */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--outline)] text-[11px] sm:text-xs font-mono truncate shadow-xs"
            title={`Archivo: ${currentFileName}${hasUnsavedChanges ? ' (cambios sin guardar)' : ' (sincronizado)'}`}
          >
            <span className="material-symbols-outlined text-[15px] text-[var(--on-surface-variant)] hidden sm:inline">
              description
            </span>
            <span className="font-medium text-[var(--on-surface)] truncate max-w-[100px] sm:max-w-[140px]">
              {currentFileName}
            </span>
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1 text-amber-400 text-[10px] sm:text-[11px] shrink-0 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden lg:inline">modificado</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 text-[10px] sm:text-[11px] shrink-0 font-sans">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="hidden lg:inline">al día</span>
              </span>
            )}
          </div>
        </div>

        {/* Center Section: View Switcher (Canvas / Kanban) & Quick Search bar */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 max-w-xs md:max-w-md lg:max-w-lg mx-2 justify-center">
          {/* View Switcher Segmented Control (DESIGN.md Section 14 & 15) */}
          <div className="flex items-center bg-[var(--surface)] p-0.5 rounded-full border border-[var(--outline)] shadow-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('canvas')}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'canvas'
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-xs'
                  : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              }`}
              title="Vista espacial en Canvas interactivo"
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
              <span className="hidden sm:inline">Canvas</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('kanban')}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'kanban'
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-xs'
                  : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
              }`}
              title="Vista de Tablero Kanban por columnas"
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              <span className="hidden sm:inline">Kanban</span>
            </button>
          </div>

          <div className="relative w-full hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[var(--on-surface-variant)] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tarea por título o #ID..."
              className="w-full bg-[var(--surface)] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] border border-[var(--outline)] rounded-full pl-9 pr-14 py-1.5 text-xs font-sans focus:outline-none focus:border-[var(--primary)] transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
                title="Limpiar búsqueda"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[var(--surface-container)] border border-[var(--outline)] text-[10px] font-mono text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
                title="Abrir paleta de comandos (⌘K)"
              >
                ⌘K
              </button>
            )}
          </div>
        </div>

        {/* Right Section: Global Actions (Primary CTA, Auto Layout, Save, View .md, Help, Theme) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Offline indicator badge */}
          {!isOnline && (
            <span
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 text-[10px] sm:text-[11px] font-sans"
              title="Sin conexión a internet. Los cambios se guardarán localmente."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}

          {/* Quick Save Button */}
          <button
            type="button"
            onClick={handleExportFile}
            className={`btn-m3-secondary px-3 py-1.5 text-xs cursor-pointer ${
              hasUnsavedChanges
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/40 shadow-xs'
                : ''
            }`}
            title="Guardar archivo TASKS.md en disco (⌘S)"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span className="hidden sm:inline">Guardar</span>
          </button>

          {/* Auto Organizar Button with loading feedback */}
          <button
            type="button"
            disabled={isAutoOrganizing}
            onClick={() => setIsAutoLayoutConfirmOpen(true)}
            className="btn-m3-secondary hidden sm:inline-flex px-3 py-1.5 text-xs cursor-pointer text-sky-400 border-sky-800/60 bg-sky-950/30"
            title="Organizar automáticamente dependencias y grupos jerárquicamente (DAG)"
          >
            <span
              className={`material-symbols-outlined text-[16px] ${
                isAutoOrganizing ? 'animate-spin' : ''
              }`}
            >
              {isAutoOrganizing ? 'progress_activity' : 'account_tree'}
            </span>
            <span className="hidden md:inline">
              {isAutoOrganizing ? 'Organizando...' : 'Auto organizar'}
            </span>
          </button>

          {/* Nueva Tarea (Primary Action) */}
          <button
            type="button"
            onClick={() => {
              if (existingSections.length > 0 && !isCustomGroup) {
                setNewTaskGroup(existingSections[0]);
              }
              setIsNewTaskModalOpen(true);
            }}
            className="btn-m3-primary px-3.5 py-1.5 cursor-pointer shadow-sm"
            title="Crear nueva tarea (N)"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span className="hidden xs:inline">Nueva tarea</span>
          </button>

          {/* Validation Issues Alert Chip (if any) */}
          {validationReport.issues.length > 0 && (
            <button
              type="button"
              onClick={() => setIsProblemsModalOpen(true)}
              className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-full border flex items-center gap-1.5 cursor-pointer ${
                validationReport.hasErrors
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800 animate-pulse'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
              }`}
              title="Ver problemas detectados en el Markdown (P)"
            >
              <span>⚠</span>
              <span>{validationReport.issues.length}</span>
            </button>
          )}

          {/* Quick Guide & Shortcuts Button */}
          <button
            type="button"
            onClick={() => setIsQuickGuideOpen(true)}
            className="btn-m3-icon shrink-0 cursor-pointer hidden sm:inline-flex"
            title="Guía rápida y atajos de teclado (?)"
            aria-label="Abrir guía de uso y atajos"
          >
            <span className="material-symbols-outlined text-[18px]">help</span>
          </button>

          {/* Settings Button (DESIGN.md Section 4 & Fase 7) */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="btn-m3-icon shrink-0 cursor-pointer hidden sm:inline-flex"
            title="Configuración y preferencias (⌘,)"
            aria-label="Abrir configuración"
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
          </button>

          {/* Theme Toggle (DESIGN.md Section 4: Light & Dark Theme) */}
          <button
            type="button"
            onClick={() =>
              handleUpdateSettings({
                ...userSettings,
                theme: effectiveTheme === 'dark' ? 'light' : 'dark',
              })
            }
            className="btn-m3-icon shrink-0 cursor-pointer hidden sm:inline-flex"
            title={`Cambiar a tema ${effectiveTheme === 'dark' ? 'claro' : 'oscuro'} (T)`}
            aria-label="Alternar tema"
          >
            <span className="material-symbols-outlined text-[18px]">
              {effectiveTheme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="btn-m3-icon sm:hidden shrink-0 cursor-pointer"
            aria-label="Abrir menú"
          >
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>
        </div>
      </header>

      {/* Main App Body: Sidebar + Workspace (Canvas) + Details Panel (DESIGN.md Section 3 & 16) */}
      <div className="flex-1 w-full flex overflow-hidden relative">
        {/* Collapsible Sidebar (DESIGN.md Section 3: Projects, Sections, Filters, Tools) */}
        {isSidebarOpen && (
          <aside className="w-64 bg-[var(--surface-container)] border-r border-[var(--outline)] flex flex-col justify-between p-3 select-none flex-shrink-0 z-10 transition-all duration-200">
            <div className="flex flex-col gap-4 overflow-y-auto">
              {/* Quick Actions / New Task & File Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenFilePicker}
                  className="btn-m3-secondary flex-1 py-1.5 text-xs cursor-pointer"
                  title="Abrir TASKS.md desde el equipo"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  <span>Abrir archivo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportExportOpen(true)}
                  className="btn-m3-secondary px-2.5 py-1.5 text-xs cursor-pointer"
                  title="Importar o Exportar TASKS.md / JSON"
                >
                  <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                </button>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider px-2">
                  Filtros & Estados
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('all');
                    setTaskFilters((prev) => ({ ...prev, status: 'all', priority: 'all', onlyBlocked: false }));
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    activeFilter === 'all' && taskFilters.status === 'all' && taskFilters.priority === 'all' && !taskFilters.onlyBlocked
                      ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                      : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-sky-400">inbox</span>
                    <span>Todas las tareas</span>
                  </div>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--surface)] text-[var(--on-surface-variant)]">
                    {parsedStats.taskCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('todo');
                    setTaskFilters((prev) => ({ ...prev, status: 'todo', priority: 'all', onlyBlocked: false }));
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    activeFilter === 'todo' || taskFilters.status === 'todo'
                      ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                      : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-400">pending</span>
                    <span>Pendientes (Todo)</span>
                  </div>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--surface)] text-[var(--on-surface-variant)]">
                    {parsedStats.taskCount - parsedStats.completedCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('done');
                    setTaskFilters((prev) => ({ ...prev, status: 'done', priority: 'all', onlyBlocked: false }));
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    activeFilter === 'done' || taskFilters.status === 'done'
                      ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                      : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
                    <span>Completadas (Done)</span>
                  </div>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--surface)] text-[var(--on-surface-variant)]">
                    {parsedStats.completedCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('critical');
                    setTaskFilters((prev) => ({ ...prev, priority: 'P0', onlyBlocked: false }));
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    activeFilter === 'critical' || taskFilters.priority === 'P0'
                      ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                      : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-rose-400">priority_high</span>
                    <span>Críticas (P0)</span>
                  </div>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--surface)] text-[var(--on-surface-variant)]">
                    {parsedStats.criticalCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter('blocked');
                    setTaskFilters((prev) => ({ ...prev, onlyBlocked: true }));
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    activeFilter === 'blocked' || taskFilters.onlyBlocked
                      ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                      : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-amber-500">lock</span>
                    <span>Bloqueadas</span>
                  </div>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--surface)] text-[var(--on-surface-variant)]">
                    {parsedStats.blockedCount}
                  </span>
                </button>
              </div>

              {/* Sections & Groups List */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between px-2">
                  <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                    Secciones ({parsedGroups.length})
                  </span>
                  {taskFilters.section !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setTaskFilters((prev) => ({ ...prev, section: 'all' }))}
                      className="text-[10px] text-[var(--primary)] hover:underline cursor-pointer"
                    >
                      Ver todas
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
                  {parsedGroups.map((grp) => {
                    const doneInGrp = grp.tasks.filter((t) => t.completed).length;
                    const isSectionActive = taskFilters.section.toLowerCase() === grp.title.toLowerCase();
                    return (
                      <button
                        key={grp.title}
                        type="button"
                        onClick={() => {
                          setTaskFilters((prev) => ({
                            ...prev,
                            section: isSectionActive ? 'all' : grp.title,
                          }));
                          if (activeView === 'canvas') {
                            handleFocusSectionOnCanvas(grp.title);
                          }
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between text-left transition-colors cursor-pointer group ${
                          isSectionActive
                            ? 'bg-[var(--primary-container)]/30 text-[var(--primary)] font-semibold'
                            : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]'
                        }`}
                      >
                        <span className="truncate max-w-[140px]">## {grp.title}</span>
                        <span className="text-[10px] font-mono opacity-80">
                          {doneInGrp}/{grp.tasks.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar Footer: Tools & Persistence */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-[var(--outline)]">
              <button
                type="button"
                onClick={() => setIsImportExportOpen(true)}
                className="btn-m3-text w-full py-1.5 text-xs justify-start px-2 cursor-pointer text-emerald-400"
              >
                <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                <span>Importar / Exportar</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="btn-m3-text w-full py-1.5 text-xs justify-start px-2 cursor-pointer text-[var(--on-surface)]"
              >
                <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">settings</span>
                <span>Configuración</span>
              </button>

              <button
                type="button"
                onClick={() => setIsViewMarkdownOpen(true)}
                className="btn-m3-text w-full py-1.5 text-xs justify-start px-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-sky-400">code</span>
                <span>Ver TASKS.md en vivo</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSanityModalOpen(true)}
                className="btn-m3-text w-full py-1.5 text-xs justify-start px-2 cursor-pointer"
              >
                <span
                  className={`w-2 h-2 rounded-full mr-1 ${
                    syncStatus === 'synced' ? 'bg-emerald-400' : 'bg-cyan-400'
                  }`}
                />
                <span>Persistencia Visual</span>
              </button>

              <button
                type="button"
                onClick={handleResetLayout}
                className="btn-m3-text w-full py-1.5 text-xs justify-start px-2 text-[var(--on-surface-variant)] hover:text-rose-400 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                <span>Reiniciar canvas</span>
              </button>
            </div>
          </aside>
        )}

        {/* Workspace: Infinite Canvas vs Kanban Board (DESIGN.md Section 3, 14 & 15) */}
        <main className="flex-1 h-full relative overflow-hidden bg-[var(--surface)] flex flex-col">
          {/* Advanced Filter Bar (DESIGN.md Section 6, 7 & 8) */}
          <FilterBar
            filters={taskFilters}
            onFilterChange={(f) => setTaskFilters(f)}
            onResetFilters={() => {
              setSearchQuery('');
              setTaskFilters({
                status: 'all',
                priority: 'all',
                section: 'all',
                tag: 'all',
                onlyBlocked: false,
                sortBy: 'default',
              });
              setActiveFilter('all');
            }}
            searchQuery={searchQuery}
            onSearchChange={(q) => setSearchQuery(q)}
            availableSections={existingSections}
            availableTags={allAvailableTags}
            totalTasksCount={allParsedTasks.length}
            filteredTasksCount={filteredTasksCount}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          />

          <div className="flex-1 relative overflow-hidden w-full h-full">
            {activeView === 'canvas' ? (
              <>
                <Tldraw
                  shapeUtils={customShapeUtils}
                  onMount={handleMount}
                  autoFocus
                />

                {/* Floating Canvas Navigation Controls (DESIGN.md Section 3 & 14) */}
                <div className="absolute bottom-4 left-4 z-10 hidden sm:flex items-center gap-1 bg-[var(--surface-container)]/95 backdrop-blur-md border border-[var(--outline)] rounded-full p-1 shadow-lg select-none">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="btn-m3-icon w-7 h-7 cursor-pointer"
                    title="Alejar zoom (Zoom Out)"
                    aria-label="Zoom out"
                  >
                    <span className="material-symbols-outlined text-[16px]">remove</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2 py-0.5 text-xs font-mono font-medium text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] rounded-full transition-colors cursor-pointer"
                    title="Clic para restablecer zoom al 100%"
                  >
                    {canvasZoom}%
                  </button>

                  <button
                    type="button"
                    onClick={handleZoomIn}
                    className="btn-m3-icon w-7 h-7 cursor-pointer"
                    title="Acercar zoom (Zoom In)"
                    aria-label="Zoom in"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </button>

                  <div className="w-px h-4 bg-[var(--outline)] my-auto mx-0.5" />

                  <button
                    type="button"
                    onClick={handleZoomToFit}
                    className="btn-m3-icon w-7 h-7 cursor-pointer"
                    title="Ajustar zoom al contenido (Zoom to Fit)"
                    aria-label="Zoom to fit"
                  >
                    <span className="material-symbols-outlined text-[16px]">fit_screen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAutoLayoutConfirmOpen(true)}
                    className="btn-m3-icon w-7 h-7 cursor-pointer text-sky-400"
                    title="Auto organizar canvas jerárquicamente (DAG)"
                    aria-label="Auto organizar"
                  >
                    <span className="material-symbols-outlined text-[16px]">account_tree</span>
                  </button>
                </div>

                {/* Canvas Empty State Overlay */}
                {allParsedTasks.length === 0 && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
                    <div className="pointer-events-auto bg-[var(--surface-container)]/95 backdrop-blur-md border border-[var(--outline)] rounded-3xl p-6 sm:p-8 max-w-md text-center shadow-2xl animate-fade-in flex flex-col items-center">
                      <div className="w-14 h-14 rounded-2xl bg-[var(--primary-container)]/30 border border-[var(--primary)]/30 flex items-center justify-center text-[var(--primary)] mb-3 shadow-xs">
                        <span className="material-symbols-outlined text-[28px]">grid_view</span>
                      </div>
                      <h3 className="text-base font-semibold text-[var(--on-surface)] font-sans mb-1">
                        Lienzo vacío
                      </h3>
                      <p className="text-xs text-[var(--on-surface-variant)] mb-5 leading-relaxed">
                        No hay tareas en este archivo TASKS.md. Comienza añadiendo una tarea o carga un proyecto de ejemplo.
                      </p>
                      <div className="flex items-center gap-2.5 flex-wrap justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (existingSections.length > 0 && !isCustomGroup) {
                              setNewTaskGroup(existingSections[0]);
                            }
                            setIsNewTaskModalOpen(true);
                          }}
                          className="btn-m3-primary px-4 py-2 text-xs cursor-pointer shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          <span>Crear primera tarea</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleLoadSampleProject}
                          className="btn-m3-secondary px-3.5 py-2 text-xs cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                          <span>Cargar ejemplo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating Canvas Multi-Selection Action Bar (DESIGN.md Section 14) */}
                {selectedTaskIdsOnCanvas.length > 1 && (
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 bg-[var(--surface-container)]/95 backdrop-blur-md border border-[var(--outline)] rounded-full px-3 py-1.5 shadow-2xl flex items-center gap-2 animate-slide-up select-none max-w-[95vw] overflow-x-auto">
                    <div className="flex items-center gap-1.5 pr-2 border-r border-[var(--outline)] shrink-0">
                      <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                      <span className="text-xs font-mono font-medium text-[var(--on-surface)]">
                        {selectedTaskIdsOnCanvas.length} seleccionadas
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleBatchUpdateTasksFromKanban(selectedTaskIdsOnCanvas, {
                          completed: true,
                          status: 'done',
                        })
                      }
                      className="btn-m3-secondary px-2.5 py-1 text-xs text-emerald-400 border-emerald-800/60 bg-emerald-950/30 cursor-pointer shrink-0"
                      title="Marcar seleccionadas como completadas"
                    >
                      <span className="material-symbols-outlined text-[15px]">check_circle</span>
                      <span className="hidden sm:inline">Completar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleBatchUpdateTasksFromKanban(selectedTaskIdsOnCanvas, {
                          completed: false,
                          status: 'todo',
                        })
                      }
                      className="btn-m3-secondary px-2.5 py-1 text-xs text-amber-400 border-amber-800/60 bg-amber-950/30 cursor-pointer shrink-0"
                      title="Marcar seleccionadas como pendientes"
                    >
                      <span className="material-symbols-outlined text-[15px]">pending</span>
                      <span className="hidden sm:inline">Pendiente</span>
                    </button>

                    {/* Quick Priorities */}
                    <div className="flex items-center gap-1 shrink-0 border-l border-r border-[var(--outline)] px-1.5">
                      {(['P0', 'P1', 'P2', 'P3'] as TaskPriority[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            handleBatchUpdateTasksFromKanban(selectedTaskIdsOnCanvas, { priority: p })
                          }
                          className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded-md border border-[var(--outline)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] cursor-pointer"
                          title={`Establecer prioridad ${p}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleBatchDeleteTasksFromKanban(selectedTaskIdsOnCanvas);
                      }}
                      className="btn-m3-secondary px-2.5 py-1 text-xs text-[var(--error)] border-rose-800/60 bg-rose-950/30 cursor-pointer shrink-0"
                      title="Eliminar tareas seleccionadas"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                      <span className="hidden sm:inline">Eliminar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (editor) {
                          editor.selectNone();
                        }
                        setSelectedTaskIdsOnCanvas([]);
                        setSelectedTaskShapeId(null);
                      }}
                      className="btn-m3-icon w-6 h-6 shrink-0 cursor-pointer"
                      title="Deseleccionar"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <KanbanBoard
                markdown={markdownInput}
                isLoading={isLoadingDocument}
                onOpenSampleProject={handleLoadSampleProject}
                onUpdateTask={handleUpdateTaskFromKanban}
                onBatchUpdateTasks={handleBatchUpdateTasksFromKanban}
                onDeleteTask={(taskId, title) => {
                  const dependents = findDependentTasks(markdownInput, taskId);
                  setDeleteWarningState({
                    shapeId: taskId,
                    taskId,
                    title,
                    dependents,
                  });
                }}
                onBatchDeleteTasks={handleBatchDeleteTasksFromKanban}
                onSelectTask={(id) => setSelectedTaskShapeId(id)}
                selectedTaskId={selectedTaskShapeId}
                onOpenNewTaskModalWithGroup={(groupOrStatus) => {
                  if (existingSections.includes(groupOrStatus)) {
                    setNewTaskGroup(groupOrStatus);
                  }
                  setIsNewTaskModalOpen(true);
                }}
                searchQuery={searchQuery}
                activeFilter={activeFilter}
                filters={taskFilters}
                onResetFilters={() => {
                  setSearchQuery('');
                  setTaskFilters({
                    status: 'all',
                    priority: 'all',
                    section: 'all',
                    tag: 'all',
                    onlyBlocked: false,
                    sortBy: 'default',
                  });
                  setActiveFilter('all');
                }}
              />
            )}

            {/* Drag & Drop Discrete Overlay */}
            {isDraggingOver && (
              <div className="absolute inset-0 z-50 pointer-events-none bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center animate-fade-in p-6">
                <div className="w-16 h-16 rounded-2xl bg-sky-950/80 border border-sky-600 flex items-center justify-center text-sky-400 mb-4 shadow-xl">
                  <span className="material-symbols-outlined text-[32px]">upload_file</span>
                </div>
                <h3 className="text-base font-semibold text-white font-sans mb-1">
                  Suelta tu archivo TASKS.md aquí
                </h3>
                <p className="text-xs text-slate-400 font-sans">
                  Se parseará automáticamente manteniendo coordenadas y jerarquía
                </p>
              </div>
            )}
          </div>

          {/* Toast notification system */}
          <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
        </main>

        {/* Details Panel (DESIGN.md Section 16 & Fase 4: Modular Details & Multi-Selection Panel) */}
        {(selectedTaskData || selectedTaskIdsOnCanvas.length > 1) && (
          <TaskDetailsPanel
            task={selectedTaskData}
            selectedTaskIds={selectedTaskIdsOnCanvas}
            allTasks={allParsedTasks}
            allSections={existingSections}
            onUpdateTask={handleUpdateTaskFromKanban}
            onBatchUpdateTasks={handleBatchUpdateTasksFromKanban}
            onDeleteTask={(taskId, title) => {
              const dependents = findDependentTasks(markdownInput, taskId);
              setDeleteWarningState({
                shapeId: taskId,
                taskId,
                title,
                dependents,
              });
            }}
            onBatchDeleteTasks={handleBatchDeleteTasksFromKanban}
            onSelectTask={(id) => {
              setSelectedTaskShapeId(id);
              if (id) {
                const found = allParsedTasks.find(
                  (t) => t.taskId.toLowerCase() === id.toLowerCase()
                );
                if (found) {
                  handleFocusTaskOnCanvas(found.taskId, found.title);
                }
              }
            }}
            onFocusOnCanvas={(taskId, title) => {
              if (activeView !== 'canvas') {
                setActiveView('canvas');
              }
              setTimeout(() => {
                handleFocusTaskOnCanvas(taskId, title);
              }, 100);
            }}
            onClose={() => {
              setSelectedTaskShapeId(null);
              if (editor) {
                editor.selectNone();
              }
              setSelectedTaskIdsOnCanvas([]);
            }}
          />
        )}
      </div>

      {/* Floating Bottom Navigation Bar for Mobile */}
      <nav
        aria-label="Acciones rápidas móviles"
        className="sm:hidden fixed bottom-3 left-3 right-3 z-30 bg-[var(--surface-container)]/95 backdrop-blur-md border border-[var(--outline)] rounded-2xl shadow-2xl p-1.5 flex items-center justify-between gap-1 pb-safe"
      >
        <button
          type="button"
          onClick={() => {
            if (existingSections.length > 0 && !isCustomGroup) {
              setNewTaskGroup(existingSections[0]);
            }
            setIsNewTaskModalOpen(true);
          }}
          className="btn-m3-primary flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center text-[10px] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>+ Tarea</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView(activeView === 'canvas' ? 'kanban' : 'canvas')}
          className="btn-m3-secondary flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center text-[10px] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">
            {activeView === 'canvas' ? 'view_kanban' : 'grid_view'}
          </span>
          <span>{activeView === 'canvas' ? 'Kanban' : 'Canvas'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsAutoLayoutConfirmOpen(true)}
          className="btn-m3-secondary flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center text-[10px] cursor-pointer text-sky-400"
        >
          <span className="material-symbols-outlined text-[18px]">account_tree</span>
          <span>Organizar</span>
        </button>

        <button
          type="button"
          onClick={handleZoomToFit}
          className="btn-m3-secondary flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center text-[10px] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">fit_screen</span>
          <span>Ajustar</span>
        </button>

        <button
          type="button"
          onClick={() => setIsViewMarkdownOpen(true)}
          className="btn-m3-secondary flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center text-[10px] cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">code</span>
          <span>Ver .md</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="btn-m3-secondary flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center text-[10px] cursor-pointer relative"
        >
          {validationReport.issues.length > 0 && (
            <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
          <span className="material-symbols-outlined text-[18px]">menu</span>
          <span>Menú</span>
        </button>
      </nav>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs sm:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-full bg-[var(--surface-container)] border-t border-[var(--outline)] rounded-t-3xl shadow-2xl p-4 flex flex-col gap-4 animate-slide-up max-h-[85vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Opciones y herramientas"
          >
            <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto" />

            <div className="flex items-center justify-between border-b border-[var(--outline)] pb-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--on-surface)] font-sans">
                  Menú de Opciones
                </h2>
                <p className="text-xs text-[var(--on-surface-variant)] font-mono">
                  {currentFileName} · {parsedStats.taskCount} tareas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="btn-m3-icon w-8 h-8"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenFilePicker();
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between text-[var(--on-surface)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">folder_open</span>
                  <span>Abrir TASKS.md</span>
                </div>
                <span>➔</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleExportFile();
                }}
                className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl border flex items-center justify-between ${
                  hasUnsavedChanges
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-semibold'
                    : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">save</span>
                  <span>Guardar {currentFileName}</span>
                </div>
                {hasUnsavedChanges && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                    Modificado
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsImportExportOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between text-[var(--on-surface)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">sync_alt</span>
                  <span>Importar / Exportar</span>
                </div>
                <span>➔</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between text-[var(--on-surface)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">settings</span>
                  <span>Configuración & Preferencias</span>
                </div>
                <span>➔</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsQuickGuideOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between text-[var(--on-surface)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">help</span>
                  <span>Guía rápida y atajos</span>
                </div>
                <span>➔</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsProblemsModalOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between text-[var(--on-surface)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-amber-400">⚠</span>
                  <span>Panel de problemas</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--surface-container-high)]">
                  {validationReport.issues.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSanityModalOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between text-[var(--on-surface)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>Persistencia visual</span>
                </div>
                <span className="text-[10px] text-[var(--on-surface-variant)]">{syncStatus}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Panel de Problemas */}
      {isProblemsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsProblemsModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-2xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none max-h-[90vh] sm:max-h-[85vh] pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="problems-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-3.5 border-b border-[var(--outline)] flex items-center justify-between">
              <div>
                <h2 id="problems-modal-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans flex items-center gap-2">
                  <span>Problemas detectados en TASKS.md</span>
                </h2>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5 font-sans">
                  El editor previene la corrupción manteniendo una única fuente de verdad.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProblemsModalOpen(false)}
                className="btn-m3-icon w-8 h-8"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="px-5 py-2.5 bg-[var(--surface)] border-b border-[var(--outline)] flex items-center gap-4 text-xs font-mono overflow-x-auto">
              <span>Total: <strong className="text-[var(--on-surface)]">{validationReport.issues.length}</strong></span>
              <span className="text-rose-400">Errores: <strong>{validationReport.errorCount}</strong></span>
              <span className="text-amber-400">Avisos: <strong>{validationReport.warningCount}</strong></span>
            </div>

            <div className="p-4 sm:p-5 overflow-auto max-h-[50vh] flex flex-col gap-2.5">
              {validationReport.issues.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/80 border border-emerald-700 flex items-center justify-center text-emerald-400 text-lg">
                    ✓
                  </div>
                  <p className="text-xs text-[var(--on-surface-variant)]">Documento válido sin incidencias.</p>
                </div>
              ) : (
                validationReport.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="text-amber-400 font-bold shrink-0 mt-0.5">⚠</span>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-semibold text-[var(--on-surface)] truncate">{issue.message}</span>
                        {issue.details && (
                          <span className="text-[11px] text-[var(--on-surface-variant)]">{issue.details}</span>
                        )}
                      </div>
                    </div>
                    {issue.taskId && (
                      <button
                        type="button"
                        onClick={() => handleFocusTaskOnCanvas(issue.taskId, issue.taskTitle)}
                        className="btn-m3-secondary px-2.5 py-1 text-[11px] cursor-pointer"
                      >
                        Localizar
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 bg-[var(--surface)] border-t border-[var(--outline)] flex justify-end">
              <button
                type="button"
                onClick={() => setIsProblemsModalOpen(false)}
                className="btn-m3-secondary px-4 py-1.5 text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmación Auto Organizar */}
      {isAutoLayoutConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsAutoLayoutConfirmOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="autolayout-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-[var(--outline)] flex items-center justify-between">
              <h2 id="autolayout-modal-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">account_tree</span>
                <span>Auto organizar Canvas (DAG)</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsAutoLayoutConfirmOpen(false)}
                className="btn-m3-icon w-8 h-8"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 text-xs text-[var(--on-surface-variant)] leading-relaxed">
              <p>
                Esta acción organizará todas las tarjetas y secciones en un grafo jerárquico según sus dependencias <code className="text-[var(--primary)] font-mono">blockedBy</code>.
              </p>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline)] text-[11px] font-mono">
                • {parsedStats.taskCount} tareas en {parsedStats.groupCount} secciones
              </div>
            </div>

            <div className="px-5 py-3.5 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAutoLayoutConfirmOpen(false)}
                className="btn-m3-text px-4 py-1.5 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteAutoLayout}
                className="btn-m3-primary px-4 py-1.5 text-xs cursor-pointer"
              >
                Auto organizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nueva Tarea */}
      {isNewTaskModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsNewTaskModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-[var(--outline)] flex items-center justify-between">
              <h2 id="new-task-modal-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">add_task</span>
                <span>Crear Nueva Tarea</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsNewTaskModalOpen(false)}
                className="btn-m3-icon w-8 h-8"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--on-surface)]">Título de la tarea</label>
                <input
                  type="text"
                  autoFocus
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="ej. Crear recuperación de contraseña"
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs font-sans text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              {/* Priority Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--on-surface)]">Prioridad</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['P0', 'P1', 'P2', 'P3'] as TaskPriority[]).map((p) => {
                    const isSelected = newTaskPriority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTaskPriority(p)}
                        className={`py-2 px-2 text-xs font-mono font-bold rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)]'
                            : 'bg-[var(--surface)] text-[var(--on-surface-variant)] border-[var(--outline)]'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section / Group */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--on-surface)]">Sección</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomGroup(!isCustomGroup)}
                    className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    {isCustomGroup ? 'Elegir existente' : '+ Nueva sección'}
                  </button>
                </div>

                {isCustomGroup ? (
                  <input
                    type="text"
                    value={customGroupInput}
                    onChange={(e) => setCustomGroupInput(e.target.value)}
                    placeholder="ej. Notificaciones"
                    className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs font-sans text-[var(--on-surface)] focus:outline-none"
                  />
                ) : (
                  <select
                    value={newTaskGroup}
                    onChange={(e) => setNewTaskGroup(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs font-sans text-[var(--on-surface)] focus:outline-none cursor-pointer"
                  >
                    {existingSections.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--outline)]">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="btn-m3-text px-4 py-1.5 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="btn-m3-primary px-5 py-1.5 text-xs cursor-pointer shadow-sm"
                >
                  Crear Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Advertencia / Confirmación de Eliminación */}
      {deleteWarningState && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setDeleteWarningState(null)}
        >
          <div
            className="w-full sm:max-w-md bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-warning-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-[var(--outline)] flex items-center justify-between">
              <h2 id="delete-warning-title" className="text-sm font-semibold text-rose-400 font-sans flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Confirmar Eliminación</span>
              </h2>
              <button
                type="button"
                onClick={() => setDeleteWarningState(null)}
                className="btn-m3-icon w-8 h-8"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 text-xs text-[var(--on-surface-variant)] leading-relaxed">
              <p>
                ¿Estás seguro de que deseas eliminar la tarea <strong className="text-[var(--on-surface)]">"{deleteWarningState.title}"</strong> (#{deleteWarningState.taskId})?
              </p>

              {deleteWarningState.dependents.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200">
                  <span className="font-semibold block mb-1">Tareas dependientes que quedarán afectadas:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {deleteWarningState.dependents.map((dep) => (
                      <li key={dep.taskId}>
                        #{dep.taskId} ({dep.title}) en <em>{dep.groupTitle}</em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteWarningState(null)}
                className="btn-m3-text px-4 py-1.5 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTask}
                className="btn-m3-primary bg-rose-600 hover:bg-rose-500 text-white px-5 py-1.5 text-xs cursor-pointer shadow-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ver TASKS.md Sincronizado */}
      {isViewMarkdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsViewMarkdownOpen(false)}
        >
          <div
            className="w-full sm:max-w-2xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none max-h-[90vh] sm:max-h-[85vh] pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-markdown-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-[var(--outline)] flex items-center justify-between">
              <div>
                <h2 id="view-markdown-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
                  TASKS.md — Sincronizado en Vivo
                </h2>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                  {parsedStats.taskCount} tareas · {parsedStats.groupCount} secciones
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsViewMarkdownOpen(false)}
                className="btn-m3-icon w-8 h-8"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 sm:p-5 flex flex-col gap-3 overflow-hidden">
              <div className="relative w-full rounded-2xl bg-[var(--surface)] border border-[var(--outline)] overflow-hidden">
                <pre className="p-3.5 sm:p-4 text-xs font-mono text-[var(--on-surface)] overflow-auto max-h-[46vh] leading-relaxed select-text whitespace-pre-wrap">
                  {markdownInput}
                </pre>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-between">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="btn-m3-secondary px-4 py-1.5 text-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>{copiedMarkdown ? '¡Copiado!' : 'Copiar Markdown'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsViewMarkdownOpen(false)}
                className="btn-m3-text px-4 py-1.5 text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Importar / Exportar TASKS.md o JSON (DESIGN.md Section 12-18 & Fase 7) */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        currentMarkdown={markdownInput}
        currentFileName={currentFileName}
        onImportMarkdown={handleImportMarkdownFromModal}
        onExportMarkdown={handleExportMarkdownFromModal}
      />

      {/* Modal: Configuración Sanity */}
      {isSanityModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsSanityModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sanity-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-[var(--outline)] flex items-center justify-between">
              <div>
                <h2 id="sanity-modal-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
                  Persistencia Visual (Sanity)
                </h2>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                  Guarda coordenadas espaciales <code className="text-[var(--on-surface)]">(taskId, x, y, w, h)</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSanityModalOpen(false)}
                className="btn-m3-icon w-8 h-8"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveSanityConfig} className="p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline)] text-xs text-[var(--on-surface-variant)] leading-relaxed">
                <span className="text-[var(--primary)] font-semibold">Single Source of Truth: </span>
                TASKS.md define títulos, estados y prioridades. Sanity guarda la posición visual en el canvas.
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--on-surface)]">Project ID</label>
                <input
                  type="text"
                  value={sanityProjectId}
                  onChange={(e) => setSanityProjectId(e.target.value)}
                  placeholder="ej. 8k9abcde"
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--on-surface)]">Dataset</label>
                <input
                  type="text"
                  value={sanityDataset}
                  onChange={(e) => setSanityDataset(e.target.value)}
                  placeholder="production"
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[var(--on-surface)]">API Token (Opcional)</label>
                <input
                  type="password"
                  value={sanityToken}
                  onChange={(e) => setSanityToken(e.target.value)}
                  placeholder="sk..."
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--outline)]">
                <button
                  type="button"
                  onClick={() => setIsSanityModalOpen(false)}
                  className="btn-m3-text px-4 py-1.5 text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-m3-primary px-5 py-1.5 text-xs cursor-pointer shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Command Palette & Search Modal (Ctrl/Cmd + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        tasks={allParsedTasks}
        sections={existingSections}
        tags={allAvailableTags}
        recentTaskIds={recentTaskIds}
        onSelectTask={handleSelectTaskFromPalette}
        onSelectSection={(sec) => {
          setTaskFilters((prev) => ({ ...prev, section: sec }));
          if (activeView === 'canvas') {
            handleFocusSectionOnCanvas(sec);
          }
        }}
        onSelectTag={(tag) => {
          setTaskFilters((prev) => ({ ...prev, tag }));
        }}
        actions={commandActions}
      />

      {/* Quick Guide & Shortcuts Modal (?) */}
      <QuickGuideModal
        isOpen={isQuickGuideOpen}
        onClose={() => setIsQuickGuideOpen(false)}
        onOpenSampleProject={handleLoadSampleProject}
      />

      {/* Settings & Preferences Modal (DESIGN.md Section 4 & Fase 7) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={userSettings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSanityConfig={() => setIsSanityModalOpen(true)}
        onOpenFilePicker={handleOpenFilePicker}
        onResetCanvasLayout={handleResetLayout}
        onShowToast={pushToast}
      />
    </div>
  );
}
