const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

// Replace static headings
content = content.replace(
  /<h3 className="text-sm font-semibold text-\[var\(--on-surface\)\]">General<\/h3>/g,
  '<h3 className="text-sm font-semibold text-[var(--on-surface)]">{t(\'settings.sections.general\')}</h3>'
);
content = content.replace(
  /<h3 className="text-sm font-semibold text-\[var\(--on-surface\)\]">Apariencia<\/h3>/g,
  '<h3 className="text-sm font-semibold text-[var(--on-surface)]">{t(\'settings.sections.appearance\')}</h3>'
);
content = content.replace(
  /<label className="font-semibold text-\[var\(--on-surface\)\]">Tema de color<\/label>/g,
  '<label className="font-semibold text-[var(--on-surface)]">{t(\'settings.themeLabel\')}</label>'
);
content = content.replace(
  /{ id: 'dark', label: 'Oscuro', icon: 'dark_mode' }/g,
  "{ id: 'dark', label: t('settings.themes.dark'), icon: 'dark_mode' }"
);
content = content.replace(
  /{ id: 'light', label: 'Claro', icon: 'light_mode' }/g,
  "{ id: 'light', label: t('settings.themes.light'), icon: 'light_mode' }"
);
content = content.replace(
  /{ id: 'system', label: 'Seguir Sistema', icon: 'devices' }/g,
  "{ id: 'system', label: t('settings.themes.system'), icon: 'devices' }"
);
content = content.replace(
  /<label className="font-semibold text-\[var\(--on-surface\)\]">Densidad de la interfaz<\/label>/g,
  '<label className="font-semibold text-[var(--on-surface)]">{t(\'settings.densityLabel\')}</label>'
);
content = content.replace(
  /label: 'Compacta',/g, "label: t('settings.densities.compact'),"
);
content = content.replace(
  /label: 'Normal',/g, "label: t('settings.densities.normal'),"
);
content = content.replace(
  /label: 'Cómoda',/g, "label: t('settings.densities.comfortable'),"
);
content = content.replace(
  /Vista inicial al abrir/g, "{t('settings.defaultView')}"
);
content = content.replace(
  /Selecciona el modo predeterminado de inicio/g, "{t('settings.defaultViewDesc')}"
);
content = content.replace(
  /Confirmar eliminación con dependencias/g, "{t('settings.confirmDelete')}"
);
content = content.replace(
  /Avisa con diálogo explícito si la tarea eliminada bloquea a otras tareas/g, "{t('settings.confirmDeleteDesc')}"
);
content = content.replace(
  /Mostrar cuadrícula de fondo/g, "{t('settings.showGrid')}"
);
content = content.replace(
  /Guía visual de puntos en el lienzo infinito/g, "{t('settings.showGridDesc')}"
);
content = content.replace(
  /Alineación magnética \(Snapping\)/g, "{t('settings.snapToGrid')}"
);
content = content.replace(
  /Alinear tarjetas automáticamente con los ejes/g, "{t('settings.snapToGridDesc')}"
);
content = content.replace(
  /Reiniciar lienzo del Canvas/g, "{t('settings.resetCanvas')}"
);
content = content.replace(
  /Restaura la distribución espacial de las tarjetas/g, "{t('settings.resetCanvasDesc')}"
);
content = content.replace(
  /Restablecer preferencias/g, "{t('settings.resetDefaults')}"
);
content = content.replace(
  /Se restablecerán los ajustes visuales y de comportamiento a sus valores de fábrica\./g, "{t('settings.resetDefaultsDesc')}"
);

fs.writeFileSync('src/components/SettingsModal.tsx', content);
