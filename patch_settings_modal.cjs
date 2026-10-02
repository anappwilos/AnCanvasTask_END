const fs = require('fs');

let content = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

// Title & Subtitle
content = content.replace(
  />\s*Configuración & Preferencias\s*<\/h2>/,
  ">{t('settings.title')}</h2>"
);
content = content.replace(
  /<p className="text-\[11px\] text-\[var\(--on-surface-variant\)\]">\s*Personaliza la interfaz, el comportamiento del espacio de trabajo y persistencia\s*<\/p>/,
  '<p className="text-[11px] text-[var(--on-surface-variant)]">{t(\'settings.subtitle\')}</p>'
);

// Sections mapping
content = content.replace(
  /label: 'General'/g, "label: t('settings.sections.general')"
);
content = content.replace(
  /label: 'Apariencia'/g, "label: t('settings.sections.appearance')"
);
content = content.replace(
  /label: 'Workspace'/g, "label: t('settings.sections.workspace')"
);
content = content.replace(
  /label: 'Canvas'/g, "label: t('settings.sections.canvas')"
);
content = content.replace(
  /label: 'Kanban'/g, "label: t('settings.sections.kanban')"
);
content = content.replace(
  /label: 'Archivos'/g, "label: t('settings.sections.files')"
);
content = content.replace(
  /label: 'Accesibilidad'/g, "label: t('settings.sections.accessibility')"
);
content = content.replace(
  /label: 'Avanzado'/g, "label: t('settings.sections.advanced')"
);

fs.writeFileSync('src/components/SettingsModal.tsx', content);
