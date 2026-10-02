const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsModal.tsx', 'utf8');

content = content.replace(
  />\s*Configurar\s*<\/button>/,
  ">{t('settings.configure')}</button>"
);

fs.writeFileSync('src/components/SettingsModal.tsx', content);
