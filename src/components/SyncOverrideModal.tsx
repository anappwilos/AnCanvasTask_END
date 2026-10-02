import React, { useState, useEffect, useCallback } from 'react';
import {
  SyncComparisonResult,
  SyncItemDiff,
  SyncDifferenceType,
  analyzeSyncDifferences,
  resolveSyncItem,
  executeBatchSync,
  formatRelativeTime,
} from '../services/syncEngineService';
import { WorkspaceStoreState } from '../services/workspaceService';
import { getSanityConfig } from '../services/sanityService';

interface SyncOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceStore: WorkspaceStoreState;
  onUpdateWorkspaceStore: (store: WorkspaceStoreState) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onOpenSanityConfig: () => void;
}

export const SyncOverrideModal: React.FC<SyncOverrideModalProps> = ({
  isOpen,
  onClose,
  workspaceStore,
  onUpdateWorkspaceStore,
  onShowToast,
  onOpenSanityConfig,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<SyncComparisonResult | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'conflicts' | 'synced'>('all');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);

  const [sanityConfig, setSanityConfig] = useState(getSanityConfig());
  const isSanityConfigured = Boolean(sanityConfig.projectId && sanityConfig.dataset);

  useEffect(() => {
    const updateConfig = () => setSanityConfig(getSanityConfig());
    updateConfig();
    window.addEventListener('antask_sanity_config_updated', updateConfig);
    return () => window.removeEventListener('antask_sanity_config_updated', updateConfig);
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      const res = await analyzeSyncDifferences(workspaceStore);
      setResult(res);
      if (res.hasPendingChanges) {
        onShowToast(`Detección completada: ${res.counts.localOverrides + res.counts.remoteOverrides + res.counts.conflicts} overrides/diferencias encontrados`, 'info');
      } else {
        onShowToast('Todo está al día y sincronizado con Sanity', 'success');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Error al analizar diferencias', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  }, [workspaceStore, onShowToast]);

  useEffect(() => {
    if (isOpen) {
      handleRunAnalysis();
    }
  }, [isOpen, handleRunAnalysis]);

  if (!isOpen) return null;

  const handleResolveSingle = async (
    item: SyncItemDiff,
    strategy: 'keep_local' | 'keep_remote' | 'merge'
  ) => {
    setResolvingItemId(item.id);
    try {
      const res = await resolveSyncItem(item, strategy, workspaceStore);
      if (res.success) {
        onShowToast(res.message, 'success');
        if (res.updatedStore) {
          onUpdateWorkspaceStore(res.updatedStore);
        }
        await handleRunAnalysis();
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Error al resolver elemento', 'error');
    } finally {
      setResolvingItemId(null);
    }
  };

  const handleBatchSyncAction = async (mode: 'smart' | 'push_all' | 'pull_all') => {
    if (!result) return;
    setIsProcessing(true);
    try {
      const res = await executeBatchSync(result.items, mode, workspaceStore);
      if (res.success) {
        onShowToast(res.message, 'success');
        onUpdateWorkspaceStore(res.updatedStore);
        await handleRunAnalysis();
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Error durante la sincronización batch', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = (result?.items || []).filter((item) => {
    if (filterType === 'pending') {
      return item.diffType !== 'synced';
    }
    if (filterType === 'conflicts') {
      return item.diffType === 'conflict' || item.diffType === 'remote_override';
    }
    if (filterType === 'synced') {
      return item.diffType === 'synced';
    }
    return true;
  });

  const getDiffBadge = (diffType: SyncDifferenceType) => {
    switch (diffType) {
      case 'synced':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800">
            Sincronizado
          </span>
        );
      case 'local_override':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-sky-950/60 text-sky-300 border border-sky-800">
            Local más reciente (Override)
          </span>
        );
      case 'remote_override':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800">
            Remoto más reciente (Override)
          </span>
        );
      case 'conflict':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-950/60 text-rose-300 border border-rose-800">
            Conflicto detectado
          </span>
        );
      case 'only_local':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950/60 text-indigo-300 border border-indigo-800">
            Solo local (Nuevo)
          </span>
        );
      case 'only_remote':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-950/60 text-purple-300 border border-purple-800">
            Solo remoto (Por descargar)
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-2 sm:p-4 bg-black/75 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-[var(--surface-container)] border border-[var(--outline)] rounded-lg shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--outline)] bg-[var(--surface)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-rose-600 flex items-center justify-center text-white font-bold text-xs shadow-xs shrink-0">
              S
            </div>
            <div>
              <h2 id="sync-modal-title" className="text-sm font-semibold text-[var(--on-surface)] flex items-center gap-2">
                <span>Sincronización & Detección de Overrides</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] border border-[var(--outline)]">
                  Sanity Cloud
                </span>
              </h2>
              <p className="text-[11px] text-[var(--on-surface-variant)]">
                Dataset: <span className="font-mono text-[var(--on-surface)]">{sanityConfig.dataset || 'production'}</span> • Proyecto: <span className="font-mono text-[var(--on-surface)]">{sanityConfig.projectId || 'No conectado'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isSanityConfigured && (
              <button
                type="button"
                onClick={onOpenSanityConfig}
                className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer text-amber-300"
              >
                Configurar Credenciales
              </button>
            )}
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || isProcessing}
              className="btn-m3-secondary px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Volver a analizar diferencias entre Local y Sanity"
            >
              <span className={`material-symbols-outlined text-[15px] ${isAnalyzing ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{isAnalyzing ? 'Analizando...' : 'Re-analizar'}</span>
            </button>
            <button type="button" onClick={onClose} className="btn-m3-icon w-7 h-7 cursor-pointer">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>

        {/* Status Summary & Quick Batch Actions */}
        <div className="px-4 py-3 bg-[var(--surface-container-low)] border-b border-[var(--outline)] flex flex-col gap-3">
          {/* Stat Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
            <div className="p-2 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col">
              <span className="text-[10px] text-[var(--on-surface-variant)]">Total Analizados</span>
              <span className="text-base font-semibold font-mono text-[var(--on-surface)]">
                {result?.counts.total || 0}
              </span>
            </div>

            <div className="p-2 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col">
              <span className="text-[10px] text-emerald-400">Sincronizados</span>
              <span className="text-base font-semibold font-mono text-emerald-400">
                {result?.counts.synced || 0}
              </span>
            </div>

            <div className="p-2 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col">
              <span className="text-[10px] text-sky-400">Local Overrides</span>
              <span className="text-base font-semibold font-mono text-sky-400">
                {result?.counts.localOverrides || 0}
              </span>
            </div>

            <div className="p-2 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col">
              <span className="text-[10px] text-amber-400">Remote Overrides</span>
              <span className="text-base font-semibold font-mono text-amber-400">
                {result?.counts.remoteOverrides || 0}
              </span>
            </div>

            <div className="p-2 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col">
              <span className="text-[10px] text-rose-400">Conflictos</span>
              <span className="text-base font-semibold font-mono text-rose-400">
                {result?.counts.conflicts || 0}
              </span>
            </div>

            <div className="p-2 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col">
              <span className="text-[10px] text-purple-400">Nuevos/Únicos</span>
              <span className="text-base font-semibold font-mono text-purple-400">
                {(result?.counts.onlyLocal || 0) + (result?.counts.onlyRemote || 0)}
              </span>
            </div>
          </div>

          {/* Batch Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-[var(--surface)] p-0.5 rounded border border-[var(--outline)] text-xs overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-medium'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                Todos ({result?.items.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('pending')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  filterType === 'pending'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-medium'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                Con Diferencias ({(result?.counts.total || 0) - (result?.counts.synced || 0)})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('conflicts')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  filterType === 'conflicts'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-medium'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                Conflictos & Remoto ({(result?.counts.conflicts || 0) + (result?.counts.remoteOverrides || 0)})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('synced')}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  filterType === 'synced'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] font-medium'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                Al Día ({result?.counts.synced || 0})
              </button>
            </div>

            {/* Batch execution buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isProcessing || !result?.hasPendingChanges || !isSanityConfigured}
                onClick={() => handleBatchSyncAction('smart')}
                className="btn-m3-primary px-3 py-1 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-xs"
                title="Resuelve automáticamente aplicando los cambios más recientes en ambas direcciones"
              >
                <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
                <span>Sincronización Inteligente</span>
              </button>

              <button
                type="button"
                disabled={isProcessing || !result?.hasPendingChanges || !isSanityConfigured}
                onClick={() => handleBatchSyncAction('push_all')}
                className="btn-m3-secondary px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                title="Sobrescribe Sanity con el estado local de todos los workspaces"
              >
                <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                <span>Subir Todo (Override Remoto)</span>
              </button>

              <button
                type="button"
                disabled={isProcessing || !result?.hasPendingChanges || !isSanityConfigured}
                onClick={() => handleBatchSyncAction('pull_all')}
                className="btn-m3-secondary px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                title="Sobrescribe el estado local con los datos almacenados en Sanity"
              >
                <span className="material-symbols-outlined text-[14px]">cloud_download</span>
                <span>Descargar Todo (Override Local)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Diff List */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-[var(--on-surface-variant)] flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
              <p className="text-sm font-medium text-[var(--on-surface)]">
                {filterType === 'pending'
                  ? 'No hay diferencias pendientes en esta vista'
                  : 'Todos los elementos analizados están en sincronía'}
              </p>
              <p className="text-xs">
                Los workspaces y tareas coinciden exactamente entre el almacenamiento local y Sanity Cloud.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isExpanded = expandedItemId === item.id;
              const isResolving = resolvingItemId === item.id;

              return (
                <div
                  key={item.id}
                  className={`border rounded-lg transition-all overflow-hidden ${
                    item.diffType === 'conflict'
                      ? 'border-rose-800/60 bg-rose-950/10'
                      : item.diffType === 'remote_override'
                      ? 'border-amber-800/60 bg-amber-950/10'
                      : item.diffType === 'local_override'
                      ? 'border-sky-800/60 bg-sky-950/10'
                      : 'border-[var(--outline)] bg-[var(--surface)]'
                  }`}
                >
                  {/* Item Row Header */}
                  <div className="p-3 flex items-start justify-between gap-3">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--on-surface)] font-sans truncate">
                          {item.title}
                        </span>
                        {getDiffBadge(item.diffType)}
                      </div>

                      {item.subtitle && (
                        <p className="text-xs text-[var(--on-surface-variant)] font-mono mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      )}

                      {/* Timestamps comparison */}
                      <div className="flex items-center gap-4 text-[11px] font-mono text-[var(--on-surface-variant)] mt-1.5">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-sky-400">laptop</span>
                          <span>Local: {formatRelativeTime(item.localTimestamp)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-rose-400">cloud</span>
                          <span>Remoto: {formatRelativeTime(item.remoteTimestamp)}</span>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.diffType !== 'synced' && (
                        <>
                          <button
                            type="button"
                            disabled={isResolving || !isSanityConfigured}
                            onClick={() => handleResolveSingle(item, 'keep_local')}
                            className="btn-m3-secondary px-2 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            title="Sobrescribir versión remota en Sanity con la versión local"
                          >
                            <span className="material-symbols-outlined text-[13px]">cloud_upload</span>
                            <span>Subir Local</span>
                          </button>

                          <button
                            type="button"
                            disabled={isResolving || !isSanityConfigured || !item.remoteData}
                            onClick={() => handleResolveSingle(item, 'keep_remote')}
                            className="btn-m3-secondary px-2 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            title="Sobrescribir versión local con los datos de Sanity"
                          >
                            <span className="material-symbols-outlined text-[13px]">cloud_download</span>
                            <span>Bajar Remoto</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className="btn-m3-icon w-7 h-7 cursor-pointer"
                        title={isExpanded ? 'Ocultar detalles de diferencias' : 'Ver detalle de cambios'}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded Diff Viewer */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-[var(--outline)] bg-[var(--surface-container-high)]/40 flex flex-col gap-2 animate-fade-in text-xs">
                      <div className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-amber-400">difference</span>
                        <span>Cambios detectados y discrepancias:</span>
                      </div>

                      <ul className="list-disc list-inside space-y-1 text-[var(--on-surface)] pl-1">
                        {item.summaryChanges.map((change, idx) => (
                          <li key={idx} className="font-mono text-[11px] text-[var(--on-surface)]">
                            {change}
                          </li>
                        ))}
                      </ul>

                      {/* Side by side preview */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-[var(--outline)]">
                        {/* Local side */}
                        <div className="p-2 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col">
                          <span className="font-semibold text-sky-400 text-[11px] mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">laptop</span>
                            <span>Versión Local</span>
                          </span>
                          {item.localData ? (
                            <pre className="text-[10px] font-mono text-[var(--on-surface)] overflow-x-auto p-1.5 bg-[var(--surface-container)] rounded max-h-32">
                              {JSON.stringify(
                                {
                                  name: item.localData.name || item.localData.title,
                                  branch: item.localData.activeBranchName || item.localData.groupTitle,
                                  branchesCount: item.localData.branches?.length,
                                  updatedAt: item.localData.updatedAt,
                                },
                                null,
                                2
                              )}
                            </pre>
                          ) : (
                            <span className="text-[11px] text-[var(--on-surface-variant)] italic">
                              No existe en almacenamiento local
                            </span>
                          )}
                        </div>

                        {/* Remote side */}
                        <div className="p-2 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col">
                          <span className="font-semibold text-rose-400 text-[11px] mb-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">cloud</span>
                            <span>Versión Sanity Remote</span>
                          </span>
                          {item.remoteData ? (
                            <pre className="text-[10px] font-mono text-[var(--on-surface)] overflow-x-auto p-1.5 bg-[var(--surface-container)] rounded max-h-32">
                              {JSON.stringify(
                                {
                                  _id: item.remoteData._id,
                                  _type: item.remoteData._type,
                                  name: item.remoteData.name || item.remoteData.title,
                                  branch: item.remoteData.activeBranchName || item.remoteData.groupTitle,
                                  branchesCount: item.remoteData.branches?.length,
                                  updatedAt: item.remoteData.updatedAt || item.remoteData._updatedAt,
                                },
                                null,
                                2
                              )}
                            </pre>
                          ) : (
                            <span className="text-[11px] text-[var(--on-surface-variant)] italic">
                              No existe aún en Sanity Cloud
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--on-surface-variant)]">
            {result?.hasPendingChanges
              ? 'Existen diferencias que puedes resolver individualmente o con Sincronización Inteligente.'
              : 'Todo sincronizado y al día.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="btn-m3-secondary px-3.5 py-1 text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
