import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { DiffEditor } from '@monaco-editor/react';
import {
  analyzeMarkdownNormalization,
  applySelectedChanges,
  setChangesPreset,
  NormalizationAnalysisResult,
  NormalizedChange,
  ChangeCategory,
} from '../utils/markdownNormalizer';

interface SafeMarkdownNormalizerModalProps {
  isOpen: boolean;
  documentTitle?: string;
  originalMarkdown: string;
  theme: 'dark' | 'light';
  onClose: () => void;
  onApply: (confirmedMarkdown: string) => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

type FilterTab = 'all' | 'formato_seguro' | 'cambio_estructural' | 'anadido' | 'eliminacion' | 'loss_risk';

export function SafeMarkdownNormalizerModal({
  isOpen,
  documentTitle = 'TASKS.md',
  originalMarkdown,
  theme,
  onClose,
  onApply,
  onShowToast,
}: SafeMarkdownNormalizerModalProps) {
  const { i18n } = useLingui();
  const [analysis, setAnalysis] = useState<NormalizationAnalysisResult | null>(null);
  const [changes, setChanges] = useState<NormalizedChange[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('all');
  const [renderSideBySide, setRenderSideBySide] = useState<boolean>(true);
  const [showInvisibles, setShowInvisibles] = useState<boolean>(true);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState<boolean>(false);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const diffEditorRef = useRef<any>(null);

  // Initialize or re-run analysis when modal opens or original markdown changes
  useEffect(() => {
    if (isOpen) {
      const result = analyzeMarkdownNormalization(originalMarkdown);
      setAnalysis(result);
      setChanges(result.changes);
      setHasAcknowledgedRisk(false);
      setSelectedFilter('all');
      setSelectedChangeId(result.changes[0]?.id || null);
    }
  }, [isOpen, originalMarkdown]);

  // Compute effective markdown dynamically based on accepted/rejected changes
  const effectiveMarkdown = useMemo(() => {
    return applySelectedChanges(originalMarkdown, changes);
  }, [originalMarkdown, changes]);

  // Dynamic statistics
  const currentStats = useMemo(() => {
    const total = changes.length;
    const accepted = changes.filter((c) => c.isAccepted).length;
    const rejected = total - accepted;
    const safeFormat = changes.filter((c) => c.category === 'formato_seguro').length;
    const structural = changes.filter((c) => c.category === 'cambio_estructural').length;
    const addition = changes.filter((c) => c.category === 'anadido').length;
    const deletion = changes.filter((c) => c.category === 'eliminacion').length;
    const lossRisk = changes.filter((c) => c.hasLossRisk).length;
    const acceptedLossRisk = changes.filter((c) => c.hasLossRisk && c.isAccepted).length;

    return {
      total,
      accepted,
      rejected,
      safeFormat,
      structural,
      addition,
      deletion,
      lossRisk,
      acceptedLossRisk,
    };
  }, [changes]);

  // Filtered change items for the list
  const filteredChanges = useMemo(() => {
    return changes.filter((c) => {
      if (selectedFilter === 'all') return true;
      if (selectedFilter === 'loss_risk') return c.hasLossRisk;
      return c.category === selectedFilter;
    });
  }, [changes, selectedFilter]);

  // Toggle individual change
  const handleToggleChange = useCallback((id: string) => {
    setChanges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isAccepted: !c.isAccepted } : c))
    );
  }, []);

  // Quick Action presets
  const handlePreset = useCallback(
    (preset: 'safe_only' | 'no_deletions' | 'accept_all' | 'reject_all') => {
      setChanges((prev) => setChangesPreset(prev, preset));

      let toastMsg = '';
      switch (preset) {
        case 'safe_only':
          toastMsg = i18n._(msg`Aplicados solo cambios de formato seguro`);
          break;
        case 'no_deletions':
          toastMsg = i18n._(msg`Aplicados cambios sin eliminaciones`);
          break;
        case 'accept_all':
          toastMsg = i18n._(msg`Todos los cambios aceptados`);
          break;
        case 'reject_all':
          toastMsg = i18n._(msg`Todos los cambios rechazados (original intacto)`);
          break;
      }
      onShowToast(toastMsg, 'info');
    },
    [onShowToast]
  );

  // Copy result to clipboard
  const handleCopyResult = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(effectiveMarkdown);
      onShowToast(i18n._(msg`¡Copiado!`), 'success');
    } catch {
      onShowToast('Error al copiar', 'error');
    }
  }, [effectiveMarkdown, onShowToast]);

  // Jump editor to line when clicking card
  const handleSelectCard = useCallback((change: NormalizedChange) => {
    setSelectedChangeId(change.id);
    if (diffEditorRef.current) {
      try {
        const modifiedEditor = diffEditorRef.current.getModifiedEditor();
        if (modifiedEditor) {
          modifiedEditor.revealLineInCenter(change.modifiedStartLine || 1);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Apply changes to parent
  const handleConfirmAndApply = useCallback(() => {
    if (currentStats.acceptedLossRisk > 0 && !hasAcknowledgedRisk) {
      onShowToast(
        i18n._(msg`Confirma la casilla de seguridad antes de aplicar eliminaciones con riesgo.`),
        'warning'
      );
      return;
    }

    onApply(effectiveMarkdown);
    onClose();
  }, [
    effectiveMarkdown,
    currentStats.acceptedLossRisk,
    hasAcknowledgedRisk,
    onApply,
    onShowToast,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="normalizer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs font-sans text-[var(--on-surface)]"
    >
      <div id="div-safemarkdownnormalizermodal-1" className="w-full max-w-[96vw] xl:max-w-7xl h-[92vh] flex flex-col bg-[var(--surface-container)] border border-[var(--outline)] rounded-lg shadow-2xl overflow-hidden">
        {/* Compact Header */}
        <header className="h-12 px-3.5 bg-[var(--surface-container-high)] border-b border-[var(--outline)] flex items-center justify-between gap-3 shrink-0">
          <div id="div-safemarkdownnormalizermodal-2" className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[18px] text-sky-400 shrink-0">
              verified
            </span>
            <h2 id="normalizer-title" className="text-xs sm:text-sm font-semibold text-[var(--on-surface)] truncate">
              Normalización Segura
            </h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--surface)] border border-[var(--outline)] text-[var(--on-surface-variant)] truncate">
              {documentTitle}
            </span>
          </div>

          <div id="div-safemarkdownnormalizermodal-3" className="flex items-center gap-2">
            {/* Toggle Hidden / Invisible Characters */}
            <button
              type="button"
              onClick={() => setShowInvisibles((prev) => !prev)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors flex items-center gap-1 ${
                showInvisibles
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] border-[var(--primary)] font-medium shadow-xs'
                  : 'bg-[var(--surface)] text-[var(--on-surface-variant)] border-[var(--outline)] hover:text-[var(--on-surface)]'
              }`}
              title={
                showInvisibles
                  ? 'Ocultar caracteres invisibles (espacios, tabs, saltos de línea)'
                  : 'Mostrar caracteres ocultos (espacios, tabs, saltos de línea)'
              }
              aria-label="Alternar caracteres ocultos"
            >
              <span className="font-bold text-[11px] leading-none">¶</span>
              <span className="hidden sm:inline">{i18n._(msg`Invisibles`)}</span>
            </button>

            {/* View Mode Toggle */}
            <div id="div-safemarkdownnormalizermodal-4" className="flex items-center bg-[var(--surface)] p-0.5 rounded border border-[var(--outline)] text-[11px]">
              <button
                type="button"
                onClick={() => setRenderSideBySide(true)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  renderSideBySide
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-medium'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
                title="Lado a lado"
              >
                Lado a lado
              </button>
              <button
                type="button"
                onClick={() => setRenderSideBySide(false)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  !renderSideBySide
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-medium'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
                title="En línea"
              >
                En línea
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)] cursor-pointer transition-colors"
              title="Cerrar sin guardar"
              aria-label="Cerrar modal"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </header>

        {/* Compact Quick Actions Bar */}
        <div id="div-safemarkdownnormalizermodal-5" className="px-3.5 py-2 bg-[var(--surface)] border-b border-[var(--outline)] flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div id="div-safemarkdownnormalizermodal-6" className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[var(--on-surface-variant)] mr-1">{i18n._(msg`Acciones`)}:</span>
            <button
              type="button"
              onClick={() => handlePreset('safe_only')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-sky-950/40 text-sky-300 border border-sky-800/60 hover:bg-sky-900/60 cursor-pointer transition-colors"
              title="Aceptar cambios seguros de formato"
            >
              Seguros ({currentStats.safeFormat})
            </button>
            <button
              type="button"
              onClick={() => handlePreset('no_deletions')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/40 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60 cursor-pointer transition-colors"
              title="Aceptar todo excepto eliminaciones"
            >
              Sin eliminaciones
            </button>
            <button
              type="button"
              onClick={() => handlePreset('accept_all')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60 cursor-pointer transition-colors"
              title="Aceptar todos los cambios"
            >
              Aceptar todo
            </button>
            <button
              type="button"
              onClick={() => handlePreset('reject_all')}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-container)] text-[var(--on-surface-variant)] border border-[var(--outline)] hover:text-[var(--on-surface)] cursor-pointer transition-colors"
              title="Rechazar todos los cambios"
            >
              Rechazar todo
            </button>
          </div>

          <div id="div-safemarkdownnormalizermodal-7" className="text-[11px] text-[var(--on-surface-variant)]">
            <span>
              {i18n._(msg`${currentStats.accepted} de ${currentStats.total} aceptados`)}
            </span>
          </div>
        </div>

        {/* Compact Loss Alert Banner (only when risk exists) */}
        {currentStats.lossRisk > 0 && (
          <div id="div-safemarkdownnormalizermodal-8" className="px-3.5 py-1.5 bg-rose-950/60 border-b border-rose-800/80 text-rose-200 text-xs flex items-center justify-between gap-2 shrink-0">
            <div id="div-safemarkdownnormalizermodal-9" className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-rose-400 shrink-0">warning</span>
              <span>
                <strong>{i18n._(msg`Aviso`)}:</strong> {currentStats.lossRisk} {i18n._(msg`posibles pérdidas de texto detectadas`)}.
                {currentStats.acceptedLossRisk === 0 && ' (Protegidas / rechazadas)'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFilter('loss_risk')}
              className="text-[11px] font-medium underline text-rose-300 hover:text-rose-100 cursor-pointer"
            >
              Filtrar riesgos
            </button>
          </div>
        )}

        {/* Main Body: Split View */}
        <div id="div-safemarkdownnormalizermodal-10" className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Panel: Scannable Changes List */}
          <aside className="w-full md:w-80 flex flex-col bg-[var(--surface-container)] border-r border-[var(--outline)] shrink-0 overflow-hidden">
            {/* Filter Tabs */}
            <div id="div-safemarkdownnormalizermodal-11" className="p-1.5 border-b border-[var(--outline)] bg-[var(--surface-container-high)] flex flex-wrap gap-1 text-[10px]">
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className={`px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  selectedFilter === 'all'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                    : 'bg-[var(--surface)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                Todos ({currentStats.total})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('formato_seguro')}
                className={`px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  selectedFilter === 'formato_seguro'
                    ? 'bg-sky-600 text-white'
                    : 'bg-[var(--surface)] text-sky-400 hover:text-sky-300'
                }`}
              >
                Seguros ({currentStats.safeFormat})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('cambio_estructural')}
                className={`px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  selectedFilter === 'cambio_estructural'
                    ? 'bg-amber-600 text-white'
                    : 'bg-[var(--surface)] text-amber-400 hover:text-amber-300'
                }`}
              >
                Estructura ({currentStats.structural})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('anadido')}
                className={`px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  selectedFilter === 'anadido'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--surface)] text-emerald-400 hover:text-emerald-300'
                }`}
              >
                + ({currentStats.addition})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('eliminacion')}
                className={`px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                  selectedFilter === 'eliminacion'
                    ? 'bg-rose-600 text-white'
                    : 'bg-[var(--surface)] text-rose-400 hover:text-rose-300'
                }`}
              >
                - ({currentStats.deletion})
              </button>
            </div>

            {/* Changes List */}
            <div id="div-safemarkdownnormalizermodal-12" className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
              {filteredChanges.length === 0 ? (
                <div id="div-safemarkdownnormalizermodal-13" className="p-6 text-center text-xs text-[var(--on-surface-variant)] flex flex-col items-center justify-center h-40">
                  <span className="material-symbols-outlined text-[24px] text-emerald-400/80 mb-1">
                    check_circle
                  </span>
                  <p className="font-medium text-[var(--on-surface)]">
                    {changes.length === 0 ? i18n._(msg`Documento normalizado`) : i18n._(msg`Sin cambios aquí`)}
                  </p>
                </div>
              ) : (
                filteredChanges.map((change) => {
                  const isSelected = selectedChangeId === change.id;
                  let badgeClass = 'text-sky-400 border-sky-800/80 bg-sky-950/40';

                  if (change.category === 'cambio_estructural') {
                    badgeClass = 'text-amber-400 border-amber-800/80 bg-amber-950/40';
                  } else if (change.category === 'anadido') {
                    badgeClass = 'text-emerald-400 border-emerald-800/80 bg-emerald-950/40';
                  } else if (change.category === 'eliminacion') {
                    badgeClass = 'text-rose-400 border-rose-800/80 bg-rose-950/40';
                  }

                  return (
                    <div
                      key={change.id}
                      onClick={() => handleSelectCard(change)}
                      className={`p-2 rounded border transition-colors cursor-pointer text-xs ${
                        isSelected
                          ? 'border-[var(--primary)] bg-[var(--surface-container-highest)]'
                          : 'border-[var(--outline)] bg-[var(--surface)] hover:border-[var(--on-surface-variant)]'
                      }`}
                    >
                      <div id="div-safemarkdownnormalizermodal-14" className="flex items-center justify-between gap-1.5">
                        <div id="div-safemarkdownnormalizermodal-15" className="flex items-center gap-1.5 min-w-0">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${badgeClass}`}>
                            {change.categoryLabel}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--on-surface-variant)]">
                            L{change.originalStartLine}
                          </span>
                          {change.hasLossRisk && (
                            <span className="text-[10px] font-bold text-rose-400 flex items-center">
                              ⚠️ Riesgo
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleChange(change.id);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-colors ${
                            change.isAccepted
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                              : 'bg-[var(--surface)] text-[var(--on-surface-variant)] border-[var(--outline)]'
                          }`}
                        >
                          {change.isAccepted ? i18n._(msg`Aceptado`) : i18n._(msg`Rechazado`)}
                        </button>
                      </div>

                      <p className="text-[11px] text-[var(--on-surface-variant)] mt-1">
                        {change.description}
                      </p>

                      {/* Visual Inline Space / Text Diff Preview */}
                      <div id="div-safemarkdownnormalizermodal-16" className="mt-1.5 p-1.5 rounded bg-[var(--surface-container-highest)] border border-[var(--outline)] font-mono text-[10px] space-y-1">
                        <div id="div-safemarkdownnormalizermodal-17" className="text-rose-400 flex items-start gap-1 overflow-x-auto">
                          <span className="font-bold text-rose-500 select-none">-</span>
                          <span className="break-all whitespace-pre-wrap">
                            {change.originalLines.map((l) => l.replace(/ /g, '·').replace(/\t/g, '→ ')).join('\n') || '(vacío)'}
                          </span>
                        </div>
                        <div id="div-safemarkdownnormalizermodal-18" className="text-emerald-400 flex items-start gap-1 overflow-x-auto">
                          <span className="font-bold text-emerald-500 select-none">+</span>
                          <span className="break-all whitespace-pre-wrap">
                            {change.proposedLines.map((l) => l.replace(/ /g, '·').replace(/\t/g, '→ ')).join('\n') || '(vacío)'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Panel: Monaco DiffEditor */}
          <main className="flex-1 flex flex-col min-w-0 bg-[var(--surface)] overflow-hidden">
            {/* Diff Header */}
            <div id="div-safemarkdownnormalizermodal-19" className="h-7 px-3 bg-[var(--surface-container-high)] border-b border-[var(--outline)] flex items-center justify-between shrink-0 text-[11px] font-mono text-[var(--on-surface-variant)]">
              <div id="div-safemarkdownnormalizermodal-20" className="flex items-center gap-2">
                <span className="text-rose-400 font-semibold">{i18n._(msg`Original`)}</span>
                <span>➔</span>
                <span className="text-emerald-400 font-semibold">{i18n._(msg`Propuesta`)}</span>
              </div>
              {showInvisibles && (
                <div id="div-safemarkdownnormalizermodal-21" className="text-[10px] text-[var(--on-surface-variant)] hidden sm:flex items-center gap-2">
                  <span className="bg-[var(--surface)] px-1.5 py-0.2 rounded border border-[var(--outline)] font-mono">{i18n._(msg`· espacio`)}</span>
                  <span className="bg-[var(--surface)] px-1.5 py-0.2 rounded border border-[var(--outline)] font-mono">{i18n._(msg`→ tab`)}</span>
                </div>
              )}
            </div>

            {/* Monaco DiffEditor */}
            <div id="div-safemarkdownnormalizermodal-22" className="flex-1 min-h-0 w-full relative">
              <DiffEditor
                height="100%"
                language="markdown"
                original={analysis ? analysis.originalMarkdown : originalMarkdown}
                modified={effectiveMarkdown}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                onMount={(editor) => {
                  diffEditorRef.current = editor;
                }}
                options={{
                  readOnly: true,
                  renderSideBySide: renderSideBySide,
                  ignoreTrimWhitespace: false,
                  renderWhitespace: showInvisibles ? 'all' : 'selection',
                  renderControlCharacters: showInvisibles,
                  unicodeHighlight: {
                    invisibleCharacters: showInvisibles,
                    ambiguousCharacters: true,
                  },
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  automaticLayout: true,
                  renderIndicators: true,
                  originalEditable: false,
                  diffWordWrap: 'on',
                }}
                loading={
                  <div id="div-safemarkdownnormalizermodal-23" className="h-full flex items-center justify-center text-xs text-[var(--on-surface-variant)]">
                    Cargando comparador...
                  </div>
                }
              />
            </div>
          </main>
        </div>

        {/* Clean Footer */}
        <footer className="h-12 px-3.5 bg-[var(--surface-container-high)] border-t border-[var(--outline)] flex items-center justify-between gap-2 shrink-0">
          <div id="div-safemarkdownnormalizermodal-24" className="flex items-center gap-2 text-xs">
            {currentStats.acceptedLossRisk > 0 && (
              <label className="flex items-center gap-1.5 text-[11px] bg-rose-950/60 text-rose-200 px-2 py-0.5 rounded border border-rose-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAcknowledgedRisk}
                  onChange={(e) => setHasAcknowledgedRisk(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>{i18n._(msg`Confirmar ${currentStats.acceptedLossRisk} eliminaciones con riesgo`)}</span>
              </label>
            )}
          </div>

          <div id="div-safemarkdownnormalizermodal-25" className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyResult}
              className="px-2.5 py-1 rounded text-xs font-medium bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] hover:bg-[var(--surface-container-highest)] cursor-pointer transition-colors"
            >
              Copiar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmAndApply}
              disabled={currentStats.acceptedLossRisk > 0 && !hasAcknowledgedRisk}
              className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                currentStats.acceptedLossRisk > 0 && !hasAcknowledgedRisk
                  ? 'bg-gray-600 text-gray-300 opacity-60 cursor-not-allowed'
                  : 'bg-[var(--primary)] text-[var(--on-primary)] hover:brightness-110'
              }`}
            >
              Confirmar y Aplicar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
