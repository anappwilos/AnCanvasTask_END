# AnTaskCanvas

A visual and interactive organizer for `TASKS.md` files for developers. It integrates an infinite canvas (`tldraw`), a column-based Kanban board, and a real-time synchronized Markdown editor.

---

## Key Features

- **Infinite Canvas & Kanban**: Bidirectional visualization of tasks with drag-and-drop, dependency connections (`blockedBy`), statuses, and priorities (`P0`-`P3`).
- **Markdown AST Synchronization**: Deterministic parsing and serialization with loss prevention and safe normalization.
- **Workspaces & Git**: Management of multiple branches and `TASKS.md` documents per directory (`frontend/`, `backend/`, `packages/ui/`).
- **Sanity Studio Integration**: Optional bidirectional persistence with native schemas and an embedded viewer.
- **Modern Internationalization (i18n)**: Compiler-first architecture based on LinguiJS with automatic extraction, auto-generated hash IDs, and typed catalogs.

---

## Prerequisites

- Node.js >= 18
- npm >= 9

---

## Installation and Execution

```bash
# Install dependencies
npm install

# Start development server at http://localhost:3000
npm run dev

# Build for production
npm run build

# Validate TypeScript types
npm run lint
```

---

## Internationalization Architecture (i18n)

The project uses a compiler-first system with LinguiJS. Developers work directly with readable source text (in Spanish), without manually defining semantic keys (`t("tasks.delete")`) or hand-editing dictionaries.

### Workflow

```text
Readable source text in TSX/TS
  → Automatic extraction (npm run i18n:extract)
  → Auto-generated deterministic ID (6-character hash)
  → Generated catalogs (src/locales/{locale}/messages.json)
  → Translation by locale
  → Optimized compilation (npm run i18n:compile)
```

### i18n Commands

| Command | Description |
| :--- | :--- |
| `npm run i18n:extract` | Inspects source code, generates deterministic IDs, and updates `messages.json` files. |
| `npm run i18n:compile` | Compiles catalogs into optimized JS bundles for production. |
| `npm run i18n:check` | Strict compilation validation (`lingui compile --strict`) suitable for CI. |
| `npm run i18n` | Runs extraction and compilation in a single step (`extract && compile`). |

### Developer Guide

#### 1. Static UI Text

```tsx
import { useLingui } from '@lingui/react';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';

function MyComponent() {
  const { _ } = useLingui();

  return (
    <div>
      {/* Option A: Macro in JSX */}
      <button title={_(msg`Guardar cambios`)}>
        <Trans>Guardar</Trans>
      </button>

      {/* Option B: Direct helper */}
      <span>{_(msg`Eliminar tarea`)}</span>
    </div>
  );
}
```

#### 2. Variables and Interpolation

```tsx
// Variables inside the string (order adapts to each language)
pushToast(_(msg`Rama "${branchName}" creada con éxito`));
```

#### 3. ICU Pluralization

```tsx
import { plural } from '@lingui/core/macro';

// Native ICU pluralization based on the active locale
const label = plural(count, {
  one: '# tarea seleccionada',
  other: '# tareas seleccionadas',
});
```

#### 4. Centralized Regional Formats

Import formatters from `src/i18n`:

```tsx
import { formatDate, formatTime, formatDateTime, formatTaskCount } from './i18n';

formatDate(date);              // Respects active locale
formatTime(date);              // Respects active locale
formatTaskCount(tasks.length); // "1 task" / "5 tasks"
```

### Configured Languages

- **Source / Fallback**: `es` (Spanish)
- **Initial Locales**: `es`, `en` (English)
- **Extensibility**: Ready for `fr`, `de`, `pt`, `it` in `src/i18n/index.ts` without altering components.

---

## Project Structure

```text
src/
├── components/       # UI Components (Modals, Kanban, SplitEditor, etc.)
├── i18n/             # Lingui initialization and Intl regional formatters
├── locales/          # Generated message catalogs (es, en)
├── services/         # Sync, workspaces, and Sanity services
├── shapes/           # tldraw canvas shapes definition (TaskCard, GroupCard)
├── utils/            # Markdown AST parsing and serialization (remark/unified)
├── App.tsx           # Root application container
└── main.tsx          # Entry point and global Error Boundary
```
