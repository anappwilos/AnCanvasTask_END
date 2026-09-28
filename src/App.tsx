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
import {
  addTaskToMarkdown,
  deleteTaskFromMarkdown,
  findDependentTasks,
  moveTaskToGroupInMarkdown,
  scanTaskBlocks,
  slugify,
  updateTaskInMarkdown,
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
  const [deleteWarningState, setDeleteWarningState] = useState<DeleteWarningInfo | null>(null);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('P1');
  const [newTaskGroup, setNewTaskGroup] = useState<string>('Autenticación');
  const [customGroupInput, setCustomGroupInput] = useState<string>('');
  const [isCustomGroup, setIsCustomGroup] = useState<boolean>(false);

  // Markdown and sync
  const [markdownInput, setMarkdownInput] = useState<string>(SAMPLE_MARKDOWN);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // Sanity settings form state
  const [sanityProjectId, setSanityProjectId] = useState<string>('');
  const [sanityDataset, setSanityDataset] = useState<string>('production');
  const [sanityToken, setSanityToken] = useState<string>('');

  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);
  const markdownRef = useRef<string>(markdownInput);
  markdownRef.current = markdownInput;

  const customShapeUtils = useMemo(() => [TaskGroupShapeUtil, TaskShapeUtil], []);

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
      showToast(
        `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} loaded with Sanity visual positions`
      );
      triggerDebouncedVisualSave(editor);
    } else {
      showToast('No tasks or headings found in Markdown');
    }
  }, [editor, markdownInput, triggerDebouncedVisualSave]);

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
    <div className="flex flex-col w-screen h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Top Bar: AnTaskCanvas — by AnAppWiLos */}
      <header className="h-14 bg-zinc-900 border-b border-zinc-800 px-5 flex items-center justify-between z-10 select-none flex-shrink-0">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100 font-mono">
            AnTaskCanvas — by AnAppWiLos
          </h1>
        </div>

        {/* Zone 2: Status indicator & Persistence Badge */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-zinc-400">
          <span className="text-zinc-500">TASKS.md</span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          <span>Live Task Sync</span>
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
              Sanity:{' '}
              {syncStatus === 'saving'
                ? 'Saving...'
                : syncStatus === 'loading'
                ? 'Loading...'
                : syncStatus === 'synced'
                ? 'Remote Synced'
                : 'Visual Cache'}
            </span>
          </button>
        </div>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2">
          {/* Create New Task Button */}
          <button
            type="button"
            onClick={() => {
              if (existingSections.length > 0 && !isCustomGroup) {
                setNewTaskGroup(existingSections[0]);
              }
              setIsNewTaskModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-mono font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Crear una nueva tarea en el canvas y en TASKS.md"
          >
            <svg className="w-3.5 h-3.5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva tarea
          </button>

          {/* View Markdown Button */}
          <button
            type="button"
            onClick={() => setIsViewMarkdownOpen(true)}
            className="px-3 py-1.5 text-xs font-mono font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/60 rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
            title="Ver TASKS.md actualizado en tiempo real"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Ver Markdown
          </button>

          {/* Import / Paste Markdown Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 text-xs font-mono font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/60 rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Importar
          </button>

          <button
            type="button"
            onClick={handleZoomToFit}
            className="px-3 py-1.5 text-xs font-mono font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/60 rounded-md transition-colors cursor-pointer"
          >
            Zoom
          </button>

          <button
            type="button"
            onClick={handleResetLayout}
            className="px-3 py-1.5 text-xs font-mono font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/60 rounded-md transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Infinite Canvas Container */}
      <main className="flex-1 w-full h-[calc(100vh-3.5rem)] relative">
        <Tldraw
          shapeUtils={customShapeUtils}
          onMount={handleMount}
        />

        {/* Toast notification */}
        {toastMessage && (
          <div className="absolute bottom-6 right-6 z-50 px-4 py-2 bg-zinc-900 border border-zinc-700 text-xs font-mono text-zinc-200 rounded-lg shadow-2xl flex items-center gap-2 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {toastMessage}
          </div>
        )}
      </main>

      {/* Modal: Nueva Tarea */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-modal-title"
          >
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
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-5 flex flex-col gap-4">
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
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-md px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none"
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
                        className={`py-1.5 px-2 text-xs font-mono font-bold rounded-md border text-center transition-all cursor-pointer ${colors}`}
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
                    className="text-[11px] font-mono text-emerald-400 hover:underline cursor-pointer"
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
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-md px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none"
                  />
                ) : (
                  <select
                    value={newTaskGroup}
                    onChange={(e) => setNewTaskGroup(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-md px-3 py-2 text-xs font-mono text-zinc-100 focus:outline-none cursor-pointer"
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
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className={`px-4 py-1.5 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer ${
                    newTaskTitle.trim()
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-warning-title"
          >
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
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer"
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
                className="px-3.5 py-1.5 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTask}
                className="px-4 py-1.5 text-xs font-mono font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors cursor-pointer shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-markdown-title"
          >
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="view-markdown-title" className="text-sm font-semibold text-zinc-100 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  TASKS.md — Sincronizado en tiempo real
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Refleja en vivo tareas creadas, eliminadas, editadas o movidas entre secciones.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsViewMarkdownOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Contenido Markdown actual:</span>
                <span className="text-[11px] text-zinc-500">
                  {parsedStats.taskCount} tareas · {parsedStats.groupCount} secciones
                </span>
              </div>

              <div className="relative w-full rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                <pre className="p-4 text-xs font-mono text-zinc-200 overflow-auto max-h-[46vh] leading-relaxed select-text whitespace-pre-wrap">
                  {markdownInput}
                </pre>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-500">
                Formato Markdown nativo preservado
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-3.5 py-1.5 text-xs font-mono text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
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
                  className="px-3.5 py-1.5 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="modal-title" className="text-sm font-semibold text-zinc-100 font-mono">
                  Import TASKS.md
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  <code className="text-emerald-400 font-bold">##</code> crea secciones y <code className="text-zinc-300">- [ ]</code> / <code className="text-zinc-300">- [x]</code> crea tarjetas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span>Markdown content:</span>
                <button
                  type="button"
                  onClick={() => setMarkdownInput(SAMPLE_MARKDOWN)}
                  className="text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer"
                >
                  Load Example
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
                rows={11}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none resize-none leading-relaxed"
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
                <span className="text-[11px] text-zinc-500">Presiona ⌘+Enter para cargar</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyMarkdown}
                disabled={parsedStats.groupCount === 0 && parsedStats.taskCount === 0}
                className={`px-4 py-1.5 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  parsedStats.taskCount > 0 || parsedStats.groupCount > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sanity-modal-title"
          >
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="sanity-modal-title" className="text-sm font-semibold text-zinc-100 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Sanity Visual Persistence
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Guarda únicamente coordenadas espaciales <code className="text-zinc-300">(taskId, x, y, w, h)</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSanityModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveSanityConfig} className="p-5 flex flex-col gap-3.5">
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 leading-relaxed">
                <span className="text-emerald-400 font-semibold">Single Source of Truth: </span>
                TASKS.md define títulos, estados, IDs, prioridades y dependencias. Sanity solo almacena la posición de las tarjetas.
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300">Sanity Project ID</label>
                <input
                  type="text"
                  value={sanityProjectId}
                  onChange={(e) => setSanityProjectId(e.target.value)}
                  placeholder="ej. 8k9abcde (opcional)"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-md px-3 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300">Dataset</label>
                <input
                  type="text"
                  value={sanityDataset}
                  onChange={(e) => setSanityDataset(e.target.value)}
                  placeholder="production"
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-md px-3 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300">Sanity API Write Token</label>
                <input
                  type="password"
                  value={sanityToken}
                  onChange={(e) => setSanityToken(e.target.value)}
                  placeholder="sk..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-md px-3 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 font-mono">
                  Dejar vacío para usar caché local de persistencia
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSanityModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-mono font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer"
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
