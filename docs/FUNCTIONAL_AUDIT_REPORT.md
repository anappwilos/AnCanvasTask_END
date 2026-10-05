# AnTaskCanvas Functional Audit

Detailed functional audit report of the `AnTaskCanvas` repository, based exclusively on the current codebase.

---

## Specific Feature Audit

### `TASKS.md` Import
- **Status**: `WORKING`
- **File(s)**: `App.tsx`, `markdownSync.ts`
- **Explanation**: The markdown text is injected as the base state (`markdownInput`) and processed.
- **Limitations**: Assumes specific project formatting; if the document is highly dissimilar, it may display warnings.

### Markdown Parsing
- **Status**: `WORKING`
- **File(s)**: `markdownSync.ts`
- **Explanation**: The `scanTaskBlocks` function processes text lines and builds logical ASTs, extracting subtasks and metadata.
- **Limitations**: Heavily reliant on regular expressions to detect `- [ ]` tags.

### File Sanitization / Normalization
- **Status**: `WORKING`
- **File(s)**: `markdownNormalizer.ts`
- **Explanation**: Uses `unified`, `remark-parse`, and `remark-gfm` to standardize the document. Categorizes changes into safe formatting, structural, additions, or deletions.
- **Limitations**: Aggressive restructuring may occur if non-GFM supported syntax is used.

### Markdown Export
- **Status**: `WORKING`
- **File(s)**: `markdownSync.ts`, `App.tsx`
- **Explanation**: Any change in the Canvas or Kanban regenerates the Markdown text string via utilities like `updateTaskInMarkdown`.
- **Limitations**: Done by concatenating text over the original parsing to avoid destroying unknown metadata.

### Canvas
- **Status**: `WORKING`
- **File(s)**: `App.tsx`, `shapes/TaskShapeUtil.tsx`
- **Explanation**: Full integration with `tldraw` to interact with tasks and group them visually.
- **Limitations**: Performance may drop if thousands of shapes are rendered simultaneously.

### Kanban
- **Status**: `WORKING`
- **File(s)**: `KanbanBoard.tsx`
- **Explanation**: Column view grouped by `status` or `sections`, extracting content from `allTasks`.
- **Limitations**: Only two grouping modes currently available (statuses or predefined sections).

### Task Editing / Creation / Deletion
- **Status**: `WORKING`
- **File(s)**: `markdownSync.ts`
- **Explanation**: `updateTaskInMarkdown`, `addTaskToMarkdown`, and `deleteTaskFromMarkdown` methods are fully operational.
- **Limitations**: Deletion requires visual UI confirmation to prevent cascading dependency loss.

### Drag & Drop
- **Status**: `WORKING`
- **File(s)**: `KanbanBoard.tsx`
- **Explanation**: Uses native DOM API (`onDragStart`, `onDrop`) to move task cards between columns.
- **Limitations**: Lacks complex fluid animations (relies on standard browser implementation).

### Filters & Search
- **Status**: `WORKING`
- **File(s)**: `FilterBar.tsx`, `filterStore.ts`, `searchHighlight.tsx`
- **Explanation**: Global advanced filtering state (by priority, status) and literal text highlighting on screen.
- **Limitations**: Search is strictly plain text (no semantic or fuzzy search).

### Persistence & Reload Recovery
- **Status**: `WORKING`
- **File(s)**: `workspaceService.ts`, `App.tsx`
- **Explanation**: Retains the state of documents, settings, and recent views.
- **Limitations**: Limited by the browser's storage capacity and retention policies.

### LocalStorage / IndexedDB / Local State
- **Status**: `PARTIAL`
- **File(s)**: `settingsService.ts`, `App.tsx`
- **Explanation**: `localStorage` is widely used for settings, history, and temporary caches (`antask_recent_tasks`).
- **Limitations**: `IndexedDB` is **NOT** explicitly or deeply implemented; all persistence relies on `localStorage`.

### Sanity Integration
- **Status**: `WORKING`
- **File(s)**: `sanityService.ts`, `SanityStudio.tsx`, schemas in `sanity/`
- **Explanation**: Can synchronize visual state and interact as a headless CMS.
- **Limitations**: Requires the user to provide their own Project ID and log in externally.

### Real-Time Synchronization
- **Status**: `EXPERIMENTAL`
- **File(s)**: `sanityService.ts` (`subscribeToSanityLiveChanges`)
- **Explanation**: Listeners exist to handle bidirectional mutations in Sanity.
- **Limitations**: Subject to network latency and state collisions if multiple users edit the same document heavily at once.

### GitHub OAuth
- **Status**: `NOT IMPLEMENTED`
- **File(s)**: `GitHubSyncModal.tsx`
- **Explanation**: Instead, it manually requests a Personal Access Token (PAT).
- **Limitations**: Higher user friction as it lacks a generic "Login with GitHub" button.

### GitHub Repository Connection (Import / Export)
- **Status**: `WORKING`
- **File(s)**: `GitHubSyncModal.tsx`
- **Explanation**: Via the PAT, it can read (import) repo content and push commits (export) to it.
- **Limitations**: Limited by the targeted branches and the scopes of the provided token.

### Automatic Commits
- **Status**: `NOT IMPLEMENTED`
- **File(s)**: `GitHubSyncModal.tsx`
- **Explanation**: Committing is a manual process where the user must provide a commit message (`commitMessage`).
- **Limitations**: No continuous or silent background saving to GitHub.

### PWA / Offline
- **Status**: `PARTIAL`
- **File(s)**: `main.tsx`, `index.html`, `App.tsx`
- **Explanation**: Basic `serviceWorker` registration, manifest, and event listeners in `App.tsx` to notify when connection is lost.
- **Limitations**: It's a basic PWA; if the service worker isn't aggressively caching bundles or external network calls, offline mode might fail.

### i18n
- **Status**: `WORKING`
- **File(s)**: `LanguageSelector.tsx`, `locales/` folder, `App.tsx`
- **Explanation**: Successfully implemented using `@lingui/react`, covering multiple languages.
- **Limitations**: Translations might not be perfect if machine-generated or missing keys.

### Light/Dark Theme
- **Status**: `WORKING`
- **File(s)**: `App.tsx`, `settingsService.ts`
- **Explanation**: Native handling by injecting `data-theme` attributes, synced with system or user preferences.
- **Limitations**: N/A. Fully implemented.

---

## Final Output

### Confirmed Features
- Parsing, safe sanitization, editing, and real export of `TASKS.md` format.
- Fully interactive views: Infinite Canvas (using tldraw) and Kanban board with drag & drop.
- Advanced filtering and search with text highlighting.
- Robust local persistence based on LocalStorage.
- Full internationalization (i18n) and aesthetic support (light/dark modes, accessibility).
- Connection and import/export capabilities with remote GitHub repositories using Personal Access Tokens (PAT).
- Configured database / remote CMS integration with Sanity.

### Partial Features
- PWA / Offline: Infrastructure exists (serviceWorker, network detection), but primarily works at the UI level without absolute guarantees of deferred remote saving.
- Real-time Synchronization: Sanity listeners exist in the code, but their nature is experimental and network-dependent.

### Unimplemented Features
- IndexedDB (relies on LocalStorage).
- Seamless GitHub OAuth flow (uses static authentication via PAT).
- Automatic background commits to GitHub (always requires human action/confirmation).

### Safe Claims for Submission
- "AnTaskCanvas interprets, edits, and consolidates Markdown code in real-time, reflecting progress in both an infinite Canvas and a Kanban board."
- "Allows safe normalization of `TASKS.md` files while preserving critical developer metadata."
- "Offers a rich experience with multiple languages (i18n), customizable aesthetic themes, and built-in accessibility."
- "Handles offline-first persistence by storing branch information locally in the browser."
- "Features native integration with the GitHub API (via Tokens) to consolidate changes directly, as well as connection to the Sanity CMS."

### Claims We Must NOT Make
- "One-click automatic login and linking via GitHub OAuth."
- "Your tasks sync automatically and silently to GitHub without you doing anything."
- "Features robust local database storage based on IndexedDB."
- "Perfect real-time collaborative editing guaranteed without conflicts." (Avoid promising flawless multiplayer collaboration).
