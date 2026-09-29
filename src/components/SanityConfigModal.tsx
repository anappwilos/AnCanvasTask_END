import React, { useState, useEffect } from 'react';
import {
  getSanityConfig,
  saveSanityConfig,
  clearSanityConfig,
  testSanityConnection,
  SanityConfig,
  SanityConnectionTestResult,
} from '../services/sanityService';

export interface SanityConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: (config: SanityConfig) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const SanityConfigModal: React.FC<SanityConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onShowToast,
}) => {
  const [projectId, setProjectId] = useState<string>('');
  const [dataset, setDataset] = useState<string>('production');
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);

  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<SanityConnectionTestResult | null>(null);
  const [copiedOrigin, setCopiedOrigin] = useState<boolean>(false);

  // Sync state with current saved config when modal opens
  useEffect(() => {
    if (isOpen) {
      const current = getSanityConfig();
      setProjectId(current.projectId || '');
      setDataset(current.dataset || 'production');
      setToken(current.token || '');
      setTestResult(null);
      setIsTesting(false);
      setShowToken(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!projectId.trim()) {
      setTestResult({
        ok: false,
        mode: 'failed',
        message: 'Falta el Project ID',
        details: 'Por favor introduce el Project ID de tu proyecto en Sanity.',
      });
      return;
    }

    if (!dataset.trim()) {
      setTestResult({
        ok: false,
        mode: 'failed',
        message: 'Falta el Dataset',
        details: 'Por favor introduce el nombre del dataset (normalmente "production").',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await testSanityConnection({
        projectId: projectId.trim(),
        dataset: dataset.trim(),
        token: token.trim() || undefined,
      });
      setTestResult(res);
      if (res.ok) {
        onShowToast(res.message, 'success');
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        mode: 'failed',
        message: 'Error inesperado durante la verificación',
        details: err?.message || String(err),
      });
      onShowToast('Error al verificar conexión con Sanity', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveSanityConfig({
      projectId: projectId.trim(),
      dataset: dataset.trim(),
      token: token.trim(),
    });
    onConfigSaved(updated);
    onShowToast('Configuración de Sanity guardada y aplicada', 'success');
    onClose();
  };

  const handleDisconnect = () => {
    const cleared = clearSanityConfig();
    setProjectId('');
    setDataset('production');
    setToken('');
    setTestResult(null);
    onConfigSaved(cleared);
    onShowToast('Conexión con Sanity eliminada. Operando en modo local.', 'info');
    onClose();
  };

  const handleCopyOrigin = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2000);
      onShowToast('Origen copiado al portapapeles', 'info');
    }
  };

  const hasConfig = Boolean(projectId.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sanity-config-dialog-title"
    >
      <div
        className="w-full sm:max-w-lg bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-lg sm:rounded-lg shadow-xl flex flex-col overflow-hidden animate-slide-up sm:animate-none max-h-[90vh] pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[var(--outline)] rounded mx-auto my-2 sm:hidden" />

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[var(--outline)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-sky-950/80 border border-sky-600/50 flex items-center justify-center text-sky-400">
              <span className="material-symbols-outlined text-[17px]">cloud_sync</span>
            </div>
            <div>
              <h2 id="sanity-config-dialog-title" className="text-sm font-semibold text-[var(--on-surface)]">
                Persistencia Visual (Sanity)
              </h2>
              <p className="text-[11px] text-[var(--on-surface-variant)]">
                Sincronización remota de coordenadas espaciales del lienzo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-m3-icon w-7 h-7 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Concept Banner */}
          <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface-variant)] leading-relaxed flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[16px] text-sky-400 shrink-0 mt-0.5">info</span>
            <div>
              <strong className="text-[var(--on-surface)] font-medium">Single Source of Truth: </strong>
              Tu archivo <code className="font-mono text-sky-300">TASKS.md</code> almacena títulos, estados, prioridades y dependencias. Sanity almacena únicamente la geometría visual <code className="font-mono text-slate-300">(x, y, w, h)</code> para no duplicar datos.
            </div>
          </div>

          {/* Form */}
          <form id="sanity-config-form" onSubmit={handleSave} className="flex flex-col gap-3">
            {/* Project ID */}
            <div className="flex flex-col gap-1">
              <label htmlFor="sanity-project-id" className="font-medium text-[var(--on-surface)] flex items-center justify-between">
                <span>Project ID <span className="text-rose-400">*</span></span>
                <span className="text-[10px] text-[var(--on-surface-variant)] font-normal">manage.sanity.io</span>
              </label>
              <input
                id="sanity-project-id"
                type="text"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setTestResult(null);
                }}
                placeholder="ej. a1b2c3d4"
                required
                className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-3 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
              />
            </div>

            {/* Dataset */}
            <div className="flex flex-col gap-1">
              <label htmlFor="sanity-dataset" className="font-medium text-[var(--on-surface)] flex items-center justify-between">
                <span>Dataset <span className="text-rose-400">*</span></span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDataset('production');
                      setTestResult(null);
                    }}
                    className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                  >
                    production
                  </button>
                  <span className="text-[10px] text-[var(--on-surface-variant)]">·</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDataset('staging');
                      setTestResult(null);
                    }}
                    className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                  >
                    staging
                  </button>
                </div>
              </label>
              <input
                id="sanity-dataset"
                type="text"
                value={dataset}
                onChange={(e) => {
                  setDataset(e.target.value);
                  setTestResult(null);
                }}
                placeholder="production"
                required
                className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-3 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
              />
            </div>

            {/* API Token */}
            <div className="flex flex-col gap-1">
              <label htmlFor="sanity-token" className="font-medium text-[var(--on-surface)] flex items-center justify-between">
                <span>API Token <span className="text-[10px] text-[var(--on-surface-variant)] font-normal">(Requerido para guardar cambios)</span></span>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-[10px] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">{showToken ? 'visibility_off' : 'visibility'}</span>
                  <span>{showToken ? 'Ocultar' : 'Mostrar'}</span>
                </button>
              </label>
              <input
                id="sanity-token"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setTestResult(null);
                }}
                placeholder="sk..."
                className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-3 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
              />
              <span className="text-[10px] text-[var(--on-surface-variant)]">
                Crea un token con rol <code className="font-mono text-slate-300">Editor</code> en <span className="font-mono">manage.sanity.io &gt; API &gt; Tokens</span>.
              </span>
            </div>
          </form>

          {/* Test Connection Button & Status Box */}
          <div className="pt-1 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[var(--on-surface)] text-xs">Comprobación de conectividad</span>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !projectId.trim() || !dataset.trim()}
                className="btn-m3-secondary px-3 py-1.5 text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sky-400 border-sky-800/60 hover:bg-sky-950/40"
              >
                {isTesting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[15px]">network_check</span>
                    <span>Probar conexión</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Result Display */}
            {testResult && (
              <div
                className={`p-3 rounded border flex flex-col gap-1.5 transition-all text-xs ${
                  testResult.ok
                    ? testResult.mode === 'authenticated'
                      ? 'bg-emerald-950/30 border-emerald-800/70 text-emerald-300'
                      : 'bg-sky-950/30 border-sky-800/70 text-sky-300'
                    : 'bg-rose-950/30 border-rose-800/70 text-rose-300'
                }`}
                role="status"
              >
                <div className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">
                      {testResult.ok ? 'check_circle' : 'error'}
                    </span>
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.latencyMs !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current opacity-80">
                      {testResult.latencyMs} ms
                    </span>
                  )}
                </div>

                {testResult.details && (
                  <p className="text-[11px] leading-relaxed opacity-90 pl-5">
                    {testResult.details}
                  </p>
                )}

                {/* CORS Help Box if failed or warning */}
                {!testResult.ok && (
                  <div className="mt-1 pt-2 border-t border-rose-900/40 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-300 truncate">Origen CORS de la app:</span>
                    <button
                      type="button"
                      onClick={handleCopyOrigin}
                      className="px-2 py-0.5 rounded bg-black/40 border border-[var(--outline)] hover:border-sky-500 text-sky-300 font-mono text-[10px] flex items-center gap-1 cursor-pointer shrink-0"
                      title="Copiar origen para añadir a Sanity CORS"
                    >
                      <span className="material-symbols-outlined text-[12px]">content_copy</span>
                      <span>{copiedOrigin ? '¡Copiado!' : 'Copiar URL de Origen'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-between shrink-0">
          <div>
            {hasConfig && (
              <button
                type="button"
                onClick={handleDisconnect}
                className="btn-m3-text text-rose-400 hover:text-rose-300 px-2 py-1 text-xs cursor-pointer"
              >
                Desconectar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-m3-text px-3.5 py-1 text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="sanity-config-form"
              className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm"
            >
              Guardar y sincronizar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
