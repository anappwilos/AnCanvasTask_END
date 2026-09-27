import { useCallback, useMemo, useState } from 'react';
import { Editor, Tldraw } from 'tldraw';
import {
  seedMockTasks,
  TaskShapeUtil,
} from './shapes/TaskShapeUtil';

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);

  const customShapeUtils = useMemo(() => [TaskShapeUtil], []);

  const handleMount = useCallback((editorInstance: Editor) => {
    setEditor(editorInstance);
    // Apply sleek dark mode preference
    editorInstance.user.updateUserPreferences({ colorScheme: 'dark' });
    // Seed the 5 initial movable mock task cards
    seedMockTasks(editorInstance);
  }, []);

  const handleZoomToFit = useCallback(() => {
    if (editor) {
      editor.zoomToFit({ animation: { duration: 250 } });
    }
  }, [editor]);

  const handleResetLayout = useCallback(() => {
    if (editor) {
      // Remove current tasks and re-seed
      const currentTasks = editor.getCurrentPageShapes().filter((s) => (s as any).type === 'task');
      if (currentTasks.length > 0) {
        editor.deleteShapes(currentTasks.map((s) => s.id));
      }
      seedMockTasks(editor);
    }
  }, [editor]);

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
          <span className="text-zinc-500">FASE 01</span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          <span>Infinite Canvas</span>
          <span aria-hidden="true" className="text-zinc-700">·</span>
          <span>5 Mock Tasks (P0–P3)</span>
        </div>

        {/* Zone 3: Primary developer actions */}
        <div className="flex items-center gap-2">
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
            Reset Cards
          </button>
        </div>
      </header>

      {/* Infinite Canvas Container */}
      <main className="flex-1 w-full h-[calc(100vh-3.5rem)] relative">
        <Tldraw
          shapeUtils={customShapeUtils}
          onMount={handleMount}
        />
      </main>
    </div>
  );
}
