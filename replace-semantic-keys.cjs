const fs = require('fs');
const path = require('path');

// Read es.json
const esJsonPath = path.join(__dirname, 'src', 'i18n', 'locales', 'es.json');
const esJson = JSON.parse(fs.readFileSync(esJsonPath, 'utf8'));

// Flatten json to a simple key-value map
function flattenObj(obj, prefix = '') {
  let result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      result = { ...result, ...flattenObj(v, key) };
    } else {
      result[key] = v;
    }
  }
  return result;
}
const translations = flattenObj(esJson);

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // Replace import useTranslation -> useLingui
  if (content.includes('useTranslation')) {
    content = content.replace(/import\s+\{.*useTranslation.*\}\s+from\s+['"]react-i18next['"];?/, `import { useLingui } from '@lingui/react';\nimport { msg, Trans } from '@lingui/macro';`);
  }
  // Replace useTranslation() hook
  content = content.replace(/const\s+\{\s*t(?:,\s*i18n)?\s*\}\s*=\s*useTranslation\([^)]*\);?/, `const { i18n } = useLingui();`);
  content = content.replace(/const\s+\{\s*i18n(?:,\s*t)?\s*\}\s*=\s*useTranslation\([^)]*\);?/, `const { i18n } = useLingui();`);
  
  // Replace t('key') and {t('key')}
  // We'll use a regex that handles t('key') or t('key', { args })
  // Actually, simplest is to just do a regex replace on t('key')
  // We'll iterate over all translation keys and replace them.
  for (const [key, text] of Object.entries(translations)) {
    // Escape string for regex
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Pattern to match t('key') or t("key") or {t('key')}
    // With optional variables: t('key', { var: val })
    const rx = new RegExp(`t\\(\\s*['"]${escapedKey}['"]\\s*(?:,\\s*(\\{[^\\}]+\\}))?\\s*\\)`, 'g');
    
    content = content.replace(rx, (match, argsObj) => {
      // Escape backticks in the text
      const escapedText = text.replace(/`/g, '\\`');
      if (argsObj) {
         // Replace {{var}} in text with ${var}
         let newText = escapedText.replace(/\\{\\{([^}]+)\\}\\}/g, '\\$\\{$1\\}');
         newText = newText.replace(/\\{([^}]+)\\}/g, '\\$\\{$1\\}');
         // Actually the user wants standard msg with object if possible? 
         // Lingui uses: i18n._(msg`Hola ${var}`)
         // But FormatJS uses {{}} ? No, Lingui interpolation is ${var}.
         // Let's just output t\`${escapedText}\` but we must replace {{var}} with ${var}
         // Wait, the Lingui way for variables in msg is: msg`Hello ${name}`
         // Since we don't know the variable bindings directly, we can just replace {{var}} with ${var}
         // because argsObj typically passes { var: varName } which means `varName` is in scope!
         let finalMsg = text.replace(/\{\{([^}]+)\}\}/g, '\\${$1}').replace(/\{([^}]+)\}/g, '\\${$1}');
         finalMsg = finalMsg.replace(/`/g, '\\`');
         return `i18n._(msg\`${finalMsg}\`)`;
      } else {
        return `i18n._(msg\`${escapedText}\`)`;
      }
    });
  }

  if (content !== original) {
    console.log(`Updated ${filePath}`);
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src'));
console.log('Semantic keys replaced!');
