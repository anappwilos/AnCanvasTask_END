import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor, Tldraw } from 'tldraw';
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
  TaskShapeUtil,
} from './shapes/TaskShapeUtil';
import { updateTaskInMarkdown } from './utils/markdownSync';

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

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isViewMarkdownOpen, setIsViewMarkdownOpen] = useState<boolean>(false);
  const [isSanityModalOpen, setIsSanityModalOpen] = useState<boolean>(false);
  const [markdownInput, setMarkdownInput] = useState<string>(SAMPLE_MARKDOWN);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // Sanity settings form state
  const [sanityProjectId, setSanityProjectId] = useState<string>('');
  const [sanityDataset, setSanityDataset] = useState<string>('production');
  const [sanityToken, setSanityToken] = useState<string>('');

  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);
  const customShapeUtils = useMemo(() => [TaskGroupShapeUtil, TaskShapeUtil], []);

  // Load initial Sanity configuration
  useEffect(() => {
    const config = getSanityConfig();
    setSanityProjectId(config.projectId || '');
    setSanityDataset(config.dataset || 'production');
    setSanityToken(config.token || '');
  }, []);

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

      // Set up store listener to sync task content edits and auto-persist visual positions
      const unsubscribe = editorInstance.store.listen((entry) => {
        let hasVisualChange = false;
        const changes = entry.changes as any;

        if (changes.updated) {
          for (const id of Object.keys(changes.updated)) {
            const [from, to] = changes.updated[id] || [];
            if (to?.typeName === 'shape' || from?.typeName === 'shape') {
              hasVisualChange = true;

              // Detect task attribute changes (title, completed, priority)
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

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
    // Retrieve latest saved visual layout from Sanity to preserve custom positions
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
        {/* Zone 1: Single text element brand wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100 font-mono">
            AnTaskCanvas — by AnAppWiLos
          </h1>
        </div>

        {/* Zone 2: Navigation & Status indicator */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono text-zinc-400">
          <span className="text-zinc-500">TASKS.md</span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          <span>Live Canvas Edit</span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          {/* Visual Sync Badge */}
          <button
            type="button"
            onClick={() => setIsSanityModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/60 hover:border-zinc-500 text-zinc-300 transition-colors cursor-pointer"
            title="Click to configure Sanity Visual Persistence"
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

        {/* Zone 3: Primary developer actions */}
        <div className="flex items-center gap-2">
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
            Paste Markdown
          </button>

          <button
            type="button"
            onClick={handleZoomToFit}
            className="px-3 py-1.5 text-xs font-mono font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700/60 rounded-md transition-colors cursor-pointer"
          >
            Zoom to Fit
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

      {/* View Live Synchronized Markdown Modal */}
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
                  Los cambios realizados en las tarjetas (título, checkboxes, prioridades) actualizan este documento automáticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsViewMarkdownOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Markdown Code Viewer */}
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

            {/* Modal Footer */}
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

      {/* Markdown Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 id="modal-title" className="text-sm font-semibold text-zinc-100 font-mono">
                  Import TASKS.md
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  <code className="text-emerald-400 font-bold">##</code> creates visual groups, and <code className="text-zinc-300">- [ ]</code> / <code className="text-zinc-300">- [x]</code> creates movable task cards
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
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
                placeholder={`# TASKS\n\n## Autenticación\n- [ ] Configurar OAuth\n  - ID: oauth\n  - Priority: P0\n\n- [ ] Persistir sesión\n  - ID: session\n  - Priority: P0\n  - Blocked by: oauth`}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-lg p-3 text-xs font-mono text-zinc-200 focus:outline-none resize-none leading-relaxed"
                autoFocus
              />

              {/* Status info */}
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pt-1">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        parsedStats.groupCount > 0 ? 'bg-emerald-400' : 'bg-zinc-600'
                      }`}
                    />
                    <span>
                      {parsedStats.groupCount} {parsedStats.groupCount === 1 ? 'group' : 'groups'}
                    </span>
                  </div>
                  <span className="text-zinc-700">·</span>
                  <div className="flex items-center gap-1.5">
                    <span>
                      {parsedStats.taskCount} {parsedStats.taskCount === 1 ? 'task' : 'tasks'}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-500">Press ⌘+Enter to import</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-mono text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
              >
                Cancel
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
                Load to Canvas ({parsedStats.groupCount} {parsedStats.groupCount === 1 ? 'group' : 'groups'})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sanity Visual Persistence Configuration Modal */}
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
                  Stores only spatial coordinates <code className="text-zinc-300">(taskId, x, y, w, h)</code>
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
                TASKS.md defines your titles, states, IDs, priorities and dependencies. Sanity only remembers where you placed the cards.
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-zinc-300">Sanity Project ID</label>
                <input
                  type="text"
                  value={sanityProjectId}
                  onChange={(e) => setSanityProjectId(e.target.value)}
                  placeholder="e.g. 8k9abcde (optional)"
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
                  Leave empty to use local persistence fallback
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSanityModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-mono font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
