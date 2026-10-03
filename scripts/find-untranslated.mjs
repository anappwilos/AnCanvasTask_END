import fs from 'fs';
import path from 'path';
import parser from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default || _traverse;

const IGNORE_STRINGS = new Set([
  'material-symbols-outlined',
  'flex', 'grid', 'hidden', 'block', 'none',
  'submit', 'button', 'text', 'checkbox', 'radio',
  'info', 'success', 'warning', 'error',
  'px', 'rem', '%', 'auto',
  'en', 'es', 'zh', 'hi', 'fr', 'ar', 'bn', 'pt', 'ru', 'ur',
  'GET', 'POST', 'PUT', 'DELETE',
  'application/json', 'utf-8',
]);

const MATERIAL_ICON_NAMES = new Set([
  'close', 'add', 'check', 'edit', 'delete', 'sync', 'settings', 'search', 'folder',
  'description', 'splitscreen_left', 'grid_view', 'chevron_right', 'chevron_left',
  'expand_more', 'expand_less', 'refresh', 'warning', 'error', 'info', 'help',
  'history', 'download', 'upload', 'save', 'cancel', 'menu', 'more_vert',
  'arrow_back', 'arrow_forward', 'link', 'open_in_new', 'content_copy', 'tune',
  'terminal', 'code', 'visibility', 'visibility_off', 'palette', 'star', 'favorite',
  'lock', 'lock_open', 'public', 'dns', 'hub', 'cloud', 'cloud_done', 'cloud_off',
  'commit', 'branch', 'fork_right', 'merge', 'undo', 'redo', 'play_arrow', 'pause',
  'stop', 'filter_list', 'sort', 'folder_open', 'insert_drive_file', 'drag_indicator',
  'check_circle', 'radio_button_checked', 'radio_button_unchecked', 'circle',
  'notifications', 'bolt', 'auto_fix_high', 'psychology', 'speed', 'dataset', 'schema',
  'table_chart', 'storage', 'data_object', 'badge', 'smart_toy', 'rule', 'view_kanban',
  'developer_board', 'lan', 'account_tree', 'swap_horiz', 'cached', 'verified',
  'warning_amber', 'report_problem', 'help_outline', 'info_outline', 'fact_check'
]);

function isLikelyText(str) {
  const trimmed = str.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (/^[\d\s.,:;!?'"()\[\]{}\-_/\\+=*&%$#@~`^|<>]+$/.test(trimmed)) return false;
  if (/^[a-z0-9_-]+$/.test(trimmed) && MATERIAL_ICON_NAMES.has(trimmed)) return false;
  if (IGNORE_STRINGS.has(trimmed)) return false;
  if (/^(bg|text|border|p|m|w|h|max-w|flex|grid|gap|col|row)-/.test(trimmed)) return false;
  return /[a-záéíóúñA-ZÁÉÍÓÚÑ]/.test(trimmed);
}

function scanFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err.message);
    return [];
  }

  const untranslated = [];

  traverse(ast, {
    JSXText(pathNode) {
      const val = pathNode.node.value;
      if (!isLikelyText(val)) return;

      // Check if parent is Trans or within a macro
      let parent = pathNode.parentPath;
      let inTrans = false;
      let isMaterialSymbol = false;

      while (parent) {
        if (parent.isJSXElement()) {
          const opening = parent.node.openingElement;
          const tag = opening.name.name;
          if (tag === 'Trans') {
            inTrans = true;
            break;
          }
          // Check if parent has className="material-symbols-outlined..."
          const classAttr = opening.attributes?.find(
            (a) => a.type === 'JSXAttribute' && a.name?.name === 'className'
          );
          if (
            classAttr &&
            classAttr.value?.type === 'StringLiteral' &&
            classAttr.value.value.includes('material-symbols-outlined')
          ) {
            isMaterialSymbol = true;
            break;
          }
        }
        parent = parent.parentPath;
      }

      if (!inTrans && !isMaterialSymbol) {
        untranslated.push({
          type: 'JSXText',
          line: pathNode.node.loc.start.line,
          text: val.trim(),
        });
      }
    },

    JSXAttribute(pathNode) {
      const attrName = pathNode.node.name?.name;
      if (!['placeholder', 'title', 'aria-label'].includes(attrName)) return;

      if (pathNode.node.value?.type === 'StringLiteral') {
        const val = pathNode.node.value.value;
        if (isLikelyText(val)) {
          untranslated.push({
            type: `JSXAttribute(${attrName})`,
            line: pathNode.node.loc.start.line,
            text: val.trim(),
          });
        }
      }
    },

    CallExpression(pathNode) {
      const callee = pathNode.node.callee;
      let fnName = '';
      if (callee.type === 'Identifier') fnName = callee.name;
      else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        fnName = callee.property.name;
      }

      if (['onShowToast', 'pushToast', 'confirm', 'alert'].includes(fnName)) {
        const firstArg = pathNode.node.arguments[0];
        if (firstArg?.type === 'StringLiteral') {
          const val = firstArg.value;
          if (isLikelyText(val)) {
            untranslated.push({
              type: `Call(${fnName})`,
              line: pathNode.node.loc.start.line,
              text: val.trim(),
            });
          }
        }
      }
    },
  });

  return untranslated;
}

function run() {
  const dir = path.resolve('src');
  const files = [];

  function walk(current) {
    for (const item of fs.readdirSync(current)) {
      const full = path.join(current, item);
      if (fs.statSync(full).isDirectory()) {
        if (!full.includes('node_modules') && !full.includes('locales')) walk(full);
      } else if (full.endsWith('.tsx') || full.endsWith('.ts')) {
        files.push(full);
      }
    }
  }

  walk(dir);

  let total = 0;
  const resultsByFile = {};

  for (const file of files) {
    const list = scanFile(file);
    if (list.length > 0) {
      const rel = path.relative(process.cwd(), file);
      resultsByFile[rel] = list;
      total += list.length;
    }
  }

  console.log(`Found ${total} untranslated strings across ${Object.keys(resultsByFile).length} files:`);
  for (const [f, items] of Object.entries(resultsByFile)) {
    console.log(`\n--- ${f} (${items.length} items) ---`);
    for (const item of items.slice(0, 10)) {
      console.log(`  L${item.line} [${item.type}]: ${item.text.slice(0, 70)}`);
    }
    if (items.length > 10) {
      console.log(`  ... and ${items.length - 10} more`);
    }
  }
}

run();
