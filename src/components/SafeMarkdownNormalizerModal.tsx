import React, { useMemo, useState, useCallback, useEffect } from 'react';
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
  // Analysis state
  const [analysis, setAnalysis] = useState<NormalizationAnalysisResult | null>(null);
  const [changes, setChanges] = useState<NormalizedChange[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterTab>('all');
  const [renderSideBySide, setRenderSideBySide] = useState<boolean>(true);
  const [hasAcknowledgedRisk, setHasAcknowledgedRisk] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);

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

      let msg = '';
      switch (preset) {
        case 'safe_only':
          msg = 'Se aceptaron solo los cambios de formato seguro';
          break;
        case 'no_deletions':
          msg = 'Se aceptaron todos los cambios excepto eliminaciones y riesgos';
          break;
        case 'accept_all':
          msg = 'Se aceptaron todos los cambios propuestos';
          break;
        case 'reject_all':
          msg = 'Se rechazaron todos los cambios (documento original intacto)';
          break;
      }
      onShowToast(msg, 'info');
    },
    [onShowToast]
  );

  // Copy result to clipboard
  const handleCopyResult = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(effectiveMarkdown);
      setIsCopied(true);
      onShowToast('Markdown normalizado copiado al portapapeles', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      onShowToast('Error al copiar al portapapeles', 'error');
    }
  }, [effectiveMarkdown, onShowToast]);

  // Download normalized file
  const handleDownload = useCallback(() => {
    try {
      const blob = new Blob([effectiveMarkdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `normalized-${documentTitle.replace(/\s+/g, '_')}`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('Archivo .md descargado correctamente', 'success');
    } catch {
      onShowToast('Error al descargar el archivo', 'error');
    }
  }, [effectiveMarkdown, documentTitle, onShowToast]);

  // Apply changes to parent
  const handleConfirmAndApply = useCallback(() => {
    if (currentStats.acceptedLossRisk > 0 && !hasAcknowledgedRisk) {
      onShowToast(
        'Por seguridad, marca la casilla de confirmación de pérdida de contenido antes de sobrescribir.',
        'warning'
      );
      return;
    }

    onApply(effectiveMarkdown);
    onShowToast('Markdown normalizado aplicado con éxito', 'success');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-xs font-sans text-[var(--on-surface)] animate-fade-in"
    >
      <div className="w-full max-w-[96vw] xl:max-w-7xl h-[92vh] flex flex-col bg-[var(--surface-container)] border border-[var(--outline)] rounded-lg shadow-2xl overflow-hidden">
        {/* Top Header */}
        <header className="px-4 py-3 bg-[var(--surface-container-high)] border-b border-[var(--outline)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="normalizer-title" className="text-base font-semibold text-[var(--on-surface)] leading-none">
                  Normalización Segura de Markdown
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--surface)] border border-[var(--outline)] text-[var(--on-surface-variant)]">
                  {documentTitle}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Modo seguro activo
                </span>
              </div>
              <p className="text-xs text-[var(--on-surface-variant)] mt-0.5">
                Analiza sintaxis con remark/unified, calcula diff con git-style y previene pérdida involuntaria de contenido.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Diff View Toggle */}
            <div className="flex items-center bg-[var(--surface)] p-0.5 rounded border border-[var(--outline)] text-xs">
              <button
                type="button"
                onClick={() => setRenderSideBySide(true)}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
                  renderSideBySide
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-xs'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
                title="Ver diferencias lado a lado (Side-by-side)"
              >
                <span className="material-symbols-outlined text-[14px]">splitscreen</span>
                <span>Lado a lado</span>
              </button>
              <button
                type="button"
                onClick={() => setRenderSideBySide(false)}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors flex items-center gap-1.5 ${
                  !renderSideBySide
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-xs'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
                title="Ver diferencias en línea (Inline)"
              >
                <span className="material-symbols-outlined text-[14px]">view_agenda</span>
                <span>En línea</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-highest)] cursor-pointer transition-colors"
              title="Cerrar sin guardar"
              aria-label="Cerrar modal"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </header>

        {/* Action Toolbar & Preset Actions */}
        <div className="px-4 py-2.5 bg-[var(--surface)] border-b border-[var(--outline)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-[var(--on-surface-variant)] mr-1">
              Acciones rápidas:
            </span>

            {/* Aceptar cambios seguros */}
            <button
              type="button"
              onClick={() => handlePreset('safe_only')}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-sky-950/40 text-sky-300 border border-sky-800/60 hover:bg-sky-900/60 cursor-pointer transition-colors flex items-center gap-1.5"
              title="Acepta únicamente cambios de espaciado, casillas y formato estándar sin riesgo"
            >
              <span className="material-symbols-outlined text-[15px] text-sky-400">check_circle</span>
              <span>Aceptar cambios seguros</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-900/80 font-mono">
                {currentStats.safeFormat}
              </span>
            </button>

            {/* Aceptar todo excepto eliminaciones */}
            <button
              type="button"
              onClick={() => handlePreset('no_deletions')}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-800/60 hover:bg-amber-900/60 cursor-pointer transition-colors flex items-center gap-1.5"
              title="Acepta formato, estructura y añadidos, pero rechaza cualquier eliminación o posible pérdida"
            >
              <span className="material-symbols-outlined text-[15px] text-amber-400">shield</span>
              <span>Aceptar todo excepto eliminaciones</span>
            </button>

            {/* Aceptar todo */}
            <button
              type="button"
              onClick={() => handlePreset('accept_all')}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/60 cursor-pointer transition-colors flex items-center gap-1.5"
              title="Aceptar todos los cambios propuestos por la normalización"
            >
              <span className="material-symbols-outlined text-[15px] text-emerald-400">done_all</span>
              <span>Aceptar todo</span>
            </button>

            {/* Rechazar todo */}
            <button
              type="button"
              onClick={() => handlePreset('reject_all')}
              className="px-2.5 py-1 rounded-md text-xs font-medium bg-rose-950/40 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60 cursor-pointer transition-colors flex items-center gap-1.5"
              title="Rechazar todos los cambios y conservar el Markdown original intacto"
            >
              <span className="material-symbols-outlined text-[15px] text-rose-400">undo</span>
              <span>Rechazar todo</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--on-surface-variant)]">
              Estado: <strong className="text-[var(--on-surface)]">{currentStats.accepted}</strong> de{' '}
              <strong className="text-[var(--on-surface)]">{currentStats.total}</strong> cambios aplicados
            </span>
          </div>
        </div>

        {/* Content Loss Alert Banner (if any) */}
        {currentStats.lossRisk > 0 && (
          <div className="px-4 py-2 bg-rose-950/60 border-b border-rose-800/80 text-rose-200 text-xs flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-rose-400 shrink-0">
                warning
              </span>
              <div>
                <strong>Aviso de seguridad:</strong> Se detectaron{' '}
                <span className="font-semibold underline">
                  {currentStats.lossRisk} posibles pérdidas o truncamientos de contenido
                </span>{' '}
                en la propuesta automática (líneas o términos que existen en el original pero no en la normalización).
                {currentStats.acceptedLossRisk > 0 ? (
                  <span className="ml-1 text-rose-300 font-medium">
                    (Actualmente tienes {currentStats.acceptedLossRisk} cambios con riesgo marcados para aplicar).
                  </span>
                ) : (
                  <span className="ml-1 text-emerald-300 font-medium">
                    (Los cambios con riesgo están actualmente rechazados y protegidos).
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedFilter('loss_risk')}
                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-900/80 hover:bg-rose-800 text-rose-100 cursor-pointer transition-colors"
              >
                Ver riesgos ({currentStats.lossRisk})
              </button>
            </div>
          </div>
        )}

        {/* Main Body: Split View with Changes Inspector and Monaco DiffEditor */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Panel: Classified Changes Inspector */}
          <aside className="w-full md:w-80 lg:w-96 flex flex-col bg-[var(--surface-container)] border-r border-[var(--outline)] shrink-0 overflow-hidden">
            {/* Filter Tabs */}
            <div className="p-2 border-b border-[var(--outline)] bg-[var(--surface-container-high)] flex flex-wrap gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className={`px-2 py-1 rounded font-medium cursor-pointer transition-colors ${
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
                className={`px-2 py-1 rounded font-medium cursor-pointer transition-colors ${
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
                className={`px-2 py-1 rounded font-medium cursor-pointer transition-colors ${
                  selectedFilter === 'cambio_estructural'
                    ? 'bg-amber-600 text-white'
                    : 'bg-[var(--surface)] text-amber-400 hover:text-amber-300'
                }`}
              >
                Estructurales ({currentStats.structural})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('anadido')}
                className={`px-2 py-1 rounded font-medium cursor-pointer transition-colors ${
                  selectedFilter === 'anadido'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--surface)] text-emerald-400 hover:text-emerald-300'
                }`}
              >
                Añadidos ({currentStats.addition})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('eliminacion')}
                className={`px-2 py-1 rounded font-medium cursor-pointer transition-colors ${
                  selectedFilter === 'eliminacion'
                    ? 'bg-rose-600 text-white'
                    : 'bg-[var(--surface)] text-rose-400 hover:text-rose-300'
                }`}
              >
                Eliminaciones ({currentStats.deletion})
              </button>
              {currentStats.lossRisk > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedFilter('loss_risk')}
                  className={`px-2 py-1 rounded font-medium cursor-pointer transition-colors ${
                    selectedFilter === 'loss_risk'
                      ? 'bg-red-700 text-white'
                      : 'bg-red-950/80 text-red-300 hover:bg-red-900'
                  }`}
                >
                  ⚠️ Riesgos ({currentStats.lossRisk})
                </button>
              )}
            </div>

            {/* Changes List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredChanges.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--on-surface-variant)] flex flex-col items-center justify-center h-48">
                  <span className="material-symbols-outlined text-[32px] text-emerald-400/80 mb-2">
                    check_circle
                  </span>
                  <p className="font-medium text-[var(--on-surface)]">
                    {changes.length === 0
                      ? 'Documento ya normalizado'
                      : 'Sin cambios en esta categoría'}
                  </p>
                  <p className="text-[11px] text-[var(--on-surface-variant)] mt-1 max-w-[200px]">
                    {changes.length === 0
                      ? 'El archivo cumple todas las normas de formato y estructura.'
                      : 'Selecciona otro filtro para revisar los cambios restantes.'}
                  </p>
                </div>
              ) : (
                filteredChanges.map((change) => {
                  const isSelected = selectedChangeId === change.id;
                  let badgeColor = 'bg-sky-950/60 text-sky-300 border-sky-800/80';
                  let icon = 'format_paint';

                  if (change.category === 'cambio_estructural') {
                    badgeColor = 'bg-amber-950/60 text-amber-300 border-amber-800/80';
                    icon = 'account_tree';
                  } else if (change.category === 'anadido') {
                    badgeColor = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
                    icon = 'add_circle';
                  } else if (change.category === 'eliminacion') {
                    badgeColor = 'bg-rose-950/60 text-rose-300 border-rose-800/80';
                    icon = 'remove_circle';
                  }

                  return (
                    <div
                      key={change.id}
                      onClick={() => setSelectedChangeId(change.id)}
                      className={`p-2.5 rounded-md border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--primary)] bg-[var(--surface-container-highest)] shadow-xs'
                          : 'border-[var(--outline)] bg-[var(--surface)] hover:border-[var(--on-surface-variant)]'
                      } ${change.hasLossRisk ? 'ring-1 ring-rose-500/40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 ${badgeColor}`}
                          >
                            <span className="material-symbols-outlined text-[12px]">{icon}</span>
                            <span>{change.categoryLabel}</span>
                          </span>

                          <span className="text-[10px] font-mono text-[var(--on-surface-variant)]">
                            L{change.originalStartLine} ➔ L{change.modifiedStartLine}
                          </span>

                          {change.hasLossRisk && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-900 text-rose-100 flex items-center gap-1 animate-pulse">
                              <span className="material-symbols-outlined text-[11px]">warning</span>
                              Riesgo pérdida
                            </span>
                          )}
                        </div>

                        {/* Accept / Reject Toggle Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleChange(change.id);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border cursor-pointer transition-colors flex items-center gap-1 ${
                            change.isAccepted
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60'
                              : 'bg-[var(--surface)] text-[var(--on-surface-variant)] border-[var(--outline)] hover:text-[var(--on-surface)]'
                          }`}
                          title={
                            change.isAccepted
                              ? 'Cambio aceptado (Clic para rechazar)'
                              : 'Cambio rechazado (Clic para aceptar)'
                          }
                        >
                          <span className="material-symbols-outlined text-[13px]">
                            {change.isAccepted ? 'check' : 'close'}
                          </span>
                          <span>{change.isAccepted ? 'Aceptado' : 'Rechazado'}</span>
                        </button>
                      </div>

                      <p className="text-xs text-[var(--on-surface)] mt-1.5 font-medium leading-snug">
                        {change.description}
                      </p>

                      {/* Loss warning note if present */}
                      {change.lossWarning && (
                        <div className="mt-1.5 p-1.5 rounded bg-rose-950/40 border border-rose-800/60 text-[11px] text-rose-300">
                          <strong>Advertencia:</strong> {change.lossWarning.reason}
                        </div>
                      )}

                      {/* Mini Diff Preview */}
                      <div className="mt-2 text-[11px] font-mono bg-black/40 rounded p-1.5 border border-black/20 space-y-0.5 max-h-24 overflow-y-auto">
                        {change.originalLines.map((line, idx) => (
                          <div key={`orig-${idx}`} className="text-rose-400 truncate flex gap-1">
                            <span className="select-none text-rose-600 font-bold">-</span>
                            <span>{line || ' '}</span>
                          </div>
                        ))}
                        {change.proposedLines.map((line, idx) => (
                          <div key={`prop-${idx}`} className="text-emerald-400 truncate flex gap-1">
                            <span className="select-none text-emerald-600 font-bold">+</span>
                            <span>{line || ' '}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* List footer stats */}
            <div className="p-2 border-t border-[var(--outline)] bg-[var(--surface-container-high)] text-[11px] text-[var(--on-surface-variant)] flex items-center justify-between">
              <span>{filteredChanges.length} cambios visibles</span>
              <span>
                {currentStats.accepted} aceptados / {currentStats.rejected} rechazados
              </span>
            </div>
          </aside>

          {/* Right Panel: Monaco DiffEditor */}
          <main className="flex-1 flex flex-col min-w-0 bg-[var(--surface)] overflow-hidden">
            {/* Diff Header Bar */}
            <div className="h-8 px-3 bg-[var(--surface-container-high)] border-b border-[var(--outline)] flex items-center justify-between shrink-0 text-xs">
              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Original (Sin modificar / Protegido)</span>
                </span>
                <span className="material-symbols-outlined text-[14px] text-[var(--on-surface-variant)]">
                  arrow_forward
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Propuesta normalizada (Con cambios seleccionados)</span>
                </span>
              </div>

              <div className="text-[11px] text-[var(--on-surface-variant)] font-mono">
                Monaco DiffEditor • Git-Style Diff
              </div>
            </div>

            {/* Diff Editor Container */}
            <div className="flex-1 min-h-0 w-full relative">
              <DiffEditor
                height="100%"
                language="markdown"
                original={analysis ? analysis.originalMarkdown : originalMarkdown}
                modified={effectiveMarkdown}
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                options={{
                  readOnly: true,
                  renderSideBySide: renderSideBySide,
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
                  <div className="h-full flex items-center justify-center text-xs text-[var(--on-surface-variant)]">
                    <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                    Cargando comparador de diferencias...
                  </div>
                }
              />
            </div>
          </main>
        </div>

        {/* Modal Footer with safety confirmation & primary actions */}
        <footer className="px-4 py-3 bg-[var(--surface-container-high)] border-t border-[var(--outline)] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[18px] text-emerald-400 shrink-0">
              lock
            </span>
            <div className="text-xs text-[var(--on-surface-variant)]">
              <span className="font-semibold text-[var(--on-surface)]">
                Seguridad garantizada:
              </span>{' '}
              El archivo original nunca se sobrescribe hasta que hagas clic en{' '}
              <strong className="text-[var(--on-surface)]">“Confirmar y Aplicar”</strong>.
            </div>

            {/* Acknowledgment checkbox if accepted changes have content loss risk */}
            {currentStats.acceptedLossRisk > 0 && (
              <label className="flex items-center gap-2 text-xs bg-rose-950/60 text-rose-200 px-2.5 py-1 rounded border border-rose-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAcknowledgedRisk}
                  onChange={(e) => setHasAcknowledgedRisk(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>
                  He revisado las {currentStats.acceptedLossRisk} eliminaciones y confirmo la aplicación
                </span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Result */}
            <button
              type="button"
              onClick={handleCopyResult}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] hover:bg-[var(--surface-container-highest)] cursor-pointer transition-colors flex items-center gap-1.5"
              title="Copiar el resultado normalizado sin alterar el documento"
            >
              <span className="material-symbols-outlined text-[15px]">
                {isCopied ? 'check' : 'content_copy'}
              </span>
              <span>{isCopied ? 'Copiado' : 'Copiar resultado'}</span>
            </button>

            {/* Download File */}
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] hover:bg-[var(--surface-container-highest)] cursor-pointer transition-colors flex items-center gap-1.5"
              title="Descargar versión normalizada como archivo .md"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              <span>Descargar .md</span>
            </button>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface)] cursor-pointer transition-colors"
            >
              Cancelar
            </button>

            {/* Confirm & Apply (Primary) */}
            <button
              type="button"
              onClick={handleConfirmAndApply}
              disabled={currentStats.acceptedLossRisk > 0 && !hasAcknowledgedRisk}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm ${
                currentStats.acceptedLossRisk > 0 && !hasAcknowledgedRisk
                  ? 'bg-gray-600 text-gray-300 opacity-60 cursor-not-allowed'
                  : 'bg-[var(--primary)] text-[var(--on-primary)] hover:brightness-110 active:brightness-95'
              }`}
              title="Sobrescribir el documento con los cambios seleccionados"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>Confirmar y Aplicar</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
