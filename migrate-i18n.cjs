const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes('useTranslation') && !content.includes('react-i18next')) return;
  
  console.log(`Processing ${filePath}...`);
  
  // Replace imports
  content = content.replace(/import\s+\{.*useTranslation.*\}\s+from\s+['"]react-i18next['"];?/, `import { useLingui } from '@lingui/react';\nimport { msg, Trans } from '@lingui/macro';`);
  
  // Replace hook usage
  content = content.replace(/const\s+\{\s*t(?:,\s*i18n)?\s*\}\s*=\s*useTranslation\([^)]*\);?/, `const { i18n } = useLingui();`);
  content = content.replace(/const\s+\{\s*i18n(?:,\s*t)?\s*\}\s*=\s*useTranslation\([^)]*\);?/, `const { i18n } = useLingui();`);
  content = content.replace(/const\s+\{\s*t\s*:\s*([^,]+)(?:,\s*i18n)?\s*\}\s*=\s*useTranslation\([^)]*\);?/, `const { i18n } = useLingui();\n  const $1 = (id) => i18n._(id); // temporary shim`);

  // Replace t('something') with i18n._(msg`something`)
  // To make it safe, we'll replace `{t('str')}` with `<Trans>str</Trans>` inside JSX when possible, 
  // but it's easier to just use `i18n._(msg\`str\`)` everywhere because it's universally valid JS.
  // We'll replace t('xxx') or t("xxx")
  
  // We need to match t('...') avoiding complex interpolations for now, or just use regex.
  // A simple regex for t('...') or t("...")
  const tRegex = /\bt\(\s*(['"])(.*?)\1\s*\)/g;
  content = content.replace(tRegex, (match, quote, str) => {
    // If str contains \n or `, escape it properly or just use it.
    // To be safe, we'll use msg\`${str}\`
    // Actually Lingui macro msg uses tagged template literals.
    const escapedStr = str.replace(/`/g, '\\`');
    return `i18n._(msg\`${escapedStr}\`)`;
  });

  fs.writeFileSync(filePath, content, 'utf-8');
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src'));
console.log('Migration complete.');
