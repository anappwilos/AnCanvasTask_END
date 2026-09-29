import React, { useState, useMemo } from 'react';
import { parseTasksMarkdown, ParsedGroup } from '../shapes/TaskShapeUtil';
import { validateMarkdownDocument } from '../utils/markdownSync';

export interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMarkdown: string;
  currentFileName: string;
  onImportMarkdown: (newMarkdown: string, fileName: string, mode: 'replace' | 'merge') => void;
  onExportMarkdown: (markdown: string, fileName: string, format: 'md' | 'json') => void;
}

type TabType = 'export' | 'import';

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  currentMarkdown,
  currentFileName,
  onImportMarkdown,
  onExportMarkdown,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('export');

  // Export State
  const [exportFileName, setExportFileName] = useState<string>(currentFileName || 'TASKS.md');
  const [exportFormat, setExportFormat] = useState<'md' | 'json'>('md');
  const [copiedExport, setCopiedExport] = useState(false);

  // Import State
  const [importInputText, setImportInputText] = useState<string>('');
  const [importedFileName, setImportedFileName] = useState<string>('nuevo_TASKS.md');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [importSourceType, setImportSourceType] = useState<'paste' | 'file'>('paste');

  // Stats for Current Markdown
  const currentStats = useMemo(() => {
    const groups = parseTasksMarkdown(currentMarkdown);
    const total = groups.reduce((acc, g) => acc + g.tasks.length, 0);
    return { groups: groups.length, tasks: total };
  }, [currentMarkdown]);

  // Preview for Imported Markdown
  const importPreview = useMemo(() => {
    if (!importInputText.trim()) return null;
    const groups = parseTasksMarkdown(importInputText);
    const totalTasks = groups.reduce((acc, g) => acc + g.tasks.length, 0);
    const validation = validateMarkdownDocument(importInputText);
    return {
      groupCount: groups.length,
      taskCount: totalTasks,
      groups,
      validation,
    };
  }, [importInputText]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportedFileName(file.name);
    try {
      const text = await file.text();
      if (file.name.endsWith('.json')) {
        // Handle potential JSON structure
        try {
          const json = JSON.parse(text);
          if (json.markdown) {
            setImportInputText(json.markdown);
          } else if (Array.isArray(json.sections) || Array.isArray(json.tasks)) {
            // Reconstruct markdown from JSON graph
            let reconstructed = `# ${json.projectName || 'Proyecto Importado'}\n\n`;
            if (json.sections) {
              json.sections.forEach((sec: any) => {
                reconstructed += `## ${sec.title || 'General'}\n`;
                (sec.tasks || []).forEach((t: any) => {
                  reconstructed += `- [${t.completed ? 'x' : ' '}] ${t.title || 'Sin título'}\n`;
                  if (t.id || t.taskId) reconstructed += `  id: ${t.id || t.taskId}\n`;
                  if (t.priority) reconstructed += `  priority: ${t.priority}\n`;
                  if (t.blockedBy) reconstructed += `  blockedBy: ${t.blockedBy}\n`;
                });
                reconstructed += '\n';
              });
            }
            setImportInputText(reconstructed.trim() + '\n');
          } else {
            setImportInputText(text);
          }
        } catch {
          setImportInputText(text);
        }
      } else {
        setImportInputText(text);
      }
      setImportSourceType('file');
    } catch (err) {
      console.error('Error reading file:', err);
    }
  };

  const handleExecuteImport = () => {
    if (!importInputText.trim()) return;
    onImportMarkdown(importInputText, importedFileName, importMode);
    onClose();
  };

  const handleExecuteExport = () => {
    let finalContent = currentMarkdown;
    let finalFileName = exportFileName.trim() || 'TASKS.md';

    if (exportFormat === 'json') {
      if (!finalFileName.endsWith('.json')) {
        finalFileName = finalFileName.replace(/\.(md|markdown|txt)$/i, '') + '.json';
      }
      const groups = parseTasksMarkdown(currentMarkdown);
      const jsonStructure = {
        app: 'AnTaskCanvas',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        fileName: currentFileName,
        sections: groups.map((g) => ({
          title: g.title,
          tasks: g.tasks.map((t) => ({
            id: t.taskId,
            title: t.title,
            completed: t.completed,
            priority: t.priority,
            blockedBy: t.blockedBy || null,
          })),
        })),
        markdown: currentMarkdown,
      };
      finalContent = JSON.stringify(jsonStructure, null, 2);
    } else {
      if (!finalFileName.endsWith('.md') && !finalFileName.endsWith('.markdown')) {
        finalFileName = finalFileName.replace(/\.json$/i, '') + '.md';
      }
    }

    onExportMarkdown(finalContent, finalFileName, exportFormat);
    onClose();
  };

  const handleCopyExportText = () => {
    let finalContent = currentMarkdown;
    if (exportFormat === 'json') {
      const groups = parseTasksMarkdown(currentMarkdown);
      const jsonStructure = {
        app: 'AnTaskCanvas',
        exportedAt: new Date().toISOString(),
        sections: groups,
      };
      finalContent = JSON.stringify(jsonStructure, null, 2);
    }
    navigator.clipboard.writeText(finalContent);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-export-title"
    >
      <div
        className="w-full sm:max-w-2xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-none max-h-[92vh] sm:max-h-[85vh] pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[var(--outline)] rounded-full mx-auto my-2.5 sm:hidden" />

        {/* Header with segmented switch */}
        <div className="px-5 py-3.5 border-b border-[var(--outline)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[var(--surface)] p-0.5 rounded-full border border-[var(--outline)]">
              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'export'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-xs'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                <span>Exportar</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('import')}
                className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'import'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-xs'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">file_upload</span>
                <span>Importar</span>
              </button>
            </div>
            <span id="import-export-title" className="text-xs text-[var(--on-surface-variant)] hidden sm:inline">
              Gestión de archivos TASKS.md
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-m3-icon w-8 h-8 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tab Content: Export vs Import */}
        <div className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-4 text-xs">
          {activeTab === 'export' ? (
            /* EXPORT TAB */
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-2">
                <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5 text-sm">
                  <span className="material-symbols-outlined text-[18px] text-emerald-400">save</span>
                  <span>Exportar proyecto actual</span>
                </span>
                <p className="text-[var(--on-surface-variant)] leading-relaxed">
                  Descarga tus tareas manteniendo las dependencias <code className="font-mono text-[var(--primary)]">blockedBy</code>, secciones y prioridades.
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px] font-mono text-[var(--on-surface-variant)]">
                  <span>• {currentStats.tasks} tareas</span>
                  <span>• {currentStats.groups} secciones</span>
                </div>
              </div>

              {/* Format selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--on-surface)]">Formato de exportación</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExportFormat('md')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      exportFormat === 'md'
                        ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--on-surface)]">Markdown (.md)</span>
                      <span className="material-symbols-outlined text-[16px] text-sky-400">description</span>
                    </div>
                    <span className="text-[11px] opacity-80">Formato nativo TASKS.md estándar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      exportFormat === 'json'
                        ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--on-surface)]">JSON Estructurado (.json)</span>
                      <span className="material-symbols-outlined text-[16px] text-purple-400">data_object</span>
                    </div>
                    <span className="text-[11px] opacity-80">Grafo completo y metadatos estructurados</span>
                  </button>
                </div>
              </div>

              {/* File name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--on-surface)]">Nombre del archivo</label>
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-xl px-3 py-2 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                  placeholder="TASKS.md"
                />
              </div>

              {/* Quick Preview Box */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--on-surface)]">Previsualización de contenido</label>
                  <button
                    type="button"
                    onClick={handleCopyExportText}
                    className="text-[11px] text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    <span>{copiedExport ? '¡Copiado!' : 'Copiar texto'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline)] max-h-36 overflow-auto text-[11px] font-mono leading-relaxed select-text whitespace-pre-wrap">
                  {exportFormat === 'json'
                    ? JSON.stringify(
                        {
                          app: 'AnTaskCanvas',
                          tasks: currentStats.tasks,
                          sections: currentStats.groups,
                        },
                        null,
                        2
                      )
                    : currentMarkdown.slice(0, 500) + (currentMarkdown.length > 500 ? '\n...' : '')}
                </pre>
              </div>
            </div>
          ) : (
            /* IMPORT TAB */
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-2">
                <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5 text-sm">
                  <span className="material-symbols-outlined text-[18px] text-sky-400">upload_file</span>
                  <span>Importar o cargar TASKS.md</span>
                </span>
                <p className="text-[var(--on-surface-variant)] leading-relaxed">
                  Carga un archivo local o pega el texto directamente. Se parsearán automáticamente las secciones, identificadores y dependencias.
                </p>
              </div>

              {/* Upload or Paste Choice */}
              <div className="flex items-center gap-2">
                <label className="btn-m3-secondary flex-1 py-2 text-xs cursor-pointer text-center justify-center">
                  <span className="material-symbols-outlined text-[16px]">folder_open</span>
                  <span>Seleccionar archivo (.md, .json)</span>
                  <input
                    type="file"
                    accept=".md,.markdown,.json,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Text Area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--on-surface)]">Contenido Markdown</label>
                <textarea
                  value={importInputText}
                  onChange={(e) => {
                    setImportInputText(e.target.value);
                    setImportSourceType('paste');
                  }}
                  rows={6}
                  placeholder="Pega aquí el contenido de tu archivo TASKS.md..."
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded-xl p-3 text-xs font-mono text-[var(--on-surface)] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Import Mode: Replace vs Merge */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--on-surface)]">Estrategia de importación</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      importMode === 'replace'
                        ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <span className="font-semibold text-xs text-[var(--on-surface)]">Reemplazar actual</span>
                    <span className="text-[11px] opacity-80">Sustituye todo el contenido del canvas y Kanban</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                      importMode === 'merge'
                        ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <span className="font-semibold text-xs text-[var(--on-surface)]">Combinar / Añadir</span>
                    <span className="text-[11px] opacity-80">Agrega las nuevas secciones conservando las existentes</span>
                  </button>
                </div>
              </div>

              {/* Validation & Preview Summary */}
              {importPreview && (
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-1.5">
                  <span className="font-semibold text-xs text-[var(--on-surface)] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
                    <span>Análisis previo: {importPreview.taskCount} tareas detectadas en {importPreview.groupCount} secciones</span>
                  </span>
                  {importPreview.validation.issues.length > 0 && (
                    <div className="text-[11px] text-amber-400 flex items-center gap-1">
                      <span>⚠</span>
                      <span>Se detectaron {importPreview.validation.issues.length} avisos de sintaxis en el archivo importado.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="btn-m3-text px-4 py-1.5 text-xs cursor-pointer"
          >
            Cancelar
          </button>

          {activeTab === 'export' ? (
            <button
              type="button"
              onClick={handleExecuteExport}
              className="btn-m3-primary px-5 py-1.5 text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Descargar {exportFormat.toUpperCase()}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!importInputText.trim()}
              onClick={handleExecuteImport}
              className="btn-m3-primary px-5 py-1.5 text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>{importMode === 'replace' ? 'Reemplazar y aplicar' : 'Combinar al proyecto'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
