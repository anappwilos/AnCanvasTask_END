const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('@lingui/macro')) {
    content = content.replace(/import\s*\{[^}]*\}\s*from\s*['"]@lingui\/macro['"];/g, "import { msg } from '@lingui/core/macro';\nimport { Trans } from '@lingui/react/macro';");
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
});
