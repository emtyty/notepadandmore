# Phase 5 E2E Test Plan — Sidebar, File Watching & Recent Files

**App:** Notepad and More (Electron + React + Monaco Editor)
**Phase:** 5 — Sidebar panels, file watching, recent files
**Test framework:** Playwright (`@playwright/test`) + `playwright` Electron integration
**Test directory:** `tests/`
**Estimated total scenarios:** 35
**Last updated:** 2026-03-25

---

## Setup notes

All tests use the extended fixture from `tests/fixtures.ts` which:
- Launches `out/main/index.js` with `E2E_TEST=1` (bypasses session restore and close handler)
- Waits for `[data-testid="app"]`, `.monaco-editor textarea`, and `[data-testid="tabbar"] [data-tab-title]` before handing the page to each test

Tests that need both `electronApp` and `page` (for IPC + DOM assertions) must extend the fixture as follows:

```ts
import { test as base, expect } from './fixtures'
import { _electron as electron, ElectronApplication } from 'playwright'
import path from 'path'
import os from 'os'
import fs from 'fs'

const test = base.extend<{ electronApp: ElectronApplication }>({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../out/main/index.js')],
      env: { ...process.env, E2E_TEST: '1', NODE_ENV: 'test' },
      timeout: 15_000,
    })
    await use(app)
    await app.close()
  },
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="app"]', { timeout: 10_000 })
    await page.waitForSelector('.monaco-editor textarea', { timeout: 10_000 })
    await page.waitForSelector('[data-testid="tabbar"] [data-tab-title]', { timeout: 5_000 })
    await use(page)
  },
})
```

**IPC helper snippet** (used throughout):

```ts
async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...a),
    { ch: channel, a: args }
  )
}
```

**CSS Modules warning:** All component class names are hashed at build time. Never target them directly. Use only `data-testid`, `title`, `text`, ARIA roles, and stable Monaco classes (`.monaco-editor`, `.monaco-editor textarea`).

---

## Feature 1: Sidebar Visibility

**Estimated scenarios: 5**

---

### Scenario 1: Sidebar is hidden by default on startup

**Preconditions:** Fresh app launch with `E2E_TEST=1`.

**Steps:**
1. Wait for `[data-testid="app"]` to be visible.
2. Query `[data-testid="sidebar"]`.

**Expected result:** The sidebar element is either absent from the DOM or has `display: none` / zero dimensions. `toBeVisible()` should fail — use `not.toBeVisible()`.

**Notes:** Confirmed by `uiStore.ts` initial state: `showSidebar: false`. The `seed.spec.ts` already covers this — do not duplicate; instead rely on it as a baseline guard.

---

### Scenario 2: Sidebar shows when toggled visible via IPC

**Preconditions:** App launched. Sidebar is initially hidden.

**Steps:**
1. Send IPC: `ui:toggle-sidebar` with argument `true`.
2. Wait up to 2 s for `[data-testid="sidebar"]` to be visible.

**Expected result:**
- `[data-testid="sidebar"]` is visible.
- Default tab active is "files" (icon `📁` button should have active styling — verify by checking `title="File Browser"` button is present).

**Notes:** `App.tsx` line 63 wires this channel directly to `useUIStore.getState().setShowSidebar(args[0])`. No debounce; DOM update should be immediate after React re-render (~16 ms).

---

### Scenario 3: Sidebar hides when toggled off via IPC

**Preconditions:** Sidebar is currently visible (use Scenario 2 as setup).

**Steps:**
1. Send IPC: `ui:toggle-sidebar` with argument `true` (show).
2. Assert `[data-testid="sidebar"]` is visible.
3. Send IPC: `ui:toggle-sidebar` with argument `false`.
4. Wait for `[data-testid="sidebar"]` to not be visible.

**Expected result:** Sidebar is no longer visible in the DOM.

**Notes:** The IPC payload is a boolean, not a toggle. Always pass the explicit desired state.

---

### Scenario 4: Close button (✕) hides the sidebar

**Preconditions:** Sidebar is visible.

**Steps:**
1. Send IPC: `ui:toggle-sidebar` with argument `true`.
2. Assert sidebar is visible.
3. Click the button with `title="Close Sidebar"` inside `[data-testid="sidebar"]`.
4. Wait for sidebar to not be visible.

**Expected result:** Sidebar is hidden. The ✕ button calls `setShowSidebar(false)` in the store.

**Notes:** The close button selector is `[data-testid="sidebar"] button[title="Close Sidebar"]`. Do not rely on button text content (✕ is a Unicode character that may render differently).

---

### Scenario 5: Switching sidebar tabs renders the correct panel

**Preconditions:** Sidebar is visible, default panel is "files".

**Steps:**
1. Show sidebar via IPC.
2. Click `[data-testid="sidebar"] button[title="Project"]`.
3. Assert "Project" panel header text "Project" is visible.
4. Click `[data-testid="sidebar"] button[title="Document Map"]`.
5. Assert "Document Map" panel header text is visible.
6. Click `[data-testid="sidebar"] button[title="Function List"]`.
7. Assert "Functions" panel header text is visible.
8. Click `[data-testid="sidebar"] button[title="File Browser"]`.
9. Assert file browser "Open Folder…" button or folder header is visible.

**Expected result:** Each tab click renders exactly one panel; the previous panel is unmounted or hidden.

**Notes:** Panel header texts are plain DOM text nodes inside the component headers. Use `page.getByText('Document Map', { exact: true })` scoped to `[data-testid="sidebar"]` to avoid collisions with other UI text.

---

## Feature 2: File Browser Panel

**Estimated scenarios: 8**

---

### Scenario 6: "Open Folder…" button and empty state when no workspace is set

**Preconditions:** Sidebar visible, "File Browser" tab active, no `workspaceFolder` set.

**Steps:**
1. Show sidebar via IPC (`ui:toggle-sidebar`, `true`).
2. Confirm the "File Browser" tab is active (it is the default: `sidebarPanel: 'files'`).
3. Assert text "Open a folder to browse files." is visible within `[data-testid="sidebar"]`.
4. Assert a button with text "Open Folder…" is visible.

**Expected result:** The "no workspace" empty state is rendered. No file tree is present.

**Notes:** The `FileBrowserPanel` renders this empty state when `workspaceFolder` is `null` (initial store value). The "Open Folder…" button triggers `window.api.file.openDirDialog()` — do not click it in automated tests as it opens a native OS dialog.

---

### Scenario 7: File tree renders after workspace folder set via IPC [requires temp dir]

**Preconditions:** Sidebar visible, File Browser tab active, no workspace set.

**Steps:**
1. Create a temporary directory with at least one file and one subdirectory using `fs.mkdtempSync` in the test.
2. Create files: `hello.txt` (content: "hello") and subdirectory `subdir/`.
3. Send IPC: `menu:folder-open` with the temp directory path as argument.
4. Wait up to 3 s for the folder name to appear as header text in the sidebar.
5. Assert a row with text "hello.txt" is visible.
6. Assert a row with text "subdir" is visible.
7. Clean up temp directory in `afterAll`.

**Expected result:** The file tree shows directories before files (sorted). Folder icons (`📁`) precede directory names; file-type icons precede filenames.

**Notes:** `menu:folder-open` IPC is handled in `App.tsx` (line 54–58): it sets `workspaceFolder`, shows the sidebar, and switches to the `'files'` panel — all three effects should be visible. The tree rows have no `data-testid`; match by visible text content. Use `page.locator('[data-testid="sidebar"]').getByText('hello.txt')`.

---

### Scenario 8: Clicking a file in the tree opens it in the editor [SKIP — native dialog]

**Preconditions:** Workspace folder set, file tree visible with at least one `.txt` file.

**Steps:**
1. Set workspace to a temp dir containing `test.txt`.
2. Click the row showing `test.txt` in the sidebar.
3. Wait for a new tab with title `test.txt` to appear in the tabbar.
4. Assert the new tab is active.

**Expected result:** A new buffer opens in the editor for `test.txt`. `[data-tab-title="test.txt"]` is visible.

**Notes:** `FileBrowserPanel` calls `openFiles([node.path])` on click (not double-click; single-click opens files). The `handleOpen` handler is shared between single-click and double-click. This test does NOT require a dialog — the path is injected via IPC and the file already exists on disk.

**Important:** Remove `[SKIP]` label since this does not require a native dialog. The workspace is set programmatically. Mark only the `handleOpenFolder` button click as `[SKIP — native dialog]`.

---

### Scenario 9: Folder expand/collapse in file tree [requires temp dir]

**Preconditions:** Workspace set to a temp dir containing a subdirectory `subdir/` with file `inner.txt`.

**Steps:**
1. Set workspace via IPC.
2. Wait for tree to render.
3. Assert `inner.txt` is not visible (subdirectory collapsed).
4. Click the row showing `subdir` (collapse arrow `▸`).
5. Wait for `inner.txt` row to appear.
6. Assert the folder icon changes to `📂` (open) and arrow shows `▾`.
7. Click `subdir` again.
8. Assert `inner.txt` is no longer visible.

**Expected result:** Directory rows toggle expand/collapse on single click. Children are lazy-loaded via `window.api.file.listDir` on first expansion.

**Notes:** The collapse state is tracked via a `Set<string>` in component state. After collapse, child DOM nodes may remain in the virtual tree but be hidden by the React conditional render `node.isDir && expanded.has(node.path) && node.children?.map(...)`. Check visibility with `not.toBeVisible()`.

---

### Scenario 10: Refresh button reloads the tree [requires temp dir]

**Preconditions:** Workspace set. Tree displayed with initial contents.

**Steps:**
1. Set workspace to a temp dir with `initial.txt`.
2. Wait for tree to render and verify `initial.txt` is visible.
3. Use `fs.writeFileSync` to add a new file `new-file.txt` to the temp dir.
4. Click the Refresh button (`button[title="Refresh"]`) in the File Browser header.
5. Wait for `new-file.txt` to appear in the tree.

**Expected result:** `new-file.txt` row is visible after refresh. The full root-level tree is reloaded.

**Notes:** The Refresh button selector is `[data-testid="sidebar"] button[title="Refresh"]`.

---

### Scenario 11: Right-click context menu appears on file row [requires temp dir]

**Preconditions:** Workspace set. Tree shows at least one file.

**Steps:**
1. Set workspace to a temp dir with `target.txt`.
2. Right-click the `target.txt` row.
3. Assert the context menu is visible.
4. Assert menu items include: "Open", "New File…", "New Folder…", "Rename", "Delete", "Copy Path", "Reveal in Finder" (macOS) or "Reveal in Explorer" (Windows).

**Expected result:** Context menu appears at the cursor position. All expected items are present.

**Notes:** Use `page.locator('[data-testid="sidebar"]').getByText('target.txt').click({ button: 'right' })`. The context menu has no `data-testid`; match items by button text. Platform-aware label: `window.api.platform === 'darwin'` renders "Reveal in Finder" vs "Reveal in Explorer".

---

### Scenario 12: Right-click context menu on folder row omits "Open" item [requires temp dir]

**Preconditions:** Workspace set. Tree shows a subdirectory.

**Steps:**
1. Right-click a directory row in the tree.
2. Assert menu items visible: "New File…", "New Folder…", "Rename", "Delete", "Copy Path", "Reveal in …".
3. Assert "Open" item is NOT present.

**Expected result:** The "Open" context item is file-only (`!contextMenu.node.isDir` guard in `FileBrowserPanel`).

---

### Scenario 13: Context menu closes on outside click [requires temp dir]

**Preconditions:** Context menu is open on a file row.

**Steps:**
1. Open context menu on `target.txt` via right-click.
2. Assert context menu is visible.
3. Click anywhere outside the context menu (e.g., the editor area).
4. Assert context menu is no longer visible.

**Expected result:** The `mousedown` outside handler removes the context menu from the DOM.

**Notes:** The handler is `document.addEventListener('mousedown', handler)` — use `page.mouse.click(x, y)` on a safe region outside the sidebar.

---

## Feature 3: Project Panel

**Estimated scenarios: 3**

---

### Scenario 14: Project panel shows empty state with "Open Folder…" button

**Preconditions:** Sidebar visible, "Project" tab active, no workspace folder set.

**Steps:**
1. Show sidebar via IPC.
2. Click `button[title="Project"]` in sidebar tab bar.
3. Assert text "No workspace folder open." is visible within `[data-testid="sidebar"]`.
4. Assert button with text "Open Folder…" is visible.

**Expected result:** Empty state renders correctly when `workspaceFolder` is `null`.

**Notes:** The "Open Folder…" button calls `window.api.file.openDirDialog()` — do not click it in tests.

---

### Scenario 15: Project panel shows folder name when workspace is set [requires temp dir]

**Preconditions:** A workspace folder has been set via IPC. "Project" tab is active.

**Steps:**
1. Create a temp directory named to have a recognizable last segment (e.g., `my-project-XXXXX`).
2. Send IPC: `menu:folder-open` with the temp dir path.
3. Click `button[title="Project"]` in the sidebar tab bar (sidebar auto-switches to "files"; manually switch back to "project").
4. Assert the folder name (last path segment) is visible as text within `[data-testid="sidebar"]`.
5. Assert a `…` button is visible (the "Change folder" button).

**Expected result:** `ProjectPanel` renders the folder's basename. The full path is available as a `title` tooltip on the span.

**Notes:** `ProjectPanel` uses `.split('/').pop()` to extract the basename. The `menu:folder-open` handler switches to the "files" panel automatically; the test must click the "Project" tab again afterward.

---

### Scenario 16: Project panel "Open Folder…" button triggers dialog [SKIP — native dialog]

**Preconditions:** Project panel visible, no workspace set.

**Steps:**
1. Click the "Open Folder…" button.
2. *(Native OS dialog opens — cannot be automated.)*

**Expected result:** Native directory picker dialog is shown.

**Notes:** Skipped. The button calls `window.api.file.openDirDialog()` which invokes Electron's `dialog.showOpenDialog`. No programmatic way to interact with the OS dialog in Playwright.

---

## Feature 4: Document Map Panel

**Estimated scenarios: 4**

---

### Scenario 17: Document Map panel renders a Monaco editor instance

**Preconditions:** Sidebar visible, "Document Map" tab active.

**Steps:**
1. Show sidebar via IPC.
2. Click `button[title="Document Map"]` in the sidebar tab bar.
3. Wait up to 3 s for a second `.monaco-editor` to appear inside `[data-testid="sidebar"]`.
4. Assert it is visible.

**Expected result:** A read-only miniaturized Monaco editor instance is mounted inside the Document Map container. There should be exactly 2 `.monaco-editor` elements in the document (main editor + map editor).

**Notes:** The `DocumentMapPanel` creates a Monaco editor via `monaco.editor.create()` on mount. It shares the same `ITextModel` as the active buffer — the model is not duplicated. The map editor has `readOnly: true`, `fontSize: 2`, and `lineNumbers: 'off'`. Use `page.locator('[data-testid="sidebar"] .monaco-editor')` to scope the assertion.

---

### Scenario 18: Document Map reflects main editor content

**Preconditions:** Sidebar visible, Document Map tab active. Main editor has some text.

**Steps:**
1. Show sidebar, switch to Document Map tab.
2. Click `.monaco-editor textarea` (main editor).
3. Type several lines of text: `"function hello() {\n  return 42;\n}"`.
4. Assert the Document Map Monaco instance is non-empty (check that it has more than zero lines rendered via `page.locator('[data-testid="sidebar"] .monaco-editor .view-lines').count()` > 0 or similar).

**Expected result:** The Document Map renders the same text as the main editor because it uses the identical `ITextModel` instance (`buf.model`). Changes are reflected immediately without any IPC round-trip.

**Notes:** Because the model is shared (not copied), any change in the main editor is automatically visible in the map. There is no need to wait for a sync event.

---

### Scenario 19: Document Map is read-only (keyboard input rejected)

**Preconditions:** Document Map panel visible with content.

**Steps:**
1. Show sidebar, switch to Document Map tab.
2. Type text in the main editor.
3. Attempt to click the Document Map's `.monaco-editor textarea` and type text.
4. Assert the main editor's content remains unchanged (the map editor is `readOnly: true`).

**Expected result:** No content is added to the model from the map editor. The map editor rejects keyboard input silently.

**Notes:** In `readOnly` mode Monaco silently discards keystrokes. This is a regression-guard test.

---

### Scenario 20: Clicking Document Map scrolls main editor to that line

**Preconditions:** Main editor has 50+ lines of content, Document Map visible.

**Steps:**
1. Open a file with many lines (create a temp file with 60 lines, open via IPC-injected path).
2. Show sidebar, switch to Document Map tab.
3. Click near the bottom of the Document Map Monaco instance.
4. Assert that the main editor's visible range has changed (cursor position reported in statusbar has a higher line number than 1).

**Expected result:** `mapEditor.onMouseDown` calls `mainEditor.revealLineInCenter(lineNumber)` and moves the cursor. The `[data-testid="cursor-position"]` statusbar element should show a line number greater than 1.

**Notes:** Use `page.locator('[data-testid="cursor-position"]')` and `toContainText` with a regex like `/Ln [2-9]\d|Ln [1-9]\d+/` to assert the line changed. The exact line number depends on where the click lands in the map.

---

## Feature 5: Function List Panel

**Estimated scenarios: 5**

---

### Scenario 21: Function List shows "No symbols found." for plain text

**Preconditions:** Sidebar visible, "Function List" tab active. Active buffer is an untitled plain-text file (language: "plaintext").

**Steps:**
1. Show sidebar via IPC.
2. Click `button[title="Function List"]` in the sidebar tab bar.
3. Assert text "No symbols found." is visible within `[data-testid="sidebar"]`.

**Expected result:** The empty state message renders because Monaco's `DocumentSymbolProviderRegistry` has no provider registered for `plaintext` models.

---

### Scenario 22: Function List shows symbols for a JavaScript file [requires temp file]

**Preconditions:** Sidebar visible, Function List tab active. A `.js` file is open in the editor with function declarations.

**Steps:**
1. Create a temp file `symbols.js` with content:
   ```js
   function alpha() {}
   function beta() { return 1; }
   class MyClass { constructor() {} }
   ```
2. Open the file via the `menu:folder-open` + file tree click, or inject directly using `window.api.file.open` IPC if available.
3. Wait for the tab `symbols.js` to be active.
4. Show sidebar, switch to "Function List" tab.
5. Wait up to 3 s for symbol rows to appear.
6. Assert rows with text "alpha", "beta", and "MyClass" are visible.

**Expected result:** Monaco's built-in JavaScript language worker provides `DocumentSymbol` results. The `FunctionListPanel` renders one `SymbolRow` per symbol with the appropriate icon (e.g., `ƒ` for functions, `C` for classes).

**Notes:** Symbol resolution is async (via `getSymbols(buf.model)`) with a 500 ms debounce on content change. After opening the file, wait at least 600 ms or poll for text visibility before asserting. Use `page.waitForSelector` with a text filter or `expect(locator).toBeVisible({ timeout: 3000 })`.

---

### Scenario 23: Function List refreshes on content change [requires temp file]

**Preconditions:** A `.js` file is open and Function List shows existing symbols.

**Steps:**
1. Open `symbols.js` with `function alpha() {}`.
2. Show sidebar, switch to "Function List" tab.
3. Wait for "alpha" symbol row.
4. Click main editor textarea and add a new function: type `\nfunction gamma() {}` at end.
5. Wait 700 ms for the debounced refresh (500 ms debounce + render time).
6. Assert "gamma" symbol row is now visible.

**Expected result:** `buf.model.onDidChangeContent` fires the debounced `refresh()` call, adding the new symbol.

**Notes:** Use `page.waitForTimeout(700)` or poll with `expect(locator).toBeVisible({ timeout: 2000 })`.

---

### Scenario 24: Clicking a symbol row scrolls the editor to that line [requires temp file]

**Preconditions:** A `.js` file with multiple functions is open. Function List shows symbols.

**Steps:**
1. Open a temp `.js` file where `function omega() {}` is on line 30+.
2. Show sidebar, switch to "Function List" tab.
3. Wait for "omega" symbol row to appear.
4. Click the "omega" row.
5. Assert `[data-testid="cursor-position"]` shows `Ln 30` (or the actual line number).

**Expected result:** `handleClick` calls `editor.revealLineInCenter(node.range.startLineNumber)` and `editor.setPosition(...)`. The statusbar cursor position updates to the symbol's line.

---

### Scenario 25: Refresh button re-fetches symbols

**Preconditions:** Function List panel visible with a `.js` file active.

**Steps:**
1. Open a temp `.js` file with `function alpha() {}`.
2. Show sidebar, Function List tab active. Symbol "alpha" is visible.
3. Programmatically modify the file on disk (write new content with `function delta() {}`).
4. Click Reload from the menu (send IPC `menu:file-reload`).
5. Click `button[title="Refresh"]` in the Function List header.
6. Wait for "delta" to appear, assert "alpha" is gone.

**Expected result:** Manual refresh re-runs `getSymbols()` against the current model. "Refresh" button selector: `[data-testid="sidebar"] button[title="Refresh"]`.

---

## Feature 6: File Watching

**Estimated scenarios: 6**

---

### Scenario 26: External change on a clean buffer triggers auto-reload and toast

**Preconditions:** A real file is open (not untitled). The buffer is clean (not dirty). File watching is active.

**Steps:**
1. Create a temp file `watched.txt` with content `"version 1"`.
2. Open the file via IPC (send `menu:folder-open` for its parent then click, or use a direct path injection mechanism).
3. Assert tab `watched.txt` is active and not dirty.
4. Send IPC: `file:externally-changed` with the full path of `watched.txt`.
5. Wait up to 2 s for a toast notification to appear.
6. Assert toast text contains `"reloaded (external change)"`.

**Expected result:** `App.tsx` handler (line 81–90): because `buf.isDirty` is `false`, it calls `reloadBuffer(buf.id)` and then `addToast('"watched.txt" reloaded (external change)', 'info')`. The toast element should be visible in the DOM.

**Notes:** The toast selector needs investigation — look for a `[data-testid="toast"]` or a toast container. If no `data-testid` exists, use `page.getByText('reloaded (external change)')`. Toast auto-dismisses after 4000 ms; assert within 2 s of sending the IPC.

---

### Scenario 27: External change on a dirty buffer shows "changed on disk" warning toast

**Preconditions:** A real file is open and has been modified (dirty state).

**Steps:**
1. Create and open `watched-dirty.txt`.
2. Click the editor textarea and type any character to mark the buffer dirty.
3. Assert `[data-tab-dirty="true"]` is visible for the tab.
4. Send IPC: `file:externally-changed` with the file path.
5. Wait up to 2 s for a warning toast.
6. Assert toast text contains `"changed on disk. Use Reload to update."`.

**Expected result:** When `buf.isDirty` is `true`, the handler does NOT auto-reload. It emits a `'warn'` level toast instead. The buffer content remains as typed by the user.

**Notes:** The exact toast message is `'"watched-dirty.txt" changed on disk. Use Reload to update.'` The title is `buf.title` (the file's basename).

---

### Scenario 28: External change on a file not open in editor is silently ignored

**Preconditions:** App running with an untitled buffer (no file path set).

**Steps:**
1. Do NOT open any file — use the default untitled "new 1" buffer.
2. Send IPC: `file:externally-changed` with an arbitrary path `/tmp/not-open.txt`.
3. Wait 1 s.
4. Assert no toast notification appears.

**Expected result:** The handler calls `.find((b) => b.filePath === fp)` which returns `undefined` for the untitled buffer; the early return prevents any action.

---

### Scenario 29: External deletion shows a warning toast

**Preconditions:** A real file is open and clean.

**Steps:**
1. Create and open `to-delete.txt`.
2. Assert the file tab is active.
3. Send IPC: `file:externally-deleted` with the file path.
4. Wait up to 2 s for a toast notification.
5. Assert toast text contains `"was deleted from disk."`.

**Expected result:** `App.tsx` line 92–95: `addToast('"to-delete.txt" was deleted from disk.', 'warn')`. The tab remains open (deletion does not auto-close the buffer).

**Notes:** The file watcher in `watchHandlers.ts` also removes the path from the `watchers` map on `unlink`, but since we are injecting the event via IPC directly (bypassing chokidar), this cleanup does not apply in this test.

---

### Scenario 30: External deletion on a file not open is silently ignored

**Preconditions:** App running. No files with the target path are open.

**Steps:**
1. Send IPC: `file:externally-deleted` with path `/tmp/ghost-file.txt`.
2. Wait 1 s.
3. Assert no toast appears.

**Expected result:** The `.find()` returns `undefined`; `if (buf)` guard prevents the toast.

---

### Scenario 31: File watcher is registered via `watch:add` IPC [integration check]

**Preconditions:** A real file is open.

**Steps:**
1. Create a temp file `watcher-test.txt`.
2. Open the file (so the renderer calls `watch:add` during open).
3. Use the Electron `app.evaluate` to inspect that `watchers` map contains the path — OR:
4. Modify the file on disk: `fs.writeFileSync(filePath, 'new content')`.
5. Wait up to 3 s for the "reloaded (external change)" toast to appear naturally (chokidar detects the change).

**Expected result:** The chokidar watcher fires and the renderer receives and handles the `file:externally-changed` event. Toast confirms the reload.

**Notes:** This is an integration test relying on real filesystem events — timing may vary. Use a generous `await page.waitForSelector(toastSelector, { timeout: 5000 })`. Set `awaitWriteFinish.stabilityThreshold: 300` means chokidar waits 300 ms after the last write before firing; allow 1–2 s total.

---

## Feature 7: Recent Files

**Estimated scenarios: 4**

---

### Scenario 32: `file:get-recents` IPC returns an array

**Preconditions:** App running (fresh `E2E_TEST=1` launch). `recentFiles.json` may or may not exist in `~/.config/notepad-and-more/config/`.

**Steps:**
1. Call `file:get-recents` from the renderer via `window.api.file.getRecents()`, or invoke from the main process via:
   ```ts
   const recents = await electronApp.evaluate(({ ipcMain }) =>
     // cannot directly invoke; use webContents.executeJavaScript instead:
   )
   ```
   Alternatively: `page.evaluate(() => window.api.file.getRecents())`.
2. Assert the return value is an array.
3. Assert each element is a string (file path).

**Expected result:** The IPC handler (`fileHandlers.ts` line 125) returns `loadRecents()` which always returns `string[]` (empty array on first run, never throws).

**Notes:** Use `page.evaluate(async () => window.api.file.getRecents())` to invoke from renderer context where `window.api` is available.

---

### Scenario 33: Opening a file adds it to the recents list [requires temp file]

**Preconditions:** A temp file `recent-test.txt` exists. App running.

**Steps:**
1. Record the recents list before: `const before = await page.evaluate(() => window.api.file.getRecents())`.
2. Open `recent-test.txt` (inject path via IPC or file tree).
3. Wait for the tab to become active.
4. Record the recents list after: `const after = await page.evaluate(() => window.api.file.getRecents())`.
5. Assert `after[0] === '/path/to/recent-test.txt'`.
6. Assert `after.length === before.length + 1` (or same if already in list).

**Expected result:** `addRecent(filePath)` is called during file open (in `fileHandlers.ts`). The path is prepended to the list. The list is capped at 15 items.

**Notes:** `addRecent` deduplicates: if the file was already in the list, it moves to position 0 without increasing length.

---

### Scenario 34: Recent files list is capped at 15 entries [requires setup]

**Preconditions:** 16 distinct temp files created.

**Steps:**
1. Create 16 temp `.txt` files.
2. Open each file sequentially.
3. After all 16 are opened, call `getRecents()`.
4. Assert `recents.length <= 15`.
5. Assert the first element is the last-opened file path.
6. Assert the path of the first-opened file is NOT in the list.

**Expected result:** `addRecent` slices the array to `RECENT_MAX = 15`. The oldest entry is dropped.

**Notes:** Opening 16 files sequentially is slow. Consider using `page.evaluate()` to call a test-only backdoor, or write directly to `recentFiles.json` in the test setup. If the file does not exist between test runs, create the config directory and seed the file manually.

---

### Scenario 35: Recent files list deduplicates on re-open [requires temp file]

**Preconditions:** `recent-file.txt` has been opened once and is in the recents list.

**Steps:**
1. Open `recent-file.txt` a first time. Record `recents1 = getRecents()`.
2. Close the tab.
3. Open a second file `other.txt` so it becomes recents[0].
4. Open `recent-file.txt` again.
5. Record `recents2 = getRecents()`.
6. Assert `recents2[0] === '/path/to/recent-file.txt'`.
7. Assert `recents2.length === recents1.length` (no duplicate added; list length unchanged).

**Expected result:** `addRecent` filters out existing entries (`current.filter((f) => f !== filePath)`) before prepending, ensuring no duplicates.

---

## Appendix: Selector Reference

| Element | Selector |
|---|---|
| App root | `[data-testid="app"]` |
| Toolbar | `[data-testid="toolbar"]` |
| Tab bar | `[data-testid="tabbar"]` |
| Specific tab | `[data-tab-title="filename"]` |
| Dirty tab | `[data-tab-dirty="true"]` |
| Dirty indicator dot | `[data-testid="dirty-dot"]` |
| Editor pane | `[data-testid="editor-pane"]` |
| Monaco editor | `.monaco-editor` |
| Monaco input target | `.monaco-editor textarea` |
| Status bar | `[data-testid="statusbar"]` |
| Cursor position | `[data-testid="cursor-position"]` |
| Sidebar container | `[data-testid="sidebar"]` |
| Bottom panel | `[data-testid="bottom-panel"]` |
| Sidebar tab: File Browser | `[data-testid="sidebar"] button[title="File Browser"]` |
| Sidebar tab: Project | `[data-testid="sidebar"] button[title="Project"]` |
| Sidebar tab: Document Map | `[data-testid="sidebar"] button[title="Document Map"]` |
| Sidebar tab: Function List | `[data-testid="sidebar"] button[title="Function List"]` |
| Sidebar close button | `[data-testid="sidebar"] button[title="Close Sidebar"]` |
| File Browser refresh | `[data-testid="sidebar"] button[title="Refresh"]` |
| Function List refresh | `[data-testid="sidebar"] button[title="Refresh"]` |
| Document Map Monaco | `[data-testid="sidebar"] .monaco-editor` |

## Appendix: IPC Channel Reference

| Channel | Direction | Payload | Effect |
|---|---|---|---|
| `ui:toggle-sidebar` | main → renderer | `boolean` | Show/hide sidebar |
| `ui:toggle-toolbar` | main → renderer | `boolean` | Show/hide toolbar |
| `ui:toggle-statusbar` | main → renderer | `boolean` | Show/hide status bar |
| `menu:folder-open` | main → renderer | `string` (folder path) | Set workspace, show sidebar, switch to files tab |
| `file:externally-changed` | main → renderer | `string` (file path) | Auto-reload or warn toast depending on dirty state |
| `file:externally-deleted` | main → renderer | `string` (file path) | Show warning toast |
| `file:get-recents` | renderer → main | — | Returns `string[]` of recent file paths |
| `watch:add` | renderer → main | `string` (file path) | Register chokidar watcher |
| `watch:remove` | renderer → main | `string` (file path) | Remove chokidar watcher |

## Appendix: Scenario Summary by Feature

| Feature | Scenarios | Estimated test count |
|---|---|---|
| 1. Sidebar Visibility | 1–5 | 5 |
| 2. File Browser Panel | 6–13 | 8 |
| 3. Project Panel | 14–16 | 3 (1 skipped) |
| 4. Document Map Panel | 17–20 | 4 |
| 5. Function List Panel | 21–25 | 5 |
| 6. File Watching | 26–31 | 6 |
| 7. Recent Files | 32–35 | 4 |
| **Total** | | **35 (1 skipped)** |
