import { useCallback, useMemo, useState } from 'react';
import { Editor, Tldraw } from 'tldraw';
import {
  loadTasksFromMarkdown,
  parseTasksMarkdown,
  seedMockTasks,
  TaskGroupShapeUtil,
  TaskShapeUtil,
} from './shapes/TaskShapeUtil';

const SAMPLE_MARKDOWN = `# TASKS

## Autenticación

- [ ] Crear login
  - ID: login
  - Priority: P0

- [ ] Crear perfil
  - ID: profile
  - Priority: P2

## Infraestructura

- [x] Setup Render Web Service
  - ID: infra-deploy
  - Priority: P1

- [ ] Implementar canvas infinito
  - ID: canvas-coords
  - Priority: P0`;

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [markdownInput, setMarkdownInput] = useState<string>(SAMPLE_MARKDOWN);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const customShapeUtils = useMemo(() => [TaskGroupShapeUtil, TaskShapeUtil], []);

  const handleMount = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance);
    // Apply sleek dark mode preference
    editorInstance.user.updateUserPreferences({ colorScheme: 'dark' });
    // Seed the initial movable mock task cards organized by groups
    seedMockTasks(editorInstance);
  }, []);

  const handleZoomToFit = useCallback(() => {
    if (editor) {
      editor.zoomToFit({ animation: { duration: 250 } });
    }
  }, [editor]);

  const handleResetLayout = useCallback(() => {
    if (editor) {
      // Remove current tasks and groups and re-seed
      const currentShapes = editor
        .getCurrentPageShapes()
        .filter((s) => (s as any).type === 'task' || (s as any).type === 'task-group');
      if (currentShapes.length > 0) {
        editor.deleteShapes(currentShapes.map((s) => s.id));
      }
      seedMockTasks(editor);
      showToast('Canvas reset to default groups');
    }
  }, [editor]);

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

  const handleApplyMarkdown = useCallback(() => {
    if (!editor) return;
    const { taskCount, groupCount } = loadTasksFromMarkdown(editor, markdownInput);
    if (taskCount > 0 || groupCount > 0) {
      setIsImportModalOpen(false);
      showToast(`${taskCount} ${taskCount === 1 ? 'task' : 'tasks'} loaded across ${groupCount} ${groupCount === 1 ? 'group' : 'groups'}`);
    } else {
      showToast('No tasks or headings found in Markdown');
    }
  }, [editor, markdownInput]);

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
          <span>Groups (##)</span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          <span>ID & Priority (P0–P3)</span>
        </div>

        {/* Zone 3: Primary developer actions */}
        <div className="flex items-center gap-2">
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
                placeholder={`# TASKS\n\n## Autenticación\n- [ ] Crear login\n- [ ] Añadir Google OAuth\n\n## Perfil\n- [ ] Crear pantalla de perfil\n- [x] Añadir avatar`}
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
    </div>
  );
}
