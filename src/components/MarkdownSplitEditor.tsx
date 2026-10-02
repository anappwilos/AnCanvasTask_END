import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from "react-i18next";
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import {
  MarkdownIssue,
  MarkdownValidationReport,
  validateMarkdownDocument,
} from '../utils/markdownSync';
import { SafeMarkdownNormalizerModal } from './SafeMarkdownNormalizerModal';

interface MarkdownSplitEditorProps {
  value: string;
  fileName: string;
  theme: 'dark' | 'light';
  onChange: (val: string) => void;
  onClose: () => void;
  onExport: () => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  splitRatio: number;
  onChangeSplitRatio?: (ratio: number) => void;
  onOpenNormalizer?: () => void;
}

export function MarkdownSplitEditor({
  value,
  fileName,
  theme,
  onChange,
  onClose,
  onExport,
  onShowToast,
  splitRatio,
  onChangeSplitRatio,
  onOpenNormalizer,
}: MarkdownSplitEditorProps) {
  const { t } = useTranslation();
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [copied, setCopied] = useState(false);
  const [showIssuesPanel, setShowIssuesPanel] = useState(false);
  const [isLocalNormalizerOpen, setIsLocalNormalizerOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Validation report in real time
  const validationReport: MarkdownValidationReport = useMemo(
    () => validateMarkdownDocument(value),
    [value]
  );

  // Parse basic counts
  const stats = useMemo(() => {
    const lines = value.split(/\r?\n/);
    const taskLines = lines.filter((l) => l.trim().match(/^[-*]\s*\[[ xX]\]/));
    const completedLines = lines.filter((l) => l.trim().match(/^[-*]\s*\[[xX]\]/));
    const sectionLines = lines.filter((l) => l.trim().startsWith('## '));
    const p0Lines = lines.filter((l) => l.toLowerCase().includes('priority: p0'));

    return {
      totalTasks: taskLines.length,
      completedTasks: completedLines.length,
      pendingTasks: taskLines.length - completedLines.length,
      sections: sectionLines.length,
      criticalCount: p0Lines.length,
      linesCount: lines.length,
    };
  }, [value]);

  // Handle local text changes with typing status
  const handleChange = useCallback(
    (newVal: string) => {
      setIsTyping(true);
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 500);

      onChange(newVal);
    },
    [onChange]
  );

  // Helper to insert snippet at current cursor or end
  const insertText = useCallback(
    (snippet: string, cursorOffset?: number) => {
      const view = editorRef.current?.view;
      if (!view) return;

      const selection = view.state.selection.main;
      const from = selection.from;
      const to = selection.to;

      view.dispatch({
        changes: { from, to, insert: snippet },
        selection: {
          anchor: from + (cursorOffset !== undefined ? cursorOffset : snippet.length),
        },
      });
      view.focus();
    },
    []
  );

  // Jump to specific line (1-based index)
  const jumpToLine = useCallback((lineNumber: number) => {
    const view = editorRef.current?.view;
    if (!view) return;

    const doc = view.state.doc;
    const safeLine = Math.max(1, Math.min(lineNumber + 1, doc.lines));
    const lineInfo = doc.line(safeLine);

    view.dispatch({
      selection: { anchor: lineInfo.from },
      scrollIntoView: true,
    });
    view.focus();
  }, []);

  // Copy markdown to clipboard
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onShowToast(t('toast.markdownCopied'), 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast(t('toast.markdownCopyError'), 'error');
    }
  }, [value, onShowToast]);

  // Open safe normalization dialog
  const handleOpenNormalizer = useCallback(() => {
    if (onOpenNormalizer) {
      onOpenNormalizer();
    } else {
      setIsLocalNormalizerOpen(true);
    }
  }, [onOpenNormalizer]);

  // CodeMirror extensions
  const extensions = useMemo(() => {
    const exts = [
      markdown(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.selectionSet) {
          const main = update.state.selection.main;
          const line = update.state.doc.lineAt(main.head);
          setCursorPos({
            line: line.number,
            col: main.head - line.from + 1,
          });
        }
      }),
    ];

    if (theme === 'dark') {
      exts.push(oneDark);
    }

    return exts;
  }, [theme]);

  return (
    <aside className="h-full flex flex-col bg-[var(--surface-container)] border-l border-[var(--outline)] select-none overflow-hidden relative font-sans text-[var(--on-surface)] transition-all">
      {/* Top Header */}
      <div className="h-11 px-3 bg-[var(--surface-container-high)] border-b border-[var(--outline)] flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[16px] text-sky-400 shrink-0">
            code_blocks
          </span>
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-xs font-semibold text-[var(--on-surface)] font-mono truncate">
              {fileName || 'TASKS.md'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isTyping ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span>{isTyping ? 'Sincronizando...' : 'Bidireccional en vivo'}</span>
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Preset Split Width Buttons */}
          {onChangeSplitRatio && (
            <div className="hidden lg:flex items-center gap-0.5 bg-[var(--surface)] p-0.5 rounded border border-[var(--outline)] mr-1">
              <button
                type="button"
                onClick={() => onChangeSplitRatio(35)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                  Math.round(splitRatio) === 35
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
                title="Dividir 35% Editor / 65% Canvas o Kanban"
              >
                35%
              </button>
              <button
                type="button"
                onClick={() => onChangeSplitRatio(50)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                  Math.round(splitRatio) === 50
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
                title="Dividir 50% / 50%"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => onChangeSplitRatio(65)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors ${
                  Math.round(splitRatio) === 65
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
                title="Dividir 65% Editor / 35% Canvas o Kanban"
              >
                65%
              </button>
            </div>
          )}

          {/* Normalización Segura button */}
          <button
            type="button"
            onClick={handleOpenNormalizer}
            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-950/60 text-sky-300 border border-sky-800/80 hover:bg-sky-900/80 cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
            title="Normalización segura de Markdown (Diff Git, AST y prevención de pérdidas)"
            aria-label="Normalización segura"
          >
            <span className="material-symbols-outlined text-[14px] text-sky-400">verified</span>
            <span className="hidden sm:inline">Normalizar</span>
          </button>

          {/* Copy Markdown */}
          <button
            type="button"
            onClick={handleCopy}
            className="btn-m3-icon w-7 h-7 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
            title={copied ? 'Copiado' : 'Copiar todo el Markdown'}
            aria-label="Copy Markdown"
          >
            <span className="material-symbols-outlined text-[15px]">
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>

          {/* Download file */}
          <button
            type="button"
            onClick={onExport}
            className="btn-m3-icon w-7 h-7 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
            title="Descargar archivo .md"
            aria-label="Export Markdown"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
          </button>

          <div className="w-px h-3.5 bg-[var(--outline)] my-auto mx-0.5" />

          {/* Close split view */}
          <button
            type="button"
            onClick={onClose}
            className="btn-m3-icon w-7 h-7 text-[var(--on-surface-variant)] hover:text-rose-400 cursor-pointer"
            title="Cerrar visor en tiempo real"
            aria-label="Close Markdown Editor"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      {/* Markdown Snippet & Structure Toolbar */}
      <div className="px-2.5 py-1.5 bg-[var(--surface)] border-b border-[var(--outline)] flex items-center justify-between gap-1 overflow-x-auto select-none shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => insertText('\n- [ ] Nueva tarea\n  - Priority: P1\n')}
            className="px-2 py-1 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline)] text-[11px] font-mono text-[var(--on-surface)] flex items-center gap-1 cursor-pointer transition-colors"
            title="Insertar nueva tarea pendiente (- [ ])"
          >
            <span className="text-sky-400 font-bold">+</span>
            <span>- [ ] Tarea</span>
          </button>

          <button
            type="button"
            onClick={() => insertText('\n## Nueva Sección\n\n- [ ] Tarea inicial\n  - Priority: P1\n')}
            className="px-2 py-1 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline)] text-[11px] font-mono text-[var(--on-surface)] flex items-center gap-1 cursor-pointer transition-colors"
            title="Insertar nueva sección (## Sección)"
          >
            <span className="text-purple-400 font-bold">##</span>
            <span>Sección</span>
          </button>

          <div className="w-px h-3.5 bg-[var(--outline)] mx-1" />

          {/* Quick Priorities */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => insertText('  - Priority: P0\n')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/60 text-rose-300 border border-rose-800/80 hover:bg-rose-900/80 cursor-pointer"
              title="Insertar Priority: P0 (Crítica)"
            >
              P0
            </button>
            <button
              type="button"
              onClick={() => insertText('  - Priority: P1\n')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/80 hover:bg-amber-900/80 cursor-pointer"
              title="Insertar Priority: P1 (Alta)"
            >
              P1
            </button>
            <button
              type="button"
              onClick={() => insertText('  - Priority: P2\n')}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950/60 text-blue-300 border border-blue-800/80 hover:bg-blue-900/80 cursor-pointer"
              title="Insertar Priority: P2 (Media)"
            >
              P2
            </button>
          </div>

          <div className="w-px h-3.5 bg-[var(--outline)] mx-1" />

          <button
            type="button"
            onClick={() => insertText('  - Blocked by: id-tarea\n')}
            className="px-2 py-1 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline)] text-[11px] font-mono text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
            title="Insertar dependencia (Blocked by: id)"
          >
            <span className="material-symbols-outlined text-[13px]">lock</span>
            <span>Blocked by</span>
          </button>

          <button
            type="button"
            onClick={() => insertText('  - Tags: frontend, auth\n')}
            className="px-2 py-1 rounded bg-[var(--surface-container)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline)] text-[11px] font-mono text-sky-300 flex items-center gap-1 cursor-pointer transition-colors"
            title="Insertar etiquetas (Tags: ...)"
          >
            <span className="material-symbols-outlined text-[13px]">label</span>
            <span>Tags</span>
          </button>
        </div>

        {/* Problems Indicator Toggle */}
        {validationReport.issues.length > 0 && (
          <button
            type="button"
            onClick={() => setShowIssuesPanel((prev) => !prev)}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${
              validationReport.hasErrors
                ? 'bg-rose-950/80 text-rose-300 border-rose-700 animate-pulse'
                : 'bg-amber-950/80 text-amber-300 border-amber-700'
            }`}
            title="Ver/Ocultar problemas detectados en el Markdown"
          >
            <span>⚠</span>
            <span>{validationReport.issues.length} {validationReport.issues.length === 1 ? 'problema' : 'problemas'}</span>
          </button>
        )}
      </div>

      {/* Embedded Issues Drawer (if active) */}
      {showIssuesPanel && validationReport.issues.length > 0 && (
        <div className="bg-[var(--surface-container-high)] border-b border-[var(--outline)] p-2 max-h-36 overflow-y-auto flex flex-col gap-1.5 select-none shrink-0 animate-slide-down">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
              Diagnósticos de sincronización
            </span>
            <button
              type="button"
              onClick={() => setShowIssuesPanel(false)}
              className="text-[10px] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
            >
              Cerrar
            </button>
          </div>
          {validationReport.issues.map((issue: MarkdownIssue) => (
            <div
              key={issue.id}
              onClick={() => {
                if (issue.lineIndex !== undefined) {
                  jumpToLine(issue.lineIndex);
                }
              }}
              className="p-1.5 rounded bg-[var(--surface)] hover:bg-[var(--surface-container-highest)] border border-[var(--outline)] flex items-center justify-between gap-2 text-xs font-mono cursor-pointer transition-colors"
              title="Clic para saltar a esta línea en el editor"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className={
                    issue.severity === 'error'
                      ? 'text-rose-400 font-bold'
                      : issue.severity === 'warning'
                      ? 'text-amber-400 font-bold'
                      : 'text-sky-400'
                  }
                >
                  {issue.severity === 'error' ? '✖' : '⚠'}
                </span>
                <span className="truncate text-[var(--on-surface)] text-[11px]">
                  {issue.message}
                </span>
              </div>
              {issue.lineIndex !== undefined && (
                <span className="text-[10px] text-[var(--on-surface-variant)] shrink-0 px-1 py-0.2 rounded bg-[var(--surface-container)]">
                  L{issue.lineIndex + 1}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main CodeMirror Editor Area */}
      <div className="flex-1 w-full h-full overflow-auto bg-[var(--surface)] text-xs font-mono">
        <CodeMirror
          ref={editorRef}
          value={value}
          height="100%"
          extensions={extensions}
          onChange={handleChange}
          theme={theme === 'dark' ? oneDark : 'light'}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          className="h-full antask-codemirror text-[12px] leading-relaxed"
        />
      </div>

      {/* Status Bar */}
      <div className="h-7 px-3 bg-[var(--surface-container-high)] border-t border-[var(--outline)] flex items-center justify-between text-[11px] font-mono text-[var(--on-surface-variant)] select-none shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Tareas: <strong className="text-[var(--on-surface)]">{stats.totalTasks}</strong> (
            <span className="text-emerald-400">{stats.completedTasks} done</span> /{' '}
            <span className="text-amber-400">{stats.pendingTasks} todo</span>)
          </span>
          <span className="hidden sm:inline">
            Secciones: <strong className="text-[var(--on-surface)]">{stats.sections}</strong>
          </span>
          {stats.criticalCount > 0 && (
            <span className="text-rose-400 font-bold hidden md:inline">
              P0: {stats.criticalCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="hidden sm:inline">UTF-8</span>
          <span className="hidden md:inline">Markdown</span>
        </div>
      </div>

      {/* Safe Markdown Normalizer Modal */}
      {isLocalNormalizerOpen && (
        <SafeMarkdownNormalizerModal
          isOpen={isLocalNormalizerOpen}
          documentTitle={fileName}
          originalMarkdown={value}
          theme={theme}
          onClose={() => setIsLocalNormalizerOpen(false)}
          onApply={(normalizedMd) => {
            onChange(normalizedMd);
          }}
          onShowToast={onShowToast}
        />
      )}
    </aside>
  );
}
