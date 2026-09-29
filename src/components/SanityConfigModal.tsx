import React, { useState, useEffect } from 'react';
import {
  getSanityConfig,
  saveSanityConfig,
  clearSanityConfig,
  testSanityConnection,
  writeTestingTaskToSanity,
  deleteDocumentFromSanity,
  fetchSanityDocumentsList,
  SanityConfig,
  SanityConnectionTestResult,
  SanityWriteTestResult,
} from '../services/sanityService';

export interface SanityConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: (config: SanityConfig) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

type ModalTab = 'config' | 'write-test' | 'schemas';

export const SanityConfigModal: React.FC<SanityConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('config');

  // Config fields
  const [projectId, setProjectId] = useState<string>('');
  const [dataset, setDataset] = useState<string>('production');
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);

  // Connection test state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<SanityConnectionTestResult | null>(null);
  const [copiedOrigin, setCopiedOrigin] = useState<boolean>(false);

  // Write test state
  const [isWritingTest, setIsWritingTest] = useState<boolean>(false);
  const [writeTestResult, setWriteTestResult] = useState<SanityWriteTestResult | null>(null);
  const [isDeletingTestDoc, setIsDeletingTestDoc] = useState<boolean>(false);

  // Document explorer state
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [remoteDocs, setRemoteDocs] = useState<Array<{ _id: string; _type: string; title?: string; taskId?: string; projectId?: string; _updatedAt?: string }>>([]);

  // Schemas viewer state
  const [selectedSchema, setSelectedSchema] = useState<'task' | 'canvasVisualState' | 'index'>('task');
  const [copiedSchema, setCopiedSchema] = useState<boolean>(false);

  // Sync state with current saved config when modal opens
  useEffect(() => {
    if (isOpen) {
      const current = getSanityConfig();
      setProjectId(current.projectId || '');
      setDataset(current.dataset || 'production');
      setToken(current.token || '');
      setTestResult(null);
      setWriteTestResult(null);
      setIsTesting(false);
      setShowToken(false);
      setRemoteDocs([]);
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

  const handleExecuteWriteTest = async () => {
    if (!projectId.trim() || !dataset.trim()) {
      onShowToast('Configura primero el Project ID y Dataset', 'warning');
      setActiveTab('config');
      return;
    }

    if (!token.trim()) {
      onShowToast('Se requiere un API Token con permisos de Editor para escribir datos', 'warning');
      setActiveTab('config');
      return;
    }

    setIsWritingTest(true);
    setWriteTestResult(null);

    try {
      const res = await writeTestingTaskToSanity({
        projectId: projectId.trim(),
        dataset: dataset.trim(),
        token: token.trim(),
      });
      setWriteTestResult(res);
      if (res.ok) {
        onShowToast(`Tarea de prueba escrita con éxito en ${res.dataset}`, 'success');
        handleFetchRemoteDocs();
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      setWriteTestResult({
        ok: false,
        action: 'failed',
        message: 'Error al ejecutar prueba de escritura',
        details: err?.message || String(err),
      });
      onShowToast('Fallo al escribir en Sanity', 'error');
    } finally {
      setIsWritingTest(false);
    }
  };

  const handleDeleteTestDoc = async (docId: string) => {
    setIsDeletingTestDoc(true);
    try {
      const res = await deleteDocumentFromSanity(docId, {
        projectId: projectId.trim(),
        dataset: dataset.trim(),
        token: token.trim(),
      });
      if (res.ok) {
        onShowToast(res.message, 'success');
        setWriteTestResult(null);
        handleFetchRemoteDocs();
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err) {
      onShowToast('Error al eliminar documento de prueba', 'error');
    } finally {
      setIsDeletingTestDoc(false);
    }
  };

  const handleFetchRemoteDocs = async () => {
    if (!projectId.trim() || !dataset.trim()) return;
    setIsLoadingDocs(true);
    try {
      const docs = await fetchSanityDocumentsList({
        projectId: projectId.trim(),
        dataset: dataset.trim(),
        token: token.trim() || undefined,
      });
      setRemoteDocs(docs);
    } catch (err) {
      console.warn('Could not fetch remote docs:', err);
    } finally {
      setIsLoadingDocs(false);
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
    setWriteTestResult(null);
    setRemoteDocs([]);
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

  const schemaCodeMap = {
    task: `// schemas/task.ts
export const taskSchema = {
  name: 'task',
  title: 'Task',
  type: 'document',
  fields: [
    { name: 'taskId', title: 'Task ID', type: 'string', validation: (Rule) => Rule.required() },
    { name: 'title', title: 'Título', type: 'string', validation: (Rule) => Rule.required() },
    { name: 'completed', title: 'Completada', type: 'boolean', initialValue: false },
    {
      name: 'status',
      title: 'Estado Kanban',
      type: 'string',
      options: {
        list: [
          { title: 'Por hacer (Todo)', value: 'todo' },
          { title: 'En progreso (In Progress)', value: 'in_progress' },
          { title: 'Bloqueada (Blocked)', value: 'blocked' },
          { title: 'Completada (Done)', value: 'done' },
        ],
      },
      initialValue: 'todo',
    },
    {
      name: 'priority',
      title: 'Prioridad',
      type: 'string',
      options: { list: ['P0', 'P1', 'P2', 'P3'] },
      initialValue: 'P1',
    },
    { name: 'groupTitle', title: 'Sección / Grupo', type: 'string', initialValue: 'General' },
    { name: 'blockedBy', title: 'Bloqueada Por (Task ID)', type: 'string' },
    { name: 'tags', title: 'Etiquetas (#tags)', type: 'array', of: [{ type: 'string' }] },
    {
      name: 'subtasks',
      title: 'Subtareas (Checklist)',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', title: 'Título', type: 'string' },
            { name: 'completed', title: 'Completada', type: 'boolean' },
          ],
        },
      ],
    },
    { name: 'description', title: 'Notas / Descripción', type: 'text' },
    { name: 'updatedAt', title: 'Última actualización', type: 'datetime' },
  ],
};`,
    canvasVisualState: `// schemas/canvasVisualState.ts
export const canvasVisualStateSchema = {
  name: 'canvasVisualState',
  title: 'Canvas Visual State',
  type: 'document',
  fields: [
    { name: 'projectId', title: 'Project ID', type: 'string', validation: (Rule) => Rule.required() },
    {
      name: 'tasks',
      title: 'Coordenadas de Tareas',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'taskId', title: 'Task ID', type: 'string' },
            { name: 'x', title: 'X', type: 'number' },
            { name: 'y', title: 'Y', type: 'number' },
            { name: 'width', title: 'Width', type: 'number' },
            { name: 'height', title: 'Height', type: 'number' },
          ],
        },
      ],
    },
    {
      name: 'groups',
      title: 'Coordenadas de Grupos',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'groupTitle', title: 'Título', type: 'string' },
            { name: 'x', title: 'X', type: 'number' },
            { name: 'y', title: 'Y', type: 'number' },
            { name: 'width', title: 'Width', type: 'number' },
            { name: 'height', title: 'Height', type: 'number' },
            { name: 'isCollapsed', title: 'Colapsado', type: 'boolean' },
          ],
        },
      ],
    },
    { name: 'updatedAt', title: 'Última actualización', type: 'datetime' },
  ],
};`,
    index: `// schemas/index.ts
import { taskSchema } from './task';
import { canvasVisualStateSchema } from './canvasVisualState';

export const schemaTypes = [taskSchema, canvasVisualStateSchema];`,
  };

  const handleCopySchema = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
    onShowToast('Código de Schema copiado al portapapeles', 'info');
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
        className="w-full sm:max-w-xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-lg sm:rounded-lg shadow-xl flex flex-col overflow-hidden animate-slide-up sm:animate-none max-h-[92vh] sm:max-h-[85vh] pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[var(--outline)] rounded mx-auto my-2 sm:hidden" />

        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-[var(--outline)] flex items-center justify-between shrink-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-sky-950/80 border border-sky-600/50 flex items-center justify-center text-sky-400">
              <span className="material-symbols-outlined text-[17px]">cloud_sync</span>
            </div>
            <div>
              <h2 id="sanity-config-dialog-title" className="text-sm font-semibold text-[var(--on-surface)]">
                Integración & Persistencia Sanity
              </h2>
              <p className="text-[11px] text-[var(--on-surface-variant)]">
                Dataset: <span className="font-mono text-sky-400 font-semibold">{dataset || 'production'}</span> · Project: <span className="font-mono">{projectId || 'no configurado'}</span>
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

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--outline)] bg-[var(--surface)] px-4 gap-2 shrink-0">
          {[
            { id: 'config' as ModalTab, label: 'Configuración & Conexión', icon: 'settings' },
            { id: 'write-test' as ModalTab, label: 'Verificar Escritura en Vivo', icon: 'edit_note' },
            { id: 'schemas' as ModalTab, label: 'Esquemas (Schemas)', icon: 'schema' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'write-test' && remoteDocs.length === 0 && projectId && dataset) {
                    handleFetchRemoteDocs();
                  }
                }}
                className={`py-2 px-2.5 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[var(--primary)] text-[var(--primary)] font-semibold'
                    : 'border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
          {/* TAB 1: CONFIGURATION & CONNECTION */}
          {activeTab === 'config' && (
            <>
              {/* Concept Banner */}
              <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface-variant)] leading-relaxed flex items-start gap-2">
                <span className="material-symbols-outlined text-[15px] text-sky-400 shrink-0 mt-0.5">info</span>
                <div>
                  <strong className="text-[var(--on-surface)] font-medium">Single Source of Truth: </strong>
                  Tu archivo <code className="font-mono text-sky-300">TASKS.md</code> define el contenido y dependencias. Sanity almacena la posición espacial <code className="font-mono text-slate-300">(x, y, w, h)</code> y documentos de tareas.
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
                    <span>API Token <span className="text-[10px] text-[var(--on-surface-variant)] font-normal">(Requerido para escribir en producción)</span></span>
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
            </>
          )}

          {/* TAB 2: LIVE WRITE TEST (VERIFY WRITING IN PRODUCTION & CREATE TEST TASK SCHEMA) */}
          {activeTab === 'write-test' && (
            <div className="flex flex-col gap-3.5">
              <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded bg-emerald-400" />
                    <span className="font-semibold text-xs text-[var(--on-surface)]">
                      Prueba de Escritura en Sanity Dataset ({dataset})
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--on-surface-variant)]">
                    Type: <code className="text-sky-300">task</code>
                  </span>
                </div>
                <p className="text-[11px] text-[var(--on-surface-variant)] leading-relaxed">
                  Esta acción enviará una mutación real de tipo <strong className="text-[var(--on-surface)]">task</strong> a tu dataset de Sanity y comprobará inmediatamente la lectura del documento creado (Read-After-Write).
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExecuteWriteTest}
                    disabled={isWritingTest || !projectId.trim() || !dataset.trim() || !token.trim()}
                    className="btn-m3-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isWritingTest ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Escribiendo en {dataset}...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[15px]">send_and_archive</span>
                        <span>Crear y verificar primer Task en "{dataset}"</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleFetchRemoteDocs}
                    disabled={isLoadingDocs || !projectId.trim() || !dataset.trim()}
                    className="btn-m3-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-[15px] ${isLoadingDocs ? 'animate-spin' : ''}`}>
                      refresh
                    </span>
                    <span>Actualizar lista</span>
                  </button>
                </div>
              </div>

              {/* Write Test Result Card */}
              {writeTestResult && (
                <div
                  className={`p-3 rounded border flex flex-col gap-2 transition-all text-xs ${
                    writeTestResult.ok
                      ? 'bg-emerald-950/30 border-emerald-800/70 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/70 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="material-symbols-outlined text-[16px]">
                        {writeTestResult.ok ? 'task_alt' : 'error'}
                      </span>
                      <span>{writeTestResult.message}</span>
                    </div>
                    {writeTestResult.latencyMs !== undefined && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current">
                        {writeTestResult.latencyMs} ms
                      </span>
                    )}
                  </div>

                  {writeTestResult.details && (
                    <p className="text-[11px] opacity-90 pl-5 leading-relaxed">
                      {writeTestResult.details}
                    </p>
                  )}

                  {/* Document JSON Preview */}
                  {writeTestResult.document && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="flex items-center justify-between text-[11px] text-[var(--on-surface-variant)]">
                        <span>Payload persistido en Sanity:</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTestDoc(writeTestResult.document._id)}
                          disabled={isDeletingTestDoc}
                          className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">delete</span>
                          <span>{isDeletingTestDoc ? 'Eliminando...' : 'Eliminar documento de prueba'}</span>
                        </button>
                      </div>
                      <pre className="p-2.5 rounded bg-black/50 border border-[var(--outline)] font-mono text-[10px] text-emerald-200 overflow-x-auto max-h-40 leading-relaxed whitespace-pre-wrap select-text">
                        {JSON.stringify(writeTestResult.document, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Remote Documents Explorer */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[var(--on-surface)]">
                    Documentos existentes en Sanity ({remoteDocs.length})
                  </span>
                  <span className="text-[10px] text-[var(--on-surface-variant)]">Dataset: {dataset}</span>
                </div>

                {remoteDocs.length === 0 ? (
                  <div className="p-3 rounded bg-[var(--surface)] border border-[var(--outline)] text-center text-[var(--on-surface-variant)] text-[11px]">
                    {isLoadingDocs ? 'Cargando documentos de Sanity...' : 'No se han listado documentos aún. Pulsa "Actualizar lista" o crea el primer task.'}
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--outline)] rounded border border-[var(--outline)] bg-[var(--surface)] max-h-48 overflow-y-auto">
                    {remoteDocs.map((doc) => (
                      <div key={doc._id} className="p-2 px-2.5 flex items-center justify-between gap-2 text-xs hover:bg-[var(--surface-container-high)]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`material-symbols-outlined text-[15px] shrink-0 ${doc._type === 'task' ? 'text-sky-400' : 'text-purple-400'}`}>
                            {doc._type === 'task' ? 'check_box' : 'grid_view'}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-[var(--on-surface)] truncate">
                              {doc.title || doc.projectId || doc._id}
                            </span>
                            <span className="text-[10px] font-mono text-[var(--on-surface-variant)] truncate">
                              _id: {doc._id} · tipo: {doc._type}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-[var(--on-surface-variant)] shrink-0">
                          {doc._updatedAt ? new Date(doc._updatedAt).toLocaleTimeString() : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SANITY SCHEMAS (STUDIO COMPATIBILITY) */}
          {activeTab === 'schemas' && (
            <div className="flex flex-col gap-3">
              <div className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] text-[11px] text-[var(--on-surface-variant)] leading-relaxed">
                Archivos de esquema listos para incluir en tu proyecto de <strong className="text-[var(--on-surface)]">Sanity Studio</strong> (<code className="font-mono text-sky-300">src/sanity/schemas/</code>).
              </div>

              {/* Schema selector buttons */}
              <div className="flex items-center gap-1 border-b border-[var(--outline)] pb-2">
                {[
                  { id: 'task' as const, label: 'task.ts (Documento de Tarea)' },
                  { id: 'canvasVisualState' as const, label: 'canvasVisualState.ts (Canvas)' },
                  { id: 'index' as const, label: 'index.ts' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSchema(s.id)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                      selectedSchema === s.id
                        ? 'bg-[var(--primary)] text-[var(--on-primary)] font-semibold'
                        : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Code viewer */}
              <div className="relative rounded bg-black/60 border border-[var(--outline)] overflow-hidden">
                <div className="px-3 py-1.5 bg-[var(--surface)] border-b border-[var(--outline)] flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[var(--on-surface-variant)]">{selectedSchema}.ts</span>
                  <button
                    type="button"
                    onClick={() => handleCopySchema(schemaCodeMap[selectedSchema])}
                    className="text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    <span>{copiedSchema ? '¡Copiado!' : 'Copiar código'}</span>
                  </button>
                </div>

                <pre className="p-3 text-[11px] font-mono text-slate-200 overflow-auto max-h-64 leading-relaxed whitespace-pre select-text">
                  {schemaCodeMap[selectedSchema]}
                </pre>
              </div>
            </div>
          )}
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
              Cerrar
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
