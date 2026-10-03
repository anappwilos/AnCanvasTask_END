import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import { formatTaskCount, formatSectionCount } from '../i18n';
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
  const { _ } = useLingui();
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
      id="modal-import-export-overlay"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-export-title"
    >
      <div
        id="modal-import-export-dialog"
        className="w-full sm:max-w-2xl bg-[var(--surface-container)] border-t sm:border border-[var(--outline)] rounded-t-lg sm:rounded-lg shadow-xl flex flex-col overflow-hidden animate-slide-up sm:animate-none max-h-[92vh] sm:max-h-[85vh] pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="div-importexportmodal-1" className="w-10 h-1 bg-[var(--outline)] rounded mx-auto my-2 sm:hidden" />

        {/* Header with segmented switch */}
        <div id="div-importexportmodal-2" className="px-5 py-3 border-b border-[var(--outline)] flex items-center justify-between">
          <div id="div-importexportmodal-3" className="flex items-center gap-3">
            <div id="div-importexportmodal-4" className="flex items-center bg-[var(--surface)] p-0.5 rounded border border-[var(--outline)]">
              <button
                id="btn-import-export-tab-export"
                type="button"
                onClick={() => setActiveTab('export')}
                className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'export'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">file_download</span>
                <span>{_(msg`Exportar`)}</span>
              </button>

              <button
                id="btn-import-export-tab-import"
                type="button"
                onClick={() => setActiveTab('import')}
                className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeTab === 'import'
                    ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                    : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">file_upload</span>
                <span>{_(msg`Importar`)}</span>
              </button>
            </div>
            <span id="import-export-title" className="text-xs text-[var(--on-surface-variant)] hidden sm:inline">
              {_(msg`Gestión de archivos TASKS.md`)}
            </span>
          </div>

          <button
            id="btn-import-export-close-header"
            type="button"
            onClick={onClose}
            className="btn-m3-icon w-7 h-7 cursor-pointer"
            aria-label={_(msg`Cerrar modal`)}
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Tab Content: Export vs Import */}
        <div id="div-importexportmodal-5" className="p-4 sm:p-5 overflow-y-auto flex flex-col gap-3.5 text-xs">
          {activeTab === 'export' ? (
            /* EXPORT TAB */
            <div id="div-importexportmodal-6" className="flex flex-col gap-3.5">
              <div id="div-importexportmodal-7" className="p-3 rounded-md bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-1.5">
                <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5 text-xs">
                  <span className="material-symbols-outlined text-[16px] text-emerald-400">save</span>
                  <span>{_(msg`Exportar proyecto actual`)}</span>
                </span>
                <p className="text-[var(--on-surface-variant)] leading-relaxed text-[11px]">
                  {_(msg`Descarga tus tareas manteniendo las dependencias blockedBy, secciones y prioridades.`)}
                </p>
                <div id="div-importexportmodal-8" className="flex items-center gap-3 pt-0.5 text-[11px] font-mono text-[var(--on-surface-variant)]">
                  <span>• {formatTaskCount(currentStats.tasks)}</span>
                  <span>• {formatSectionCount(currentStats.groups)}</span>
                </div>
              </div>

              {/* Format selection */}
              <div id="div-importexportmodal-9" className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--on-surface)]">{_(msg`Formato de exportación`)}</label>
                <div id="div-importexportmodal-10" className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-export-format-md"
                    type="button"
                    onClick={() => setExportFormat('md')}
                    className={`p-2.5 rounded border text-left transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      exportFormat === 'md'
                        ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <div id="div-importexportmodal-11" className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--on-surface)]">{_(msg`Markdown (.md)`)}</span>
                      <span className="material-symbols-outlined text-[15px] text-sky-400">description</span>
                    </div>
                    <span className="text-[11px] opacity-80">{_(msg`Formato nativo TASKS.md estándar`)}</span>
                  </button>

                  <button
                    id="btn-export-format-json"
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`p-2.5 rounded border text-left transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      exportFormat === 'json'
                        ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <div id="div-importexportmodal-12" className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-[var(--on-surface)]">{_(msg`JSON Estructurado (.json)`)}</span>
                      <span className="material-symbols-outlined text-[15px] text-purple-400">data_object</span>
                    </div>
                    <span className="text-[11px] opacity-80">{_(msg`Grafo completo y metadatos estructurados`)}</span>
                  </button>
                </div>
              </div>

              {/* File name */}
              <div id="div-importexportmodal-13" className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--on-surface)]">{_(msg`Nombre del archivo`)}</label>
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                  placeholder="TASKS.md"
                />
              </div>

              {/* Quick Preview Box */}
              <div id="div-importexportmodal-14" className="flex flex-col gap-1.5">
                <div id="div-importexportmodal-15" className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--on-surface)]">{_(msg`Previsualización de contenido`)}</label>
                  <button
                    id="btn-export-copy-text"
                    type="button"
                    onClick={handleCopyExportText}
                    className="text-[11px] text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    <span>{copiedExport ? _(msg`¡Copiado!`) : _(msg`Copiar texto`)}</span>
                  </button>
                </div>
                <pre className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] max-h-36 overflow-auto text-[11px] font-mono leading-relaxed select-text whitespace-pre-wrap">
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
            <div id="div-importexportmodal-16" className="flex flex-col gap-3.5">
              <div id="div-importexportmodal-17" className="p-3 rounded-md bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-1.5">
                <span className="font-semibold text-[var(--on-surface)] flex items-center gap-1.5 text-xs">
                  <span className="material-symbols-outlined text-[16px] text-sky-400">upload_file</span>
                  <span>{_(msg`Importar o cargar TASKS.md`)}</span>
                </span>
                <p className="text-[var(--on-surface-variant)] leading-relaxed text-[11px]">
                  {_(msg`Carga un archivo local o pega el texto directamente. Se parsearán automáticamente las secciones, identificadores y dependencias.`)}
                </p>
              </div>

              {/* Upload or Paste Choice */}
              <div id="div-importexportmodal-18" className="flex items-center gap-2">
                <label className="btn-m3-secondary flex-1 py-1.5 text-xs cursor-pointer text-center justify-center">
                  <span className="material-symbols-outlined text-[15px]">folder_open</span>
                  <span>{_(msg`Seleccionar archivo (.md, .json)`)}</span>
                  <input
                    type="file"
                    accept=".md,.markdown,.json,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Text Area */}
              <div id="div-importexportmodal-19" className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--on-surface)]">{_(msg`Contenido Markdown`)}</label>
                <textarea
                  value={importInputText}
                  onChange={(e) => {
                    setImportInputText(e.target.value);
                    setImportSourceType('paste');
                  }}
                  rows={6}
                  placeholder={_(msg`Pega aquí el contenido de tu archivo TASKS.md...`)}
                  className="w-full bg-[var(--surface)] border border-[var(--outline)] focus:border-[var(--primary)] rounded p-2.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Import Mode: Replace vs Merge */}
              <div id="div-importexportmodal-20" className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--on-surface)]">{_(msg`Estrategia de importación`)}</label>
                <div id="div-importexportmodal-21" className="grid grid-cols-2 gap-2">
                  <button
                    id="btn-import-mode-replace"
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-2.5 rounded border text-left transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      importMode === 'replace'
                        ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <span className="font-semibold text-xs text-[var(--on-surface)]">{_(msg`Reemplazar actual`)}</span>
                    <span className="text-[11px] opacity-80">{_(msg`Sustituye todo el contenido del canvas y Kanban`)}</span>
                  </button>

                  <button
                    id="btn-import-mode-merge"
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-2.5 rounded border text-left transition-colors cursor-pointer flex flex-col gap-0.5 ${
                      importMode === 'merge'
                        ? 'bg-[var(--primary-container)]/30 border-[var(--primary)] text-[var(--on-surface)]'
                        : 'bg-[var(--surface)] border-[var(--outline)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]'
                    }`}
                  >
                    <span className="font-semibold text-xs text-[var(--on-surface)]">{_(msg`Combinar / Añadir`)}</span>
                    <span className="text-[11px] opacity-80">{_(msg`Agrega las nuevas secciones conservando las existentes`)}</span>
                  </button>
                </div>
              </div>

              {/* Validation & Preview Summary */}
              {importPreview && (
                <div id="div-importexportmodal-22" className="p-2.5 rounded bg-[var(--surface)] border border-[var(--outline)] flex flex-col gap-1">
                  <span className="font-semibold text-xs text-[var(--on-surface)] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-emerald-400">check_circle</span>
                    <span>{_(msg`Análisis previo:`)} {formatTaskCount(importPreview.taskCount)} {_(msg`en`)} {formatSectionCount(importPreview.groupCount)}</span>
                  </span>
                  {importPreview.validation.issues.length > 0 && (
                    <div id="div-importexportmodal-23" className="text-[11px] text-amber-400 flex items-center gap-1">
                      <span>⚠</span>
                      <span>{_(msg`Se detectaron ${importPreview.validation.issues.length} avisos de sintaxis en el archivo importado.`)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div id="div-importexportmodal-24" className="px-5 py-3 bg-[var(--surface)] border-t border-[var(--outline)] flex items-center justify-between">
          <button
            id="btn-import-export-cancel-footer"
            type="button"
            onClick={onClose}
            className="btn-m3-text px-3.5 py-1 text-xs cursor-pointer"
          >
            {_(msg`Cancelar`)}
          </button>

          {activeTab === 'export' ? (
            <button
              id="btn-import-export-execute-export"
              type="button"
              onClick={handleExecuteExport}
              className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              <span>{_(msg`Descargar`)} {exportFormat.toUpperCase()}</span>
            </button>
          ) : (
            <button
              id="btn-import-export-execute-import"
              type="button"
              disabled={!importInputText.trim()}
              onClick={handleExecuteImport}
              className="btn-m3-primary px-4 py-1 text-xs cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">check</span>
              <span>{importMode === 'replace' ? _(msg`Reemplazar y aplicar`) : _(msg`Combinar al proyecto`)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
