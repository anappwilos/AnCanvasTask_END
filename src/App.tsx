import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createShapeId, Editor, Tldraw } from 'tldraw';
import {
  extractVisualStateFromEditor,
  getSanityConfig,
  loadCanvasVisualState,
  saveCanvasVisualState,
  saveSanityConfig,
} from './services/sanityService';
import {
  loadTasksFromMarkdown,
  parseTasksMarkdown,
  seedMockTasks,
  TaskGroupShapeUtil,
  TaskPriority,
  TaskShapeUtil,
} from './shapes/TaskShapeUtil';
import { applyAutoLayout } from './utils/autoLayout';
import {
  addTaskToMarkdown,
  deleteTaskFromMarkdown,
  findDependentTasks,
  moveTaskToGroupInMarkdown,
  scanTaskBlocks,
  slugify,
  updateTaskInMarkdown,
  validateMarkdownDocument,
} from './utils/markdownSync';

const SAMPLE_MARKDOWN = `# TASKS

## Autenticación

- [ ] Configurar OAuth
  - ID: oauth
  - Priority: P0

- [ ] Persistir sesión
  - ID: session
  - Priority: P0
  - Blocked by: oauth

## Perfil

- [ ] Crear pantalla de perfil
  - ID: profile
  - Priority: P2

- [x] Añadir avatar
  - ID: avatar
  - Priority: P3
  - Blocked by: profile`;

type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'local';

interface DeleteWarningInfo {
  shapeId: string;
  taskId: string;
  title: string;
  dependents: Array<{ taskId: string; title: string; groupTitle: string }>;
}

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);

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

  const handleMount = useCallback(
    (editorInstance: Editor) => {
      setEditor(editorInstance);
      editorInstance.user.updateUserPreferences({ colorScheme: 'dark' });

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
    [triggerDebouncedVisualSave]
  );

  const handleZoomToFit = useCallback(() => {
    if (editor) {
      editor.zoomToFit({ animation: { duration: 250 } });
    }
  }, [editor]);

  const handleResetLayout = useCallback(async () => {
    if (editor) {
      // Remove current tasks, groups, and arrows
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
      showToast('Canvas reset to default layout');
    }
  }, [editor, triggerDebouncedVisualSave]);

  const parsedStats = useMemo(() => {
    const groups = parseTasksMarkdown(markdownInput);
    const totalTasks = groups.reduce((acc, g) => acc + g.tasks.length, 0);
    return {
      groupCount: groups.length,
      taskCount: totalTasks,
    };
  }, [markdownInput]);

  const hasUnsavedChanges = useMemo(
    () => markdownInput !== lastSavedMarkdown,
    [markdownInput, lastSavedMarkdown]
  );

  // File Import Processor (via File Input or Drag & Drop)
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

  // Export / Save Markdown File to Local Disk
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
      showToast(`Archivo "${currentFileName || 'TASKS.md'}" guardado con éxito`);
    } catch (err) {
      showToast('Error al exportar archivo');
    }
  }, [markdownInput, currentFileName]);

  // Drag & Drop Handlers for .md files
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
      showToast(
        `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} loaded with Sanity visual positions`
      );
      triggerDebouncedVisualSave(editor);
    } else {
      showToast('No tasks or headings found in Markdown');
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
      editor.zoomToSelection({ animation: { duration: 300 } });
      showToast(`Enfocado: "${(taskShape.props as any)?.title || targetTaskId}"`);
    } else {
      showToast(`No se encontró la tarjeta #${targetTaskId} en el canvas`);
    }
  };

  // Create New Task Handler
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !editor) return;

    const groupTitle = isCustomGroup
      ? customGroupInput.trim() || 'General'
      : newTaskGroup.trim();

    // 1. Add task block to Markdown
    const { updatedMarkdown, taskId } = addTaskToMarkdown(markdownInput, {
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      groupTitle,
    });

    setMarkdownInput(updatedMarkdown);

    // 2. Find target group shape on canvas or place next to existing group
    const allShapes = editor.getCurrentPageShapes();
    const targetGroupShape = allShapes.find(
      (s) =>
        (s as any).type === 'task-group' &&
        (s as any).props?.title?.toLowerCase() === groupTitle.toLowerCase()
    ) as any;

    let targetX = 80;
    let targetY = 160;

    if (targetGroupShape) {
      // Find existing tasks in this group to place underneath
      const tasksInGroup = allShapes.filter(
        (s) =>
          (s as any).type === 'task' &&
          s.x >= targetGroupShape.x &&
          s.x <= targetGroupShape.x + (targetGroupShape.props?.w || 360)
      );

      targetX = targetGroupShape.x + 20;
      targetY = targetGroupShape.y + 70 + tasksInGroup.length * 126;

      // Expand group height if needed
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
      // Group doesn't exist on canvas yet -> create it
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

    // 3. Create Task Card shape on canvas
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

    // Save visual state
    triggerDebouncedVisualSave(editor);

    // Reset form
    setNewTaskTitle('');
    setNewTaskPriority('P1');
    setIsNewTaskModalOpen(false);
    showToast(`Tarea #${taskId} creada en "${groupTitle}"`);
  };

  // Confirm Delete Task Handler
  const handleConfirmDeleteTask = () => {
    if (!deleteWarningState || !editor) return;
    const { shapeId, taskId } = deleteWarningState;

    // 1. Remove task block from Markdown
    const updatedMarkdown = deleteTaskFromMarkdown(markdownInput, taskId);
    setMarkdownInput(updatedMarkdown);

    // 2. Remove shape and any connected arrow shapes from canvas
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

    // 3. Close modal & save visual state
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
      showToast(`Canvas auto organizado (${taskCount} tareas en ${groupCount} secciones)`);
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
    showToast('Sanity configuration saved');
    if (editor) {
      triggerDebouncedVisualSave(editor);
    }
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownInput);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col w-screen h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans relative"
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

      {/* Top Bar: AnTaskCanvas — Responsive Desktop & Mobile */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 px-3 sm:px-5 flex items-center justify-between z-20 select-none flex-shrink-0 gap-2 sm:gap-3">
        {/* Zone 1: Brand wordmark & Current File status */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100 font-mono">
              AnTask<span className="text-emerald-400">Canvas</span>
            </h1>
          </div>

          <span aria-hidden="true" className="text-zinc-700 hidden sm:inline">|</span>

          {/* Current File and Unsaved Changes Indicator */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-[11px] sm:text-xs font-mono truncate shadow-xs max-w-[130px] sm:max-w-none"
            title={`Archivo actual: ${currentFileName}${hasUnsavedChanges ? ' (con cambios sin guardar)' : ' (guardado)'}`}
          >
            <svg className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 hidden xs:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-semibold text-zinc-200 truncate">{currentFileName}</span>
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1 text-amber-400 text-[10px] sm:text-[11px] flex-shrink-0" title="Cambios pendientes de guardar">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="hidden md:inline">• sin guardar</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 text-[10px] sm:text-[11px] flex-shrink-0" title="Archivo sincronizado">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="hidden md:inline">• al día</span>
              </span>
            )}
          </div>
        </div>

        {/* Zone 2: Desktop Issues Badge & Persistence Badge */}
        <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-zinc-400">
          {/* Markdown Validation Issues Badge */}
          {validationReport.issues.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsProblemsModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-mono font-medium transition-all cursor-pointer ${
                validationReport.hasErrors
                  ? 'bg-rose-950/70 border-rose-700/80 text-rose-300 hover:bg-rose-900/80'
                  : 'bg-amber-950/70 border-amber-700/80 text-amber-300 hover:bg-amber-900/80'
              }`}
              title="Abrir panel de problemas detectados en TASKS.md"
            >
              <span className="text-xs">⚠</span>
              <span>
                {validationReport.issues.length}{' '}
                {validationReport.issues.length === 1 ? 'problema' : 'problemas'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsProblemsModalOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/60 hover:border-zinc-500 text-emerald-400 text-[11px] font-mono transition-colors cursor-pointer"
              title="TASKS.md verificado sin advertencias"
            >
              <span>✔</span>
              <span>Válido</span>
            </button>
          )}

          <span aria-hidden="true" className="text-zinc-700">·</span>

          {/* Visual Sync Badge */}
          <button
            type="button"
            onClick={() => setIsSanityModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 hover:border-zinc-500 text-zinc-300 transition-colors cursor-pointer"
            title="Configurar persistencia visual en Sanity"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                syncStatus === 'saving' || syncStatus === 'loading'
                  ? 'bg-amber-400 animate-pulse'
                  : syncStatus === 'synced'
                  ? 'bg-emerald-400'
                  : 'bg-cyan-400'
              }`}
            />
            <span className="text-[11px]">
              {syncStatus === 'saving'
                ? 'Saving...'
                : syncStatus === 'loading'
                ? 'Loading...'
                : syncStatus === 'synced'
                ? 'Sanity Sync'
                : 'Caché local'}
            </span>
          </button>
        </div>

        {/* Zone 3: Main Actions (Desktop full bar & Mobile compact header actions) */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Mobile Quick Save Button */}
          <button
            type="button"
            onClick={handleExportFile}
            className={`sm:hidden px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
              hasUnsavedChanges
                ? 'text-emerald-100 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 shadow-sm animate-pulse'
                : 'text-zinc-300 bg-zinc-800 border border-zinc-700'
            }`}
            title="Guardar TASKS.md"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <span>Guardar</span>
          </button>

          {/* Mobile Issues Trigger (if any) */}
          {validationReport.issues.length > 0 && (
            <button
              type="button"
              onClick={() => setIsProblemsModalOpen(true)}
              className={`sm:hidden px-2 py-1 text-[11px] font-mono font-bold rounded-md border flex items-center gap-1 ${
                validationReport.hasErrors
                  ? 'bg-rose-950 text-rose-300 border-rose-800'
                  : 'bg-amber-950 text-amber-300 border-amber-800'
              }`}
              title="Ver problemas detectados"
            >
              <span>⚠</span>
              <span>{validationReport.issues.length}</span>
            </button>
          )}

          {/* Desktop Only Buttons */}
          {/* Abrir TASKS.md Button */}
          <button
            type="button"
            onClick={handleOpenFilePicker}
            className="hidden sm:flex px-3 py-1.5 text-xs font-mono font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700 rounded-md transition-colors cursor-pointer items-center gap-1.5 shadow-xs"
            title="Abrir un archivo TASKS.md o Markdown desde tu equipo"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden md:inline">Abrir</span> TASKS.md
          </button>

          {/* Desktop Guardar TASKS.md Button */}
          <button
            type="button"
            onClick={handleExportFile}
            className={`hidden sm:flex px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer items-center gap-1.5 shadow-xs ${
              hasUnsavedChanges
                ? 'text-emerald-100 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)] animate-pulse'
                : 'text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700'
            }`}
            title={`Guardar y exportar ${currentFileName} a tu equipo`}
          >
            <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Guardar {currentFileName.endsWith('.md') ? currentFileName : `${currentFileName}.md`}</span>
          </button>

          {/* Desktop Auto Organizar Button */}
          <button
            type="button"
            onClick={() => setIsAutoLayoutConfirmOpen(true)}
            className="hidden sm:flex px-2.5 sm:px-3 py-1.5 text-xs font-mono font-medium text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-700/70 rounded-md transition-colors cursor-pointer items-center gap-1.5 shadow-xs"
            title="Distribuir automáticamente las tareas y grupos según su jerarquía de dependencias"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            <span>Auto organizar</span>
          </button>

          {/* Desktop Create New Task Button */}
          <button
            type="button"
            onClick={() => {
              if (existingSections.length > 0 && !isCustomGroup) {
                setNewTaskGroup(existingSections[0]);
              }
              setIsNewTaskModalOpen(true);
            }}
            className="hidden sm:flex px-2.5 sm:px-3 py-1.5 text-xs font-mono font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer items-center gap-1.5 shadow-sm"
            title="Crear una nueva tarea en el canvas y en el documento Markdown"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Nueva tarea</span>
          </button>

          {/* Desktop View Markdown Button */}
          <button
            type="button"
            onClick={() => setIsViewMarkdownOpen(true)}
            className="hidden md:flex px-2.5 sm:px-3 py-1.5 text-xs font-mono font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/60 rounded-md transition-colors cursor-pointer items-center gap-1.5"
            title="Ver o copiar el documento Markdown completo en tiempo real"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Ver
          </button>

          {/* Desktop Import / Paste Markdown Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="hidden md:flex px-2.5 py-1.5 text-xs font-mono font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/60 rounded-md transition-colors cursor-pointer items-center gap-1"
            title="Pegar Markdown manualmente en cuadro de texto"
          >
            Pegar
          </button>

          {/* Desktop Zoom button */}
          <button
            type="button"
            onClick={handleZoomToFit}
            className="hidden sm:inline-block px-2.5 py-1.5 text-xs font-mono font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/60 rounded-md transition-colors cursor-pointer"
            title="Ajustar zoom para ver todo el canvas"
          >
            Zoom
          </button>

          {/* Desktop Reset layout button */}
          <button
            type="button"
            onClick={handleResetLayout}
            className="hidden lg:inline-block px-2.5 py-1.5 text-xs font-mono font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/60 rounded-md transition-colors cursor-pointer"
            title="Reiniciar canvas al ejemplo inicial"
          >
            Reset
          </button>

          {/* Mobile Menu Trigger Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="sm:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 cursor-pointer transition-colors active:scale-95"
            aria-label="Abrir menú de opciones"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Infinite Canvas Container */}
      <main className="flex-1 w-full h-[calc(100vh-3.5rem)] relative pb-16 sm:pb-0">
        <Tldraw
          shapeUtils={customShapeUtils}
          onMount={handleMount}
        />

        {/* Floating Bottom Quick-Action Bar for Mobile Touch Devices */}
        <nav
          aria-label="Acciones rápidas móviles"
          className="sm:hidden fixed bottom-3 left-3 right-3 z-30 bg-zinc-900/95 backdrop-blur-md border border-zinc-800/90 rounded-2xl shadow-2xl p-1.5 flex items-center justify-between gap-1 pb-safe"
        >
          {/* 1. + Nueva Tarea (Primary CTA) */}
          <button
            type="button"
            onClick={() => {
              if (existingSections.length > 0 && !isCustomGroup) {
                setNewTaskGroup(existingSections[0]);
              }
              setIsNewTaskModalOpen(true);
            }}
            className="flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-[10px] font-semibold active:scale-95 transition-transform shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="mt-0.5">+ Tarea</span>
          </button>

          {/* 2. Auto DAG Layout */}
          <button
            type="button"
            onClick={() => setIsAutoLayoutConfirmOpen(true)}
            className="flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-emerald-400 font-mono text-[10px] font-medium border border-zinc-700/50 active:scale-95 transition-transform cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
            <span className="mt-0.5">Organizar</span>
          </button>

          {/* 3. Zoom to Fit */}
          <button
            type="button"
            onClick={handleZoomToFit}
            className="flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] font-medium border border-zinc-700/50 active:scale-95 transition-transform cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            <span className="mt-0.5">Ajustar</span>
          </button>

          {/* 4. Ver Markdown */}
          <button
            type="button"
            onClick={() => setIsViewMarkdownOpen(true)}
            className="flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] font-medium border border-zinc-700/50 active:scale-95 transition-transform cursor-pointer"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="mt-0.5">Ver .md</span>
          </button>

          {/* 5. Mobile Drawer Menu */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex-1 py-2 px-1 min-h-[44px] flex flex-col items-center justify-center rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 font-mono text-[10px] font-medium border border-zinc-700/50 active:scale-95 transition-transform relative cursor-pointer"
          >
            {validationReport.issues.length > 0 && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            <span className="mt-0.5">Más</span>
          </button>
        </nav>

        {/* Drag & Drop Discrete Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 pointer-events-none bg-zinc-950/85 backdrop-blur-xs flex flex-col items-center justify-center animate-fade-in p-6">
            <div className="w-full max-w-lg p-8 bg-zinc-900/95 border-2 border-dashed border-emerald-500/80 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-zinc-100 font-mono">
                  Suelta aquí tu archivo TASKS.md
                </h3>
                <p className="text-xs text-zinc-400 font-sans max-w-sm">
                  Cargaremos tus secciones y tareas preservando IDs, prioridades, dependencias y metadatos no gestionados.
                </p>
              </div>
              <div className="px-3 py-1 rounded bg-zinc-800/80 border border-zinc-700 text-[11px] font-mono text-emerald-400">
                Formatos aceptados: .md, .markdown, .txt
              </div>
            </div>
          </div>
        )}

        {/* Toast notification (above mobile nav bar) */}
        {toastMessage && (
          <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 px-4 py-2.5 bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 rounded-xl shadow-2xl flex items-center gap-2 animate-slide-up max-w-[90vw]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}
      </main>

      {/* Mobile Drawer Action Menu (Full Sheet for Smartphones) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs sm:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="w-full bg-zinc-900 border-t border-zinc-700 rounded-t-3xl shadow-2xl p-4 flex flex-col gap-4 animate-slide-up max-h-[85vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Opciones y herramientas"
          >
            {/* Grab handle indicator */}
            <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto" />

            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-semibold font-mono text-zinc-100">
                  Menú de Opciones
                </h2>
                <p className="text-xs text-zinc-400 font-mono">
                  {currentFileName} · {parsedStats.taskCount} tareas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Menu Sections */}
            <div className="flex flex-col gap-2 font-mono text-xs">
              <span className="text-[11px] text-zinc-500 font-semibold px-2 uppercase tracking-wider">
                Archivo TASKS.md
              </span>

              {/* Abrir archivo */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleOpenFilePicker();
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-zinc-200 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Abrir TASKS.md desde equipo</span>
                </div>
                <span className="text-zinc-600">➔</span>
              </button>

              {/* Guardar archivo */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleExportFile();
                }}
                className={`w-full min-h-[44px] px-3 py-2.5 rounded-xl border flex items-center justify-between active:scale-[0.98] transition-transform ${
                  hasUnsavedChanges
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-semibold'
                    : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <span>Guardar y descargar {currentFileName}</span>
                </div>
                {hasUnsavedChanges && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                    Modificado
                  </span>
                )}
              </button>

              {/* Pegar / Importar Markdown */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsImportModalOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-zinc-200 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Pegar texto Markdown</span>
                </div>
                <span className="text-zinc-600">➔</span>
              </button>

              {/* Copiar Markdown */}
              <button
                type="button"
                onClick={() => {
                  handleCopyMarkdown();
                  showToast('Markdown copiado al portapapeles');
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-zinc-200 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Copiar Markdown completo</span>
                </div>
                {copiedMarkdown && <span className="text-emerald-400 text-[10px]">¡Copiado!</span>}
              </button>

              <span className="text-[11px] text-zinc-500 font-semibold px-2 uppercase tracking-wider mt-2">
                Herramientas & Estado
              </span>

              {/* Panel de Problemas */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsProblemsModalOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-zinc-200 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-amber-400">⚠</span>
                  <span>Panel de problemas de TASKS.md</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    validationReport.issues.length > 0
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {validationReport.issues.length} {validationReport.issues.length === 1 ? 'aviso' : 'avisos'}
                </span>
              </button>

              {/* Sanity Persistence */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsSanityModalOpen(true);
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-zinc-200 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      syncStatus === 'synced' ? 'bg-emerald-400' : 'bg-cyan-400'
                    }`}
                  />
                  <span>Persistencia visual (Sanity)</span>
                </div>
                <span className="text-[10px] text-zinc-400">{syncStatus}</span>
              </button>

              {/* Reiniciar Canvas */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleResetLayout();
                }}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-between text-zinc-400 active:scale-[0.98] transition-transform mt-1"
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reiniciar canvas a demo inicial</span>
                </div>
                <span className="text-zinc-600">↺</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Panel de Problemas del Documento */}
      {isProblemsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsProblemsModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-2xl bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-in sm:fade-in sm:zoom-in-95 duration-150 max-h-[90vh] sm:max-h-[85vh] pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="problems-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator on mobile */}
            <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-3 sm:py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="problems-modal-title" className="text-sm font-semibold text-zinc-100 font-mono flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      validationReport.hasErrors
                        ? 'bg-rose-500'
                        : validationReport.hasWarnings
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  Panel de problemas — TASKS.md
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Tolerancia a errores: la app sigue cargando el contenido sin bloquear ni modificar datos sin tu consentimiento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProblemsModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-2 sm:p-1 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary statistics bar */}
            <div className="px-5 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center gap-4 text-xs font-mono overflow-x-auto">
              <span className="text-zinc-400 shrink-0">
                Total:{' '}
                <strong className="text-zinc-200">{validationReport.issues.length}</strong>
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-rose-400 shrink-0">
                Errores: <strong>{validationReport.errorCount}</strong>
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-amber-400 shrink-0">
                Avisos: <strong>{validationReport.warningCount}</strong>
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-cyan-400 shrink-0">
                Información: <strong>{validationReport.infoCount}</strong>
              </span>
            </div>

            {/* Issues list */}
            <div className="p-4 sm:p-5 overflow-auto max-h-[50vh] flex flex-col gap-2.5">
              {validationReport.issues.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/80 border border-emerald-700 flex items-center justify-center text-emerald-400 text-lg">
                    ✔
                  </div>
                  <div className="text-xs font-mono text-zinc-200 font-semibold">
                    No se detectaron problemas
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500 max-w-sm">
                    El archivo TASKS.md tiene estructura coherente, IDs únicos, prioridades válidas y dependencias resueltas.
                  </div>
                </div>
              ) : (
                validationReport.issues.map((issue) => {
                  const badgeColor = {
                    error: 'text-rose-400 bg-rose-950/80 border-rose-800',
                    warning: 'text-amber-400 bg-amber-950/80 border-amber-800',
                    info: 'text-cyan-400 bg-cyan-950/80 border-cyan-800',
                  }[issue.severity];

                  const icon = {
                    error: '✕',
                    warning: '⚠',
                    info: 'ℹ',
                  }[issue.severity];

                  return (
                    <div
                      key={issue.id}
                      className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start justify-between gap-3 text-xs font-mono"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded border shrink-0 mt-0.5 ${badgeColor}`}
                        >
                          {icon} {issue.severity.toUpperCase()}
                        </span>
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <div className="text-zinc-200 font-medium leading-snug">
                            {issue.message}
                          </div>
                          {issue.details && (
                            <div className="text-[11px] text-zinc-500 leading-normal">
                              {issue.details}
                            </div>
                          )}
                          <div className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-2">
                            {issue.groupTitle && <span>Sección: ## {issue.groupTitle}</span>}
                            {issue.lineIndex !== undefined && (
                              <span>Línea aprox: {issue.lineIndex + 1}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {issue.taskId && (
                        <button
                          type="button"
                          onClick={() =>
                            handleFocusTaskOnCanvas(issue.taskId, issue.taskTitle)
                          }
                          className="min-h-[36px] px-2.5 py-1 text-[11px] font-mono text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 shrink-0 cursor-pointer transition-colors active:scale-95"
                          title="Localizar tarjeta en el canvas"
                        >
                          Localizar
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-500">
                Los datos no estándar se preservan intactos
              </span>
              <button
                type="button"
                onClick={() => setIsProblemsModalOpen(false)}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
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
            className="w-full sm:max-w-md bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-in sm:fade-in sm:zoom-in-95 duration-150 pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="autolayout-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator on mobile */}
            <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="autolayout-modal-title" className="text-sm font-semibold text-zinc-100 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  ¿Auto organizar el canvas?
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Distribución jerárquica basada en dependencias (DAG)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoLayoutConfirmOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-2 sm:p-1 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs text-zinc-300 leading-relaxed">
                Esta acción reorganizará automáticamente las tarjetas de tareas y los grupos visuales del canvas:
              </p>
              <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
                <li>Ordena tareas bloqueadoras hacia arriba (<code className="text-zinc-200">Blocked by</code>).</li>
                <li>Evita solapamientos y ajusta tamaños de sección.</li>
                <li>Guarda las nuevas posiciones en la persistencia visual.</li>
                <li><span className="text-emerald-400 font-semibold">No modifica</span> el texto ni datos de <code className="text-zinc-300">TASKS.md</code>.</li>
              </ul>
            </div>

            <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAutoLayoutConfirmOpen(false)}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteAutoLayout}
                className="min-h-[44px] sm:min-h-0 px-5 py-2 text-xs font-mono font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95"
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
            className="w-full sm:max-w-md bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-in sm:fade-in sm:zoom-in-95 duration-150 pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator on mobile */}
            <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="new-task-modal-title" className="text-sm font-semibold text-zinc-100 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Nueva tarea
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Crea una tarjeta en el canvas y sincroniza su bloque en <code className="text-zinc-300">TASKS.md</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTaskModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-2 sm:p-1 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-4 sm:p-5 flex flex-col gap-4">
              {/* Task Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300 flex items-center justify-between">
                  <span>Título de la tarea</span>
                  <span className="text-zinc-500 text-[11px]">* Requerido</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="ej. Crear recuperación de contraseña"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2.5 text-sm sm:text-xs font-mono text-zinc-100 focus:outline-none"
                />
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300">Prioridad</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['P0', 'P1', 'P2', 'P3'] as TaskPriority[]).map((p) => {
                    const isSelected = newTaskPriority === p;
                    const colors = {
                      P0: isSelected ? 'bg-red-950/80 border-red-500 text-red-300 ring-1 ring-red-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400',
                      P1: isSelected ? 'bg-amber-950/80 border-amber-500 text-amber-300 ring-1 ring-amber-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400',
                      P2: isSelected ? 'bg-blue-950/80 border-blue-500 text-blue-300 ring-1 ring-blue-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400',
                      P3: isSelected ? 'bg-zinc-800 border-zinc-500 text-zinc-200 ring-1 ring-zinc-500' : 'bg-zinc-950 border-zinc-800 text-zinc-400',
                    }[p];

                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setNewTaskPriority(p)}
                        className={`min-h-[40px] py-2 px-2 text-xs font-mono font-bold rounded-lg border text-center transition-all cursor-pointer ${colors}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group / Section */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-zinc-300">Grupo / Sección (##)</label>
                  <button
                    type="button"
                    onClick={() => setIsCustomGroup(!isCustomGroup)}
                    className="text-[11px] font-mono text-emerald-400 hover:underline cursor-pointer py-1"
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
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2.5 text-sm sm:text-xs font-mono text-zinc-100 focus:outline-none"
                  />
                ) : (
                  <select
                    value={newTaskGroup}
                    onChange={(e) => setNewTaskGroup(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2.5 text-sm sm:text-xs font-mono text-zinc-100 focus:outline-none cursor-pointer"
                  >
                    {existingSections.map((sec) => (
                      <option key={sec} value={sec}>
                        ## {sec}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Auto ID preview */}
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 flex items-center justify-between">
                <span>ID generado:</span>
                <span className="text-emerald-400 font-bold">
                  #{newTaskTitle.trim() ? slugify(newTaskTitle) : 'id-tarea'}
                </span>
              </div>

              {/* Footer buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className={`min-h-[44px] sm:min-h-0 px-5 py-2 text-xs font-mono font-medium rounded-lg transition-colors cursor-pointer ${
                    newTaskTitle.trim()
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-95'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  Crear tarea
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
            className="w-full sm:max-w-md bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-in sm:fade-in sm:zoom-in-95 duration-150 pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-warning-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator on mobile */}
            <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="delete-warning-title" className="text-sm font-semibold text-rose-400 font-mono flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {deleteWarningState.dependents.length > 0
                    ? 'Atención: Dependencias activas'
                    : 'Confirmar eliminación'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Eliminar tarjeta <code className="text-zinc-200">#{deleteWarningState.taskId}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteWarningState(null)}
                className="text-zinc-400 hover:text-zinc-200 p-2 sm:p-1 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                ¿Estás seguro de que deseas eliminar la tarea <strong className="text-zinc-100 font-mono">"{deleteWarningState.title}"</strong>?
              </p>

              {deleteWarningState.dependents.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 flex flex-col gap-2">
                  <div className="text-[11px] font-mono font-semibold text-rose-300">
                    Esta tarea está marcada como bloqueadora en:
                  </div>
                  <div className="flex flex-col gap-1 max-h-32 overflow-auto">
                    {deleteWarningState.dependents.map((dep) => (
                      <div key={dep.taskId} className="text-[11px] font-mono text-zinc-300 flex items-center gap-1.5 bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800">
                        <span className="text-amber-400 font-bold">#{dep.taskId}</span>
                        <span className="truncate">{dep.title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-1">
                    * La referencia no se eliminará silenciosamente de sus metadatos.
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteWarningState(null)}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTask}
                className="min-h-[44px] sm:min-h-0 px-5 py-2 text-xs font-mono font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                {deleteWarningState.dependents.length > 0
                  ? 'Eliminar tarea de todas formas'
                  : 'Eliminar tarea'}
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
            className="w-full sm:max-w-2xl bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-in sm:fade-in sm:zoom-in-95 duration-150 max-h-[90vh] sm:max-h-[85vh] pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-markdown-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator on mobile */}
            <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="view-markdown-title" className="text-sm font-semibold text-zinc-100 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  TASKS.md — Sincronizado en vivo
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Refleja en tiempo real tareas creadas, eliminadas, editadas o movidas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsViewMarkdownOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-2 sm:p-1 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-5 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Contenido Markdown:</span>
                <span className="text-[11px] text-zinc-500">
                  {parsedStats.taskCount} tareas · {parsedStats.groupCount} secciones
                </span>
              </div>

              <div className="relative w-full rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden">
                <pre className="p-3.5 sm:p-4 text-xs font-mono text-zinc-200 overflow-auto max-h-[46vh] leading-relaxed select-text whitespace-pre-wrap">
                  {markdownInput}
                </pre>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
                Formato Markdown nativo preservado
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial px-4 py-2 text-xs font-mono text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                >
                  {copiedMarkdown ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copiar Markdown
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewMarkdownOpen(false)}
                  className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Importar TASKS.md */}
      {isImportModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs"
          onClick={() => setIsImportModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-xl bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-in sm:fade-in sm:zoom-in-95 duration-150 pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator on mobile */}
            <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="modal-title" className="text-sm font-semibold text-zinc-100 font-mono">
                  Pegar TASKS.md
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  <code className="text-emerald-400 font-bold">##</code> crea secciones y <code className="text-zinc-300">- [ ]</code> crea tarjetas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-2 sm:p-1 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Contenido Markdown:</span>
                <button
                  type="button"
                  onClick={() => setMarkdownInput(SAMPLE_MARKDOWN)}
                  className="text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer py-1"
                >
                  Cargar Ejemplo
                </button>
              </div>

              <textarea
                value={markdownInput}
                onChange={(e) => setMarkdownInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyMarkdown();
                  }
                  if (e.key === 'Escape') {
                    setIsImportModalOpen(false);
                  }
                }}
                rows={9}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl p-3 text-sm sm:text-xs font-mono text-zinc-200 focus:outline-none resize-none leading-relaxed"
                autoFocus
              />

              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        parsedStats.groupCount > 0 ? 'bg-emerald-400' : 'bg-zinc-600'
                      }`}
                    />
                    <span>
                      {parsedStats.groupCount} {parsedStats.groupCount === 1 ? 'sección' : 'secciones'}
                    </span>
                  </div>
                  <span className="text-zinc-700">·</span>
                  <div className="flex items-center gap-1.5">
                    <span>
                      {parsedStats.taskCount} {parsedStats.taskCount === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-500 hidden sm:inline">Presiona ⌘+Enter para cargar</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyMarkdown}
                disabled={parsedStats.groupCount === 0 && parsedStats.taskCount === 0}
                className={`min-h-[44px] sm:min-h-0 px-5 py-2 text-xs font-mono font-medium rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  parsedStats.taskCount > 0 || parsedStats.groupCount > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-95'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                Cargar al canvas
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
            className="w-full sm:max-w-md bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-3xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-in sm:fade-in sm:zoom-in-95 duration-150 pb-safe sm:pb-0"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sanity-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle indicator on mobile */}
            <div className="w-10 h-1.5 bg-zinc-700 rounded-full mx-auto my-2.5 sm:hidden" />

            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="sanity-modal-title" className="text-sm font-semibold text-zinc-100 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Sanity Visual Persistence
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Guarda coordenadas espaciales <code className="text-zinc-300">(taskId, x, y, w, h)</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSanityModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-2 sm:p-1 rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveSanityConfig} className="p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 leading-relaxed">
                <span className="text-emerald-400 font-semibold">Single Source of Truth: </span>
                TASKS.md define títulos, estados, IDs y prioridades. Sanity solo almacena la posición en el canvas.
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300">Sanity Project ID</label>
                <input
                  type="text"
                  value={sanityProjectId}
                  onChange={(e) => setSanityProjectId(e.target.value)}
                  placeholder="ej. 8k9abcde (opcional)"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm sm:text-xs font-mono text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300">Dataset</label>
                <input
                  type="text"
                  value={sanityDataset}
                  onChange={(e) => setSanityDataset(e.target.value)}
                  placeholder="production"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm sm:text-xs font-mono text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300">Sanity API Write Token</label>
                <input
                  type="password"
                  value={sanityToken}
                  onChange={(e) => setSanityToken(e.target.value)}
                  placeholder="sk..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg px-3 py-2 text-sm sm:text-xs font-mono text-zinc-100 focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 font-mono">
                  Dejar vacío para usar caché local
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSanityModalOpen(false)}
                  className="min-h-[44px] sm:min-h-0 px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] sm:min-h-0 px-5 py-2 text-xs font-mono font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer shadow-sm active:scale-95"
                >
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
