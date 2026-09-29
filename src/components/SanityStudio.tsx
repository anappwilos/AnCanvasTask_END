import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getSanityConfig,
  fetchSanityDocumentsList,
  fetchSanityDocumentById,
  saveSanityDocument,
  deleteDocumentFromSanity,
  writeTestingTaskToSanity,
  SanityConfig,
} from '../services/sanityService';

export interface SanityStudioProps {
  onOpenSanityConfig: () => void;
  onImportTaskToMarkdown?: (task: any) => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

type DocumentTypeFilter = 'all' | 'task' | 'canvasVisualState';
type InspectorViewMode = 'form' | 'json' | 'preview';

export const SanityStudio: React.FC<SanityStudioProps> = ({
  onOpenSanityConfig,
  onImportTaskToMarkdown,
  onShowToast,
}) => {
  const [config, setConfig] = useState<SanityConfig>(() => getSanityConfig());
  const [activeDocType, setActiveDocType] = useState<DocumentTypeFilter>('task');
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Filter & Search state in Document List Pane
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectorMode, setInspectorMode] = useState<InspectorViewMode>('form');

  // Form edit state for currently selected document
  const [formState, setFormState] = useState<any>({});
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [tagInput, setTagInput] = useState<string>('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>('');

  // Mobile navigation pane state: 'structure' | 'list' | 'inspector'
  const [mobilePane, setMobilePane] = useState<'structure' | 'list' | 'inspector'>('list');

  const isConfigured = Boolean(config.projectId && config.dataset);

  // Load all documents from Sanity
  const loadDocuments = useCallback(async () => {
    if (!config.projectId || !config.dataset) {
      setDocuments([]);
      return;
    }

    setIsLoadingList(true);
    try {
      const docs = await fetchSanityDocumentsList(config);
      setDocuments(docs);
      // Auto-select first document if nothing selected
      if (!selectedDocId && docs.length > 0) {
        const firstTask = docs.find((d) => d._type === 'task') || docs[0];
        setSelectedDocId(firstTask._id);
      }
    } catch (err) {
      console.warn('Error loading Sanity documents:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [config, selectedDocId]);

  // Initial load
  useEffect(() => {
    setConfig(getSanityConfig());
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Load selected document details
  useEffect(() => {
    if (!selectedDocId) {
      setSelectedDoc(null);
      setFormState({});
      setIsDirty(false);
      return;
    }

    let isMounted = true;
    setIsLoadingDoc(true);

    fetchSanityDocumentById(selectedDocId, config).then((doc) => {
      if (!isMounted) return;
      setIsLoadingDoc(false);
      if (doc) {
        setSelectedDoc(doc);
        setFormState({ ...doc });
        setIsDirty(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedDocId, config]);

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (activeDocType !== 'all' && doc._type !== activeDocType) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (doc.title || '').toLowerCase().includes(q);
        const matchTaskId = (doc.taskId || '').toLowerCase().includes(q);
        const matchId = (doc._id || '').toLowerCase().includes(q);
        const matchProject = (doc.projectId || '').toLowerCase().includes(q);
        if (!matchTitle && !matchTaskId && !matchId && !matchProject) return false;
      }

      if (statusFilter !== 'all' && doc._type === 'task') {
        if (statusFilter === 'done' && !doc.completed) return false;
        if (statusFilter === 'todo' && doc.completed) return false;
      }

      return true;
    });
  }, [documents, activeDocType, searchQuery, statusFilter]);

  const taskCount = documents.filter((d) => d._type === 'task').length;
  const canvasCount = documents.filter((d) => d._type === 'canvasVisualState').length;

  const handleFormFieldChange = (field: string, value: any) => {
    setFormState((prev: any) => ({
      ...prev,
      [field]: value,
    }));
    setIsDirty(true);
  };

  const handleSaveDocument = async () => {
    if (!selectedDocId || !isConfigured) return;
    setIsSaving(true);

    try {
      const res = await saveSanityDocument(formState, config);
      if (res.ok) {
        onShowToast('Documento publicado con éxito en Sanity', 'success');
        setSelectedDoc(res.document || formState);
        setIsDirty(false);
        loadDocuments();
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err: any) {
      onShowToast(err?.message || 'Error al guardar', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!selectedDocId) return;
    if (!window.confirm(`¿Estás seguro de eliminar el documento "${formState.title || selectedDocId}" de Sanity?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteDocumentFromSanity(selectedDocId, config);
      if (res.ok) {
        onShowToast('Documento eliminado de Sanity', 'info');
        setSelectedDocId(null);
        setSelectedDoc(null);
        setFormState({});
        loadDocuments();
        setMobilePane('list');
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err) {
      onShowToast('Error al eliminar', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateNewTestTask = async () => {
    const customTitle = prompt('Título para la nueva tarea en Sanity:', 'Nueva Tarea Sanity Studio');
    if (!customTitle) return;

    try {
      const res = await writeTestingTaskToSanity(config, {
        title: customTitle.trim(),
        taskId: 'task-' + Date.now().toString(36),
        priority: 'P1',
        status: 'todo',
        groupTitle: 'General',
      });

      if (res.ok && res.document) {
        onShowToast('Nuevo documento _type: "task" creado en Sanity', 'success');
        await loadDocuments();
        setSelectedDocId(res.document._id);
        setActiveDocType('task');
        setMobilePane('inspector');
      } else {
        onShowToast(res.message, 'error');
      }
    } catch (err) {
      onShowToast('Error al crear tarea', 'error');
    }
  };

  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const clean = tagInput.trim().replace(/^#/, '');
    const currentTags = Array.isArray(formState.tags) ? formState.tags : [];
    if (!currentTags.includes(clean)) {
      handleFormFieldChange('tags', [...currentTags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = Array.isArray(formState.tags) ? formState.tags : [];
    handleFormFieldChange(
      'tags',
      currentTags.filter((t: string) => t !== tagToRemove)
    );
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const currentSubtasks = Array.isArray(formState.subtasks) ? formState.subtasks : [];
    handleFormFieldChange('subtasks', [
      ...currentSubtasks,
      { title: newSubtaskTitle.trim(), completed: false },
    ]);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (index: number) => {
    const currentSubtasks = Array.isArray(formState.subtasks) ? [...formState.subtasks] : [];
    if (currentSubtasks[index]) {
      currentSubtasks[index] = {
        ...currentSubtasks[index],
        completed: !currentSubtasks[index].completed,
      };
      handleFormFieldChange('subtasks', currentSubtasks);
    }
  };

  const handleRemoveSubtask = (index: number) => {
    const currentSubtasks = Array.isArray(formState.subtasks) ? [...formState.subtasks] : [];
    handleFormFieldChange(
      'subtasks',
      currentSubtasks.filter((_: any, i: number) => i !== index)
    );
  };

  // If not configured, show sober prompt
  if (!isConfigured) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center p-6 text-center bg-[var(--surface)] select-none">
        <div className="w-14 h-14 rounded-2xl bg-sky-950/80 border border-sky-600/50 flex items-center justify-center text-sky-400 mb-3 shadow-md">
          <span className="material-symbols-outlined text-[30px]">cloud_off</span>
        </div>
        <h2 className="text-base font-semibold text-[var(--on-surface)] mb-1">
          Sanity Studio no conectado
        </h2>
        <p className="text-xs text-[var(--on-surface-variant)] max-w-md mb-4 leading-relaxed">
          Para explorar y editar tus esquemas <code className="font-mono text-sky-300">_type: "task"</code> y el estado visual del canvas, configura tu Project ID y Dataset de Sanity.
        </p>
        <button
          type="button"
          onClick={onOpenSanityConfig}
          className="btn-m3-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">settings</span>
          <span>Configurar credenciales de Sanity</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex overflow-hidden bg-[var(--surface)] text-xs select-none">
      {/* ========================================================= */}
      {/* PANE 1: STRUCTURE TREE (Desk Tool Navigation) */}
      {/* ========================================================= */}
      <aside
        className={`w-full sm:w-56 md:w-64 bg-[var(--surface-container)] border-r border-[var(--outline)] flex flex-col justify-between shrink-0 ${
          mobilePane === 'structure' ? 'flex' : 'hidden sm:flex'
        }`}
      >
        {/* Studio Brand Header */}
        <div className="px-3.5 py-3 border-b border-[var(--outline)] flex items-center justify-between bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-rose-600 flex items-center justify-center text-white font-bold text-[11px] shadow-xs">
              S
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs text-[var(--on-surface)] tracking-tight">Sanity Studio</span>
              <span className="text-[10px] font-mono text-[var(--primary)] truncate">{config.dataset}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={loadDocuments}
            className="btn-m3-icon w-6 h-6 cursor-pointer"
            title="Recargar datos de Sanity"
          >
            <span className={`material-symbols-outlined text-[15px] ${isLoadingList ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>

        {/* Structure Hierarchy Tree */}
        <div className="flex-1 p-2 overflow-y-auto flex flex-col gap-1">
          <span className="px-2 py-1 text-[10px] font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
            Tipos de Contenido
          </span>

          {/* Task Document Type */}
          <button
            type="button"
            onClick={() => {
              setActiveDocType('task');
              setMobilePane('list');
            }}
            className={`w-full px-2.5 py-2 rounded text-xs font-medium flex items-center justify-between text-left transition-colors cursor-pointer ${
              activeDocType === 'task'
                ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)] font-semibold border-l-2 border-l-[var(--primary)]'
                : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[17px] text-sky-400">check_box</span>
              <span className="truncate">Tareas (task)</span>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--outline)]">
              {taskCount}
            </span>
          </button>

          {/* Canvas Visual State Document Type */}
          <button
            type="button"
            onClick={() => {
              setActiveDocType('canvasVisualState');
              setMobilePane('list');
            }}
            className={`w-full px-2.5 py-2 rounded text-xs font-medium flex items-center justify-between text-left transition-colors cursor-pointer ${
              activeDocType === 'canvasVisualState'
                ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)] font-semibold border-l-2 border-l-[var(--primary)]'
                : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[17px] text-purple-400">grid_view</span>
              <span className="truncate">Canvas Visual State</span>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--outline)]">
              {canvasCount}
            </span>
          </button>

          {/* All Documents */}
          <button
            type="button"
            onClick={() => {
              setActiveDocType('all');
              setMobilePane('list');
            }}
            className={`w-full px-2.5 py-2 rounded text-xs font-medium flex items-center justify-between text-left transition-colors cursor-pointer ${
              activeDocType === 'all'
                ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)] font-semibold border-l-2 border-l-[var(--primary)]'
                : 'text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--on-surface)]'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[17px] text-amber-400">folder</span>
              <span className="truncate">Todos los docs</span>
            </div>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--surface-container)] text-[var(--on-surface)] border border-[var(--outline)]">
              {documents.length}
            </span>
          </button>
        </div>

        {/* Structure Footer */}
        <div className="p-2.5 border-t border-[var(--outline)] bg-[var(--surface)] flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onOpenSanityConfig}
            className="btn-m3-secondary w-full py-1.5 text-xs justify-start px-2.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
            <span>Ajustes de conexión</span>
          </button>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* PANE 2: DOCUMENT LIST (Documents of selected type) */}
      {/* ========================================================= */}
      <section
        className={`w-full sm:w-72 md:w-80 lg:w-96 bg-[var(--surface)] border-r border-[var(--outline)] flex flex-col shrink-0 ${
          mobilePane === 'list' ? 'flex' : 'hidden sm:flex'
        }`}
      >
        {/* Document List Header */}
        <div className="px-3.5 py-2.5 border-b border-[var(--outline)] flex items-center justify-between bg-[var(--surface-container)] gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobilePane('structure')}
              className="sm:hidden btn-m3-icon w-6 h-6 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            </button>
            <div className="flex flex-col min-w-0">
              <h3 className="font-semibold text-xs text-[var(--on-surface)] truncate">
                {activeDocType === 'task'
                  ? 'Documentos de Tarea'
                  : activeDocType === 'canvasVisualState'
                  ? 'Estados de Lienzo'
                  : 'Todos los Documentos'}
              </h3>
              <span className="text-[10px] text-[var(--on-surface-variant)]">
                {filteredDocuments.length} documentos encontrados
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateNewTestTask}
            className="btn-m3-primary px-2.5 py-1 text-[11px] flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
            title="Crear un nuevo documento de tipo task en Sanity"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>+ Crear Task</span>
          </button>
        </div>

        {/* Search & Quick Filters */}
        <div className="p-2 border-b border-[var(--outline)] bg-[var(--surface)] flex flex-col gap-1.5">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-[var(--on-surface-variant)]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, ID o tag..."
              className="w-full bg-[var(--surface-container)] border border-[var(--outline)] rounded pl-8 pr-7 py-1 text-xs text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)] focus:outline-none focus:border-[var(--primary)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>

          {activeDocType === 'task' && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'todo', label: 'Pendientes' },
                { id: 'done', label: 'Completados' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-[var(--primary)] text-[var(--on-primary)] font-semibold'
                      : 'bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Documents Scrollable List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--outline)]">
          {isLoadingList ? (
            <div className="p-6 text-center text-[var(--on-surface-variant)] flex flex-col items-center gap-2">
              <span className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <span>Consultando Sanity...</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-6 text-center text-[var(--on-surface-variant)] flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-[24px] text-slate-500">inventory_2</span>
              <span>No hay documentos que coincidan con el filtro.</span>
              <button
                type="button"
                onClick={handleCreateNewTestTask}
                className="btn-m3-secondary px-3 py-1 text-xs text-sky-400 cursor-pointer mt-1"
              >
                Crear primer Task en Sanity
              </button>
            </div>
          ) : (
            filteredDocuments.map((doc) => {
              const isSelected = selectedDocId === doc._id;
              const isTask = doc._type === 'task';
              return (
                <div
                  key={doc._id}
                  onClick={() => {
                    setSelectedDocId(doc._id);
                    setMobilePane('inspector');
                  }}
                  className={`p-3 flex flex-col gap-1 transition-colors cursor-pointer border-l-2 ${
                    isSelected
                      ? 'bg-[var(--surface-container-high)] border-l-[var(--primary)]'
                      : 'border-l-transparent hover:bg-[var(--surface-container)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`material-symbols-outlined text-[16px] shrink-0 ${
                          isTask ? 'text-sky-400' : 'text-purple-400'
                        }`}
                      >
                        {isTask ? 'check_box' : 'grid_view'}
                      </span>
                      <span className="font-semibold text-xs text-[var(--on-surface)] truncate">
                        {doc.title || doc.projectId || doc._id}
                      </span>
                    </div>

                    {isTask && doc.priority && (
                      <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800 shrink-0">
                        {doc.priority}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[var(--on-surface-variant)] font-mono">
                    <span className="truncate max-w-[140px]">
                      {doc.taskId ? `#${doc.taskId}` : `_id: ${doc._id}`}
                    </span>
                    <span className="shrink-0">
                      {doc._updatedAt ? new Date(doc._updatedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* PANE 3: DOCUMENT INSPECTOR & EDITOR */}
      {/* ========================================================= */}
      <main
        className={`flex-1 bg-[var(--surface)] flex flex-col overflow-hidden ${
          mobilePane === 'inspector' ? 'flex' : 'hidden sm:flex'
        }`}
      >
        {!selectedDocId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--on-surface-variant)]">
            <span className="material-symbols-outlined text-[36px] text-slate-600 mb-2">description</span>
            <h4 className="font-semibold text-sm text-[var(--on-surface)] mb-1">Ningún documento seleccionado</h4>
            <p className="text-xs max-w-sm">Selecciona una tarea de la lista para ver sus campos y modificarla en tiempo real en Sanity.</p>
          </div>
        ) : isLoadingDoc ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[var(--on-surface-variant)]">
            <span className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-2" />
            <span>Cargando datos del documento desde Sanity...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Inspector Top Bar */}
            <div className="px-4 py-2.5 border-b border-[var(--outline)] bg-[var(--surface-container)] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobilePane('list')}
                  className="sm:hidden btn-m3-icon w-6 h-6 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                </button>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-[var(--on-surface)] truncate">
                      {formState.title || formState._id}
                    </span>
                    <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-[var(--surface)] text-sky-300 border border-[var(--outline)]">
                      {formState._type}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--on-surface-variant)] truncate">
                    _id: {formState._id}
                  </span>
                </div>
              </div>

              {/* View Mode Switcher & Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center bg-[var(--surface)] p-0.5 rounded border border-[var(--outline)]">
                  <button
                    type="button"
                    onClick={() => setInspectorMode('form')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                      inspectorMode === 'form' ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'text-[var(--on-surface-variant)]'
                    }`}
                  >
                    Formulario
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorMode('json')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                      inspectorMode === 'json' ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'text-[var(--on-surface-variant)]'
                    }`}
                  >
                    JSON
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteDocument}
                  disabled={isDeleting}
                  className="btn-m3-secondary px-2.5 py-1 text-xs text-rose-400 border-rose-900/60 hover:bg-rose-950/40 cursor-pointer"
                  title="Eliminar documento de Sanity"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveDocument}
                  disabled={isSaving || !isDirty}
                  className="btn-m3-primary px-3.5 py-1 text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {isSaving ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                      <span>Publicar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Inspector Body Pane */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
              {inspectorMode === 'json' ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
                    <span>Documento RAW almacenado en Sanity ({config.dataset}):</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(formState, null, 2));
                        onShowToast('JSON copiado al portapapeles', 'info');
                      }}
                      className="text-sky-400 hover:underline flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      <span className="material-symbols-outlined text-[13px]">content_copy</span>
                      <span>Copiar JSON</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded bg-black/60 border border-[var(--outline)] font-mono text-[11px] text-emerald-300 overflow-x-auto leading-relaxed select-text whitespace-pre-wrap">
                    {JSON.stringify(formState, null, 2)}
                  </pre>
                </div>
              ) : formState._type === 'task' ? (
                /* TASK FORM FIELDS (Matching Task Schema) */
                <div className="flex flex-col gap-3.5 max-w-2xl">
                  {/* Task Title */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-xs text-[var(--on-surface)]">Título de la tarea</label>
                    <input
                      type="text"
                      value={formState.title || ''}
                      onChange={(e) => handleFormFieldChange('title', e.target.value)}
                      className="w-full bg-[var(--surface-container)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-3 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none"
                    />
                  </div>

                  {/* Task ID and Group */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs text-[var(--on-surface)]">Task ID (Identificador)</label>
                      <input
                        type="text"
                        value={formState.taskId || ''}
                        onChange={(e) => handleFormFieldChange('taskId', e.target.value)}
                        className="w-full bg-[var(--surface-container)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-3 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs text-[var(--on-surface)]">Sección / Grupo</label>
                      <input
                        type="text"
                        value={formState.groupTitle || ''}
                        onChange={(e) => handleFormFieldChange('groupTitle', e.target.value)}
                        className="w-full bg-[var(--surface-container)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-3 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Priority & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs text-[var(--on-surface)]">Prioridad</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['P0', 'P1', 'P2', 'P3'].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleFormFieldChange('priority', p)}
                            className={`py-1 rounded font-mono text-xs border text-center cursor-pointer ${
                              formState.priority === p
                                ? 'bg-[var(--primary)] text-[var(--on-primary)] font-bold border-[var(--primary)]'
                                : 'bg-[var(--surface-container)] text-[var(--on-surface-variant)] border-[var(--outline)]'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-xs text-[var(--on-surface)]">Estado Kanban</label>
                      <select
                        value={formState.status || (formState.completed ? 'done' : 'todo')}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleFormFieldChange('status', val);
                          handleFormFieldChange('completed', val === 'done');
                        }}
                        className="w-full bg-[var(--surface-container)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-2.5 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none cursor-pointer"
                      >
                        <option value="todo">Por hacer (Todo)</option>
                        <option value="in_progress">En progreso (In Progress)</option>
                        <option value="blocked">Bloqueada (Blocked)</option>
                        <option value="done">Completada (Done)</option>
                      </select>
                    </div>
                  </div>

                  {/* BlockedBy DAG Dependency */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-xs text-[var(--on-surface)]">
                      Bloqueada por (blockedBy - Task ID)
                    </label>
                    <input
                      type="text"
                      value={formState.blockedBy || ''}
                      onChange={(e) => handleFormFieldChange('blockedBy', e.target.value)}
                      placeholder="ej. oauth, setup-db"
                      className="w-full bg-[var(--surface-container)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-3 py-1.5 text-xs font-mono text-[var(--on-surface)] focus:outline-none"
                    />
                  </div>

                  {/* Tags */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-xs text-[var(--on-surface)]">Etiquetas (#tags)</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(Array.isArray(formState.tags) ? formState.tags : []).map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-700/60 text-sky-300 font-mono text-[10px] flex items-center gap-1"
                        >
                          <span>#{tag}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="hover:text-white cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          placeholder="+ tag"
                          className="w-20 bg-[var(--surface-container)] border border-[var(--outline)] rounded px-2 py-0.5 text-[10px] font-mono text-[var(--on-surface)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddTag}
                          className="px-1.5 py-0.5 text-[10px] rounded bg-[var(--surface-container)] border border-[var(--outline)] cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Subtasks Checklist */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-xs text-[var(--on-surface)]">Subtareas (Checklist)</label>
                    <div className="divide-y divide-[var(--outline)] rounded border border-[var(--outline)] bg-[var(--surface-container)]">
                      {(Array.isArray(formState.subtasks) ? formState.subtasks : []).map(
                        (sub: any, idx: number) => (
                          <div key={idx} className="p-2 flex items-center justify-between gap-2 text-xs">
                            <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(sub.completed)}
                                onChange={() => handleToggleSubtask(idx)}
                                className="w-3.5 h-3.5 accent-[var(--primary)] cursor-pointer"
                              />
                              <span className={sub.completed ? 'line-through opacity-60' : ''}>
                                {sub.title}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubtask(idx)}
                              className="text-rose-400 hover:text-rose-300 text-xs cursor-pointer"
                            >
                              ×
                            </button>
                          </div>
                        )
                      )}
                      <div className="p-2 flex items-center gap-2">
                        <input
                          type="text"
                          value={newSubtaskTitle}
                          onChange={(e) => setNewSubtaskTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSubtask();
                            }
                          }}
                          placeholder="Añadir nueva subtarea..."
                          className="flex-1 bg-[var(--surface)] border border-[var(--outline)] rounded px-2.5 py-1 text-xs text-[var(--on-surface)] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddSubtask}
                          className="btn-m3-secondary px-2.5 py-1 text-xs cursor-pointer"
                        >
                          Añadir
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Description / Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-xs text-[var(--on-surface)]">Descripción / Notas</label>
                    <textarea
                      rows={3}
                      value={formState.description || ''}
                      onChange={(e) => handleFormFieldChange('description', e.target.value)}
                      placeholder="Detalles de la tarea..."
                      className="w-full bg-[var(--surface-container)] border border-[var(--outline)] focus:border-[var(--primary)] rounded px-3 py-1.5 text-xs text-[var(--on-surface)] focus:outline-none"
                    />
                  </div>

                  {/* Import to Markdown Action */}
                  {onImportTaskToMarkdown && (
                    <div className="p-3 rounded bg-[var(--surface-container)] border border-[var(--outline)] flex items-center justify-between gap-3 mt-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-[var(--on-surface)]">Sincronizar con TASKS.md</span>
                        <span className="text-[11px] text-[var(--on-surface-variant)]">
                          Importa esta tarea de Sanity al archivo local y lienzo
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onImportTaskToMarkdown(formState)}
                        className="btn-m3-secondary px-3 py-1.5 text-xs flex items-center gap-1 cursor-pointer text-emerald-400 border-emerald-800/60"
                      >
                        <span className="material-symbols-outlined text-[14px]">file_download</span>
                        <span>Importar al lienzo</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* CANVAS VISUAL STATE INSPECTOR */
                <div className="flex flex-col gap-3">
                  <div className="p-3 rounded bg-[var(--surface-container)] border border-[var(--outline)]">
                    <span className="font-semibold text-xs text-[var(--on-surface)]">
                      Coordenadas espaciales del lienzo ({Array.isArray(formState.tasks) ? formState.tasks.length : 0} tarjetas registradas)
                    </span>
                  </div>

                  <pre className="p-3 rounded bg-black/60 border border-[var(--outline)] font-mono text-[11px] text-purple-300 overflow-x-auto leading-relaxed select-text whitespace-pre-wrap">
                    {JSON.stringify(formState, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
