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

  // Theme state (DESIGN.md Section 4)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Shell Layout State (DESIGN.md Section 3 & 16)
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'canvas' | 'kanban'>('canvas');
  const [selectedTaskShapeId, setSelectedTaskShapeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'todo' | 'done' | 'critical' | 'blocked'>('all');

  // Modals state
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isViewMarkdownOpen, setIsViewMarkdownOpen] = useState<boolean>(false);
  const [isSanityModalOpen, setIsSanityModalOpen] = useState<boolean>(false);
  const [isAutoLayoutConfirmOpen, setIsAutoLayoutConfirmOpen] = useState<boolean>(false);
  const [isProblemsModalOpen, setIsProblemsModalOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [deleteWarningState, setDeleteWarningState] = useState<DeleteWarningInfo | null>(null);

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  // Set theme attribute on html
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

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
      editor.user.updateUserPreferences({ colorScheme: theme === 'dark' ? 'dark' : 'light' });
    }
  }, [editor, theme]);

  const handleMount = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);
      editorInstance.user.updateUserPreferences({ colorScheme: theme === 'dark' ? 'dark' : 'light' });

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
    [theme, triggerDebouncedVisualSave]
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
          if (taskCount > 0 || groupCount > 0) {
            triggerDebouncedVisualSave(editor);
            showToast(`"${file.name}" cargado (${taskCount} tareas en ${groupCount} secciones)`);
          } else {
            showToast(`"${file.name}" cargado, pero no contiene tareas válidas (- [ ] ...)`);
          }
        } else {
          showToast(`"${file.name}" cargado en memoria`);
        }
      } catch (err) {
        showToast(`Error al leer "${file.name}"`);
      }
    },
    [editor, triggerDebouncedVisualSave]
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
      showToast(`Archivo "${currentFileName || 'TASKS.md'}" guardado`);
    } catch (err) {
      showToast('Error al exportar archivo');
    }
  }, [markdownInput, currentFileName]);

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
      setIsImportModalOpen(false);
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

  // Confirm Delete Task Handler
  const handleConfirmDeleteTask = () => {
    if (!deleteWarningState || !editor) return;
    const { shapeId, taskId } = deleteWarningState;

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
    showToast(`Tarea #${taskId} eliminada`);
  };

  // Execute Auto-Layout (DAG hierarchical organizing via Dagre)
  const handleExecuteAutoLayout = () => {
    if (!editor) return;
    setIsAutoLayoutConfirmOpen(false);
    const { taskCount, groupCount } = applyAutoLayout(editor, markdownInput);
    if (taskCount > 0 || groupCount > 0) {
      triggerDebouncedVisualSave(editor);
      showToast(`Canvas organizado (${taskCount} tareas en ${groupCount} secciones)`);
    } else {
      showToast('No hay tareas para organizar');
    }
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
      }
      showToast(`${taskIds.length} tareas eliminadas`);
    },
    [editor]
  );

  // Selected Task Details Helper
  const selectedTaskData = useMemo(() => {
    if (!selectedTaskShapeId) return null;

    if (editor) {
      const shape = (editor.getShape(selectedTaskShapeId as any) ||
        editor.getCurrentPageShapes().find((s) => {
          if ((s as any).type !== 'task') return false;
          const p = (s as any).props || {};
          return p.taskId === selectedTaskShapeId || p.temporaryId === selectedTaskShapeId || s.id === selectedTaskShapeId;
        })) as any;

      if (shape && shape.type === 'task') {
        const tProps = shape.props || {};
        return {
          shapeId: shape.id,
          taskId: tProps.taskId || tProps.temporaryId || 'sin-id',
          title: tProps.title || '',
          completed: Boolean(tProps.completed),
          priority: (tProps.priority || 'P1') as TaskPriority,
          status: (tProps.status || (tProps.completed ? 'done' : 'todo')) as TaskStatus,
          tags: tProps.tags || [],
          subtasks: tProps.subtasks,
          blockedBy: tProps.blockedBy || '',
        };
      }
    }

    const { taskBlocks } = scanTaskBlocks(markdownInput);
    const block = taskBlocks.find(
      (b) => b.detectedId === selectedTaskShapeId || b.temporaryId === selectedTaskShapeId
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
              className="w-full bg-[var(--surface)] text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] border border-[var(--outline)] rounded-full pl-9 pr-8 py-1.5 text-xs font-sans focus:outline-none focus:border-[var(--primary)] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Section: Global Actions (Primary CTA, Auto Layout, Save, View .md, Theme) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Quick Save Button */}
          <button
            type="button"
            onClick={handleExportFile}
            className={`btn-m3-secondary px-3 py-1.5 text-xs cursor-pointer ${
              hasUnsavedChanges
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/40 shadow-xs'
                : ''
            }`}
            title="Guardar archivo TASKS.md en disco"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span className="hidden sm:inline">Guardar</span>
          </button>

          {/* Auto Organizar Button */}
          <button
            type="button"
            onClick={() => setIsAutoLayoutConfirmOpen(true)}
            className="btn-m3-secondary hidden sm:inline-flex px-3 py-1.5 text-xs cursor-pointer text-sky-400 border-sky-800/60 bg-sky-950/30"
            title="Organizar automáticamente dependencias y grupos jerárquicamente"
          >
            <span className="material-symbols-outlined text-[16px]">account_tree</span>
            <span className="hidden md:inline">Auto organizar</span>
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
            title="Crear nueva tarea"
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
              title="Ver problemas detectados en el Markdown"
            >
              <span>⚠</span>
              <span>{validationReport.issues.length}</span>
            </button>
          )}

          {/* Theme Toggle (DESIGN.md Section 4: Light & Dark Theme) */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn-m3-icon shrink-0 cursor-pointer hidden sm:inline-flex"
            title={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            aria-label="Toggle Theme"
          >
            <span className="material-symbols-outlined text-[18px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
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
                  onClick={() => setIsImportModalOpen(true)}
                  className="btn-m3-secondary px-2.5 py-1.5 text-xs cursor-pointer"
                  title="Pegar Markdown"
                >
                  <span className="material-symbols-outlined text-[16px]">content_paste</span>
                </button>
              </div>

              {/* Quick Filters */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider px-2">
                  Filtros & Estados
                </span>

                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    activeFilter === 'all'
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
                  onClick={() => setActiveFilter('todo')}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    activeFilter === 'todo'
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
                  onClick={() => setActiveFilter('done')}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    activeFilter === 'done'
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
                  onClick={() => setActiveFilter('critical')}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    activeFilter === 'critical'
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
                  onClick={() => setActiveFilter('blocked')}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                    activeFilter === 'blocked'
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
                <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider px-2">
                  Secciones ({parsedGroups.length})
                </span>

                <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto pr-1">
                  {parsedGroups.map((grp) => {
                    const doneInGrp = grp.tasks.filter((t) => t.completed).length;
                    return (
                      <button
                        key={grp.title}
                        type="button"
                        onClick={() => handleFocusSectionOnCanvas(grp.title)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] text-left transition-colors cursor-pointer group"
                      >
                        <span className="truncate max-w-[140px]">{grp.title}</span>
                        <span className="text-[10px] font-mono text-[var(--on-surface-variant)] group-hover:text-[var(--on-surface)]">
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
        <main className="flex-1 h-full relative overflow-hidden bg-[var(--surface)]">
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

          {/* Toast notification */}
          {toastMessage && (
            <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 px-4 py-2.5 bg-[var(--surface-container-high)] border border-[var(--outline)] text-xs font-sans text-[var(--on-surface)] rounded-2xl shadow-2xl flex items-center gap-2.5 animate-slide-up max-w-[90vw]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{toastMessage}</span>
            </div>
          )}
        </main>

        {/* Details Panel (DESIGN.md Section 16: Lateral panel for selected task inspection & editing) */}
        {selectedTaskData && (
          <aside className="w-80 bg-[var(--surface-container)] border-l border-[var(--outline)] flex flex-col justify-between p-4 z-20 flex-shrink-0 animate-slide-up sm:animate-none overflow-y-auto">
            <div className="flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--outline)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--outline)] text-[var(--primary)]">
                    #{selectedTaskData.taskId}
                  </span>
                  <span className="text-xs font-mono text-[var(--on-surface-variant)] uppercase">
                    {selectedTaskData.completed ? 'Done' : selectedTaskData.status || 'Todo'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTaskShapeId(null)}
                  className="btn-m3-icon w-7 h-7 cursor-pointer"
                  title="Cerrar panel de detalles"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Title Edit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                  Título de la tarea
                </label>
                <textarea
                  value={selectedTaskData.title}
                  onChange={(e) => {
                    const newTitle = e.target.value;
                    handleUpdateTaskFromKanban(selectedTaskData.taskId, { title: newTitle });
                  }}
                  rows={2}
                  className="w-full bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] rounded-xl p-2.5 text-xs font-sans focus:outline-none focus:border-[var(--primary)] resize-none"
                />
              </div>

              {/* Status Normalizado: Backlog, Todo, In Progress, Review, Done (DESIGN.md Section 10) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                  Estado
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    { id: 'backlog', label: 'Backlog', icon: 'inventory_2' },
                    { id: 'todo', label: 'Todo', icon: 'pending_actions' },
                    { id: 'in_progress', label: 'In Progress', icon: 'play_circle' },
                    { id: 'review', label: 'Review', icon: 'rate_review' },
                    { id: 'done', label: 'Done', icon: 'check_circle' },
                  ].map((st) => {
                    const isCurrent =
                      st.id === 'done'
                        ? selectedTaskData.completed
                        : !selectedTaskData.completed && (selectedTaskData.status === st.id || (!selectedTaskData.status && st.id === 'todo'));

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          const isDone = st.id === 'done';
                          handleUpdateTaskFromKanban(selectedTaskData.taskId, {
                            status: st.id as TaskStatus,
                            completed: isDone,
                          });
                        }}
                        className={`py-1.5 px-2 rounded-xl border text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          isCurrent
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] font-semibold shadow-xs'
                            : 'bg-[var(--surface)] text-[var(--on-surface-variant)] border-[var(--outline)] hover:text-[var(--on-surface)]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">{st.icon}</span>
                        <span className="truncate">{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priority Chips (DESIGN.md Section 11) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                  Prioridad
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['P0', 'P1', 'P2', 'P3'] as TaskPriority[]).map((p) => {
                    const isSelected = selectedTaskData.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          handleUpdateTaskFromKanban(selectedTaskData.taskId, { priority: p });
                        }}
                        className={`py-1.5 rounded-lg border text-xs font-mono font-semibold text-center cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] shadow-xs'
                            : 'bg-[var(--surface)] text-[var(--on-surface-variant)] border-[var(--outline)] hover:border-[var(--on-surface-variant)]'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tags and Subtasks info */}
              {(selectedTaskData.tags?.length || selectedTaskData.subtasks) && (
                <div className="flex flex-col gap-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline)]">
                  {selectedTaskData.tags && selectedTaskData.tags.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase">
                        Etiquetas
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {selectedTaskData.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md bg-[var(--surface-container)] border border-[var(--outline)] text-[11px] text-[var(--on-surface)] font-mono"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTaskData.subtasks && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase flex items-center justify-between">
                        <span>Progreso subtareas</span>
                        <span className="font-mono text-sky-400">
                          {selectedTaskData.subtasks.completed}/{selectedTaskData.subtasks.total} (
                          {Math.round(
                            (selectedTaskData.subtasks.completed / selectedTaskData.subtasks.total) * 100
                          )}
                          %)
                        </span>
                      </span>
                      <div className="w-full h-1.5 bg-[var(--surface-container)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-400 rounded-full transition-all"
                          style={{
                            width: `${(selectedTaskData.subtasks.completed / selectedTaskData.subtasks.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dependencies info */}
              {selectedTaskData.blockedBy && (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-1 text-xs">
                  <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">lock</span>
                    Dependencias
                  </span>
                  <span className="text-[var(--on-surface-variant)] font-mono text-[11px]">
                    Bloqueada por: #{selectedTaskData.blockedBy}
                  </span>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-[var(--outline)] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeView !== 'canvas') {
                    setActiveView('canvas');
                  }
                  setTimeout(() => {
                    handleFocusTaskOnCanvas(selectedTaskData.taskId, selectedTaskData.title);
                  }, 100);
                }}
                className="btn-m3-secondary flex-1 py-2 text-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
                <span>Enfocar en Canvas</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const dependents = findDependentTasks(markdownInput, selectedTaskData.taskId);
                  setDeleteWarningState({
                    shapeId: selectedTaskData.shapeId,
                    taskId: selectedTaskData.taskId,
                    title: selectedTaskData.title,
                    dependents,
                  });
                }}
                className="btn-m3-icon w-9 h-9 text-[var(--error)] hover:bg-rose-950/40 cursor-pointer"
                title="Eliminar tarea"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </aside>
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
                  setIsImportModalOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex items-center justify-between text-[var(--on-surface)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-[var(--primary)]">content_paste</span>
                  <span>Pegar Markdown</span>
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

      {/* Modal: Importar / Pegar TASKS.md */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsImportModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-[var(--outline)] flex items-center justify-between">
              <div>
                <h2 id="modal-title" className="text-sm font-semibold text-[var(--on-surface)] font-sans">
                  Pegar TASKS.md
                </h2>
                <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                  <code className="text-[var(--primary)] font-bold">##</code> crea secciones y <code className="text-[var(--on-surface)]">- [ ]</code> crea tareas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="btn-m3-icon w-8 h-8"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 sm:p-5 flex flex-col gap-3">
              <textarea
                value={markdownInput}
                onChange={(e) => setMarkdownInput(e.target.value)}
                rows={9}
                className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-2xl p-3 text-xs font-mono text-[var(--on-surface)] focus:outline-none resize-none leading-relaxed"
                placeholder="Pega aquí tu contenido Markdown..."
              />
            </div>

            <div className="px-5 py-3.5 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="btn-m3-text px-4 py-1.5 text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyMarkdown}
                className="btn-m3-primary px-5 py-1.5 text-xs cursor-pointer"
              >
                Aplicar al Canvas
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
