const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

// Replace static content
content = content.replace(
  /<p className="text-\[var\(--on-surface-variant\)\] mt-0\.5">\s*Opciones de visualización de columnas y tarjetas del tablero\s*<\/p>/g,
  '<p className="text-[var(--on-surface-variant)] mt-0.5">{t(\'settings.kanbanDesc\')}</p>'
);
content = content.replace(
  /<p className="text-\[var\(--on-surface-variant\)\] mt-0\.5">\s*Organización de paneles laterales y distribución del espacio\s*<\/p>/g,
  '<p className="text-[var(--on-surface-variant)] mt-0.5">{t(\'settings.workspaceDesc\')}</p>'
);
content = content.replace(
  /<p className="text-\[var\(--on-surface-variant\)\] mt-0\.5">\s*Comportamiento visual del lienzo y alineación interactiva\s*<\/p>/g,
  '<p className="text-[var(--on-surface-variant)] mt-0.5">{t(\'settings.canvasDesc\')}</p>'
);
content = content.replace(
  /<span className="font-medium text-\[var\(--on-surface\)\]">Mostrar panel lateral de inicio<\/span>/g,
  '<span className="font-medium text-[var(--on-surface)]">{t(\'settings.showSidebar\')}</span>'
);
content = content.replace(
  /<span className="text-\[var\(--on-surface-variant\)\] text-\[11px\]">Mantener la barra de navegación abierta en desktop<\/span>/g,
  '<span className="text-[var(--on-surface-variant)] text-[11px]">{t(\'settings.showSidebarDesc\')}</span>'
);
content = content.replace(
  /<span className="font-medium text-\[var\(--on-surface\)\]">Agrupación predeterminada<\/span>/g,
  '<span className="font-medium text-[var(--on-surface)]">{t(\'settings.kanbanDefaultGroupBy\')}</span>'
);
content = content.replace(
  /<span className="text-\[var\(--on-surface-variant\)\] text-\[11px\]">Cómo se distribuyen las columnas en el tablero<\/span>/g,
  '<span className="text-[var(--on-surface-variant)] text-[11px]">{t(\'settings.kanbanDefaultGroupByDesc\')}</span>'
);
content = content.replace(
  /<option value="status">Por Estados \(Backlog, Todo, In Progress...\)<\/option>/g,
  '<option value="status">{t(\'settings.kanbanGroupByStatus\')}</option>'
);
content = content.replace(
  /<option value="section">Por Secciones de TASKS\.md<\/option>/g,
  '<option value="section">{t(\'settings.kanbanGroupBySection\')}</option>'
);
content = content.replace(
  /<span className="font-medium text-\[var\(--on-surface\)\]">Mostrar etiquetas \(#tags\)<\/span>/g,
  '<span className="font-medium text-[var(--on-surface)]">{t(\'settings.kanbanShowTags\')}</span>'
);
content = content.replace(
  /<span className="text-\[var\(--on-surface-variant\)\] text-\[11px\]">Mostrar etiquetas en las tarjetas Kanban<\/span>/g,
  '<span className="text-[var(--on-surface-variant)] text-[11px]">{t(\'settings.kanbanShowTagsDesc\')}</span>'
);
content = content.replace(
  /<span className="font-medium text-\[var\(--on-surface\)\]">Mostrar progreso de subtareas<\/span>/g,
  '<span className="font-medium text-[var(--on-surface)]">{t(\'settings.kanbanShowSubtasks\')}</span>'
);
content = content.replace(
  /<span className="text-\[var\(--on-surface-variant\)\] text-\[11px\]">Indicador de checklist \(ej\. 2\/4\) en tarjetas<\/span>/g,
  '<span className="text-[var(--on-surface-variant)] text-[11px]">{t(\'settings.kanbanShowSubtasksDesc\')}</span>'
);
content = content.replace(
  /<h3 className="text-sm font-semibold text-\[var\(--on-surface\)\]">Archivos Recientes<\/h3>/g,
  '<h3 className="text-sm font-semibold text-[var(--on-surface)]">{t(\'settings.recentFiles\')}</h3>'
);
content = content.replace(
  /<span className="font-medium text-\[var\(--on-surface\)\]">Persistencia Visual en la Nube \(Sanity\)<\/span>/g,
  '<span className="font-medium text-[var(--on-surface)]">{t(\'settings.cloudPersistence\')}</span>'
);
content = content.replace(
  /<span className="text-\[var\(--on-surface-variant\)\] text-\[11px\]">Guarda las coordenadas espaciales del canvas<\/span>/g,
  '<span className="text-[var(--on-surface-variant)] text-[11px]">{t(\'settings.cloudPersistenceDesc\')}</span>'
);
content = content.replace(
  /<span className="font-medium text-\[var\(--on-surface\)\]">Reducir animaciones \(Reduced Motion\)<\/span>/g,
  '<span className="font-medium text-[var(--on-surface)]">{t(\'settings.reducedMotion\')}</span>'
);
content = content.replace(
  /<span className="text-\[var\(--on-surface-variant\)\] text-\[11px\]">Minimiza o desactiva transiciones y efectos de movimiento<\/span>/g,
  '<span className="text-[var(--on-surface-variant)] text-[11px]">{t(\'settings.reducedMotionDesc\')}</span>'
);
content = content.replace(
  /<span className="font-medium text-\[var\(--on-surface\)\]">Modo de alto contraste<\/span>/g,
  '<span className="font-medium text-[var(--on-surface)]">{t(\'settings.highContrast\')}</span>'
);
content = content.replace(
  /<span className="text-\[var\(--on-surface-variant\)\] text-\[11px\]">Refuerza bordes y separadores de la interfaz<\/span>/g,
  '<span className="text-[var(--on-surface-variant)] text-[11px]">{t(\'settings.highContrastDesc\')}</span>'
);
content = content.replace(
  /<span className="font-semibold text-xs text-\[var\(--on-surface\)\]">Atajos de Teclado Principales<\/span>/g,
  '<span className="font-semibold text-xs text-[var(--on-surface)]">{t(\'settings.keyboardShortcuts\')}</span>'
);
content = content.replace(
  /<span>Restablecer preferencias<\/span>/g,
  '<span>{t(\'settings.resetDefaults\')}</span>'
);
content = content.replace(
  /<strong className="text-\[var\(--on-surface\)\]"> Tus tareas y archivos TASKS\.md no se modificarán\.<\/strong>/g,
  '<strong className="text-[var(--on-surface)]"> {t(\'settings.resetDefaultsWarning\')}</strong>'
);
content = content.replace(
  /<span>¿Restablecer preferencias\?<\/span>/g,
  '<span>{t(\'settings.resetDefaultsConfirm\')}</span>'
);

fs.writeFileSync('src/components/SettingsModal.tsx', content);
