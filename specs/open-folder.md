# Open Folder Feature — E2E Test Plan

**App:** Notepad and More (Electron + React + Monaco Editor)
**Feature:** Open Folder / File Browser Panel
**Test framework:** Playwright (`@playwright/test`) + Playwright Electron integration
**Test directory:** `tests/`
**Spec file:** `specs/open-folder.md`
**Estimated total scenarios:** 41
**Last updated:** 2026-03-27

---

## Setup Notes

All tests use the extended fixture from `tests/fixtures.ts` which:
- Launches `out/main/index.js` with `E2E_TEST=1` (bypasses session restore and close handler)
- Waits for `[data-testid="app"]`, `.monaco-editor textarea`, and `[data-testid="tabbar"] [data-tab-title]` before handing the page to each test

Tests that need both `electronApp` and `page` must use this fixture extension pattern:

```ts
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

**IPC helper** (used throughout):

```ts
async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...(a as unknown[])),
    { ch: channel, a: args }
  )
}
```

**Critical constraints:**
- Native dialogs (`dialog.showOpenDialog`) cannot be automated — bypass by sending `menu:folder-open` IPC with a pre-built temp directory path, or stub `window.api.file.openDirDialog` in the renderer.
- CSS Modules class names are hashed at build time. Never target them directly. Use `data-testid`, `title`, visible text, and ARIA roles only.
- The `file:open-dir-dialog` IPC handler lives in `src/main/ipc/searchHandlers.ts`. It must return `string | null` — not an object.
- `workspaceFolder` state lives in `useUIStore`. Initial value is `null`; sidebar's initial `showSidebar` is `false`.
- File sorting in `FileBrowserPanel`: directories appear before files, then both groups sorted alphabetically by `localeCompare`.

---

## Feature Map

| IPC / UI Entry Point | Handler | Store Action | Panel |
|---|---|---|---|
| `menu:folder-open` (from native menu or IPC) | `App.tsx` listener | `setWorkspaceFolder`, `setShowSidebar(true)`, `setSidebarPanel('files')` | `FileBrowserPanel` |
| "Open Folder…" button inside `FileBrowserPanel` (no workspace) | `handleOpenFolder` | `window.api.file.openDirDialog()` → `setWorkspaceFolder`, `setSidebarPanel('files')` | `FileBrowserPanel` |
| "Open Folder…" button inside `ProjectPanel` (no workspace) | `handleOpen` | same `openDirDialog` path | `ProjectPanel` |
| Menu: File → Open Folder… (`CmdOrCtrl+Shift+O`) | `menu.ts` native dialog | sends `menu:folder-open` | `FileBrowserPanel` |

---

## Group A: Happy-Path Scenarios

### Scenario A-1: Opening a folder via IPC renders sidebar with file tree

**Steps:**
1. Create a temp directory containing `hello.txt` and subdirectory `subdir/`.
2. Send IPC `ui:toggle-sidebar` with `true`.
3. Send IPC `menu:folder-open` with the absolute temp directory path.
4. Assert sidebar header shows the folder's basename.
5. Assert `hello.txt` is visible in the sidebar tree.
6. Assert `subdir` is visible in the sidebar tree.
7. Assert `[data-testid="app"]` is still visible (no crash).

**Expected result:** Sidebar header shows folder name. Both `hello.txt` and `subdir` appear in the file tree. App remains functional.

---

### Scenario A-2: Header displays only the folder basename, not the full path

**Steps:**
1. Create a temp directory with a recognizable prefix (e.g., `my-notepad-test-`).
2. Send IPC `menu:folder-open` with the full absolute path.
3. Assert sidebar header text equals only the basename (no leading path segments).
4. Assert the full path is NOT rendered as visible text in the header.

**Expected result:** Only the last path segment is shown.

---

### Scenario A-3: File tree sorts directories before files, then alphabetically

**Steps:**
1. Create temp directory with: `zebra.txt`, `apple.txt`, `banana/`, `alpha/`.
2. Send IPC `menu:folder-open`.
3. Collect the ordered list of visible items.
4. Assert order is: `alpha`, `banana`, `apple.txt`, `zebra.txt`.

**Expected result:** Directories first (alphabetical), then files (alphabetical).

---

### Scenario A-4: Clicking a file in the tree opens it in the editor and creates a tab

**Steps:**
1. Create `tmpDir/test.txt` with content `hello world`.
2. Open folder via IPC, show sidebar.
3. Assert `test.txt` visible. Click the `test.txt` row.
4. Wait up to 5 s for `[data-tab-title="test.txt"]` to appear.
5. Assert the tab is visible.

---

### Scenario A-5: Sidebar auto-switches to File Browser tab when opening a folder

**Steps:**
1. Show sidebar. Click `button[title="Project"]` tab.
2. Send IPC `menu:folder-open`.
3. Assert the File Browser panel (header + tree) becomes visible — not the Project panel.

**Expected result:** `setSidebarPanel('files')` fires in the `menu:folder-open` handler.

---

### Scenario A-6: Project panel reflects the same workspace folder

**Steps:**
1. Set workspace via `menu:folder-open`.
2. Click `button[title="Project"]` tab.
3. Assert the folder basename is visible in the Project panel.
4. Assert the change-folder button (`button` with text `…`) is visible.

---

### Scenario A-7: "Open Folder…" button visible in sidebar empty state

**Steps:**
1. Show sidebar (no workspace set).
2. Assert `button` with text "Open Folder…" is visible.
3. Assert text "Open a folder to browse files." is visible.
4. Assert Refresh button is NOT visible.

---

## Group B: Edge Cases and Boundaries

### Scenario B-1: Empty folder shows "Empty folder" message, no crash

**Steps:**
1. Create an empty temp directory.
2. Send IPC `menu:folder-open`. Show sidebar.
3. Assert header shows folder basename.
4. Assert text "Empty folder" is visible inside the sidebar.
5. Assert no file tree rows are rendered.
6. Assert `[data-testid="app"]` is still mounted.

---

### Scenario B-2: Folder containing only subdirectories renders correctly

**Steps:**
1. Create `tmpDir/a/`, `tmpDir/b/`, `tmpDir/c/` — no files.
2. Open folder. Assert `a`, `b`, `c` visible with folder icons. No file rows.

---

### Scenario B-3: Deeply nested folders expand correctly level-by-level

**Steps:**
1. Create `tmpDir/level1/level2/level3/deep.txt`.
2. Open folder. Assert `level1` visible; `deep.txt` NOT visible.
3. Click `level1`. Assert `level2` visible; `deep.txt` NOT visible.
4. Click `level2`. Assert `level3` visible; `deep.txt` NOT visible.
5. Click `level3`. Assert `deep.txt` visible.

---

### Scenario B-4: Folder with 200 files renders without timeout

**Steps:**
1. Create 200 files named `file-001.txt` … `file-200.txt`.
2. Open folder. Wait up to 5 s for header.
3. Assert `file-001.txt` visible. Assert app not frozen.

---

### Scenario B-5: Folder name with spaces renders correctly

**Steps:**
1. `fs.mkdirSync(path.join(os.tmpdir(), 'my test folder'))`.
2. Open folder. Assert header shows `my test folder`.

---

### Scenario B-6: Folder name with special characters renders correctly

**Steps:**
1. Create a dir named `test-[proj](v1)`.
2. Open folder. Assert header shows `test-[proj](v1)` unescaped.

---

## Group C: Cancel and Re-Open

### Scenario C-1: Cancelling dialog (stubbed) returns null and leaves workspace unchanged

**Steps:**
1. Show sidebar (no workspace). Assert empty state visible.
2. Stub `window.api.file.openDirDialog` in renderer to return `null`.
3. Click "Open Folder…" button.
4. Assert empty state is still visible. Assert no header appeared.

---

### Scenario C-2: Opening a second folder replaces the first in the tree

**Steps:**
1. Create `folderA/file-a.txt` and `folderB/file-b.txt`.
2. Open `folderA`. Assert `file-a.txt` visible. Header shows `folderA` basename.
3. Send IPC `menu:folder-open` with `folderB`.
4. Assert header updates to `folderB` basename.
5. Assert `file-b.txt` visible. Assert `file-a.txt` NOT visible.

---

### Scenario C-3: Refresh button reloads tree after new file added externally

**Steps:**
1. Create `tmpDir/initial.txt`. Open folder.
2. Add `added.txt` via `fs.writeFileSync`.
3. Click `button[title="Refresh"]`.
4. Assert `added.txt` visible. Assert `initial.txt` still visible.

---

## Group D: Expand, Collapse, and Refresh

### Scenario D-1: Clicking a directory expands it and shows children

**Steps:**
1. Create `tmpDir/subdir/inner.txt`. Open folder.
2. Assert `subdir` visible; `inner.txt` NOT visible.
3. Click `subdir`. Assert `inner.txt` visible within 3 s.

---

### Scenario D-2: Clicking an expanded directory collapses it

**Steps:**
1. Expand `subdir` (inner.txt visible). Click `subdir` again.
2. Assert `inner.txt` NOT visible.

---

### Scenario D-3: Re-expanding uses cached children (no extra IPC call)

**Steps:**
1. Expand then collapse `subdir`. Expand again.
2. Assert `inner.txt` reappears immediately (cached — no loading state).

---

### Scenario D-4: Refresh button is absent when no workspace folder is set

**Steps:**
1. Show sidebar without opening a folder.
2. Assert `button[title="Refresh"]` is NOT visible.

---

### Scenario D-5: Refresh handles an externally deleted subdirectory gracefully

**Steps:**
1. Create `tmpDir/subdir/inner.txt`. Open folder, expand `subdir`.
2. Delete `subdir` via `fs.rmSync`.
3. Click Refresh. Assert `subdir` NOT visible. Assert app still mounted.

---

## Group E: Context Menu

### Scenario E-1: Right-clicking a file shows correct context menu items

**Steps:**
1. Create `tmpDir/target.txt`. Open folder.
2. Right-click `target.txt`.
3. Assert visible: "Open", "New File…", "New Folder…", "Rename", "Delete", "Copy Path".
4. Assert `text=/Reveal in (Finder|Explorer)/` visible.

---

### Scenario E-2: Right-clicking a directory omits the "Open" item

**Steps:**
1. Create `tmpDir/mydir/`. Open folder.
2. Right-click `mydir`. Assert "Open" button NOT visible.
3. Assert "New File…", "New Folder…", "Rename", "Delete", "Copy Path" visible.

---

### Scenario E-3: Context menu closes on click outside the sidebar

**Steps:**
1. Open context menu on a file row.
2. Click `[data-testid="editor-pane"]`.
3. Assert context menu items are NOT visible.

---

### Scenario E-4: "Copy Path" copies the full absolute path to clipboard

**Steps:**
1. Create `tmpDir/copy-me.txt`. Open context menu on it.
2. Click "Copy Path".
3. Read clipboard: `await page.evaluate(() => navigator.clipboard.readText())`.
4. Assert value equals `path.join(tmpDir, 'copy-me.txt')`.

---

## Group F: File Operations via Context Menu

### Scenario F-1: "New File…" creates a file and it appears in the tree

**Steps:**
1. Register `page.once('dialog', d => d.accept('newfile.txt'))`.
2. Right-click any row and click "New File…".
3. Assert `newfile.txt` appears in tree. Assert file exists on disk.

---

### Scenario F-2: "New Folder…" creates a directory in the tree

**Steps:**
1. Register `page.once('dialog', d => d.accept('mynewdir'))`.
2. Right-click and click "New Folder…".
3. Assert `mynewdir` appears with folder icon. Assert directory exists on disk.

---

### Scenario F-3: "Rename" updates the filename in the tree

**Steps:**
1. Create `tmpDir/old-name.txt`. Register `page.once('dialog', d => d.accept('new-name.txt'))`.
2. Right-click `old-name.txt` and click "Rename".
3. Assert `new-name.txt` visible. Assert `old-name.txt` NOT visible.
4. Assert `new-name.txt` exists on disk; `old-name.txt` does not.

---

### Scenario F-4: "Delete" removes the file from tree and disk

**Steps:**
1. Create `tmpDir/delete-me.txt`. Register `page.once('dialog', d => d.accept())`.
2. Right-click and click "Delete".
3. Assert `delete-me.txt` NOT visible. Assert file does not exist on disk.

---

### Scenario F-5: Cancelling "Delete" confirm leaves file intact

**Steps:**
1. Create `tmpDir/keep-me.txt`. Register `page.once('dialog', d => d.dismiss())`.
2. Right-click and click "Delete".
3. Assert `keep-me.txt` still visible. Assert file still on disk.

---

## Group G: Regression Scenarios

### Scenario G-1 (REGRESSION): `file:open-dir-dialog` IPC returns `string`, not an object

**Background:** Prior bug: handler returned `{ canceled, filePath }` object. Renderer called `.replace()` on it → `TypeError`.

**Steps:**
1. Stub `dialog.showOpenDialog` in main process to return `{ canceled: false, filePaths: [tmpDir] }`.
2. Invoke `window.api.file.openDirDialog()` from renderer via `executeJavaScript`.
3. Assert `typeof result === 'string'`.
4. Assert `result === tmpDir`.

---

### Scenario G-2 (REGRESSION): `menu:folder-open` with string path does not crash `FileBrowserPanel`

**Background:** If `workspaceFolder` is an object, line 242 `workspaceFolder.replace(...)` throws.

**Steps:**
1. Create `tmpDir/sample.txt`. Send IPC `menu:folder-open` with the string path.
2. Assert sidebar header shows the basename (proof `.replace()` succeeded).
3. Assert `sample.txt` visible. Assert `[data-testid="app"]` visible and mounted.

---

### Scenario G-3 (REGRESSION): `null` workspace shows empty state without crash

**Steps:**
1. Ensure `workspaceFolder` is `null` (fresh launch).
2. Show sidebar.
3. Assert "Open Folder…" button and "Open a folder to browse files." visible.
4. Assert Refresh button and folder header NOT visible.
5. Assert no React error boundary triggered.

---

## Group H: Editor Interaction

### Scenario H-1: Opening a folder does not close existing editor tabs

**Steps:**
1. Note the default tab (e.g., `new 1`). Type some text.
2. Send IPC `menu:folder-open`.
3. Assert `new 1` tab still present. Assert editor area still visible.

---

### Scenario H-2: Opening a file from tree adds tab without closing existing tabs

**Steps:**
1. Create `tmpDir/new-file.txt`. Open folder.
2. Confirm original tab exists. Click `new-file.txt` in sidebar.
3. Assert both original tab and `new-file.txt` tab are visible simultaneously.

---

## Group I: "Open Folder…" Button Entry Points

### Scenario I-1: Button in File Browser (stubbed) sets workspace and renders tree

**Steps:**
1. Create `tmpDir/stub-file.txt`.
2. Stub renderer: `window.api.file.openDirDialog = async () => tmpDir`.
3. Show sidebar. Click "Open Folder…" button.
4. Assert header shows basename. Assert `stub-file.txt` visible.

---

### Scenario I-2: Button in Project panel (stubbed) sets workspace and switches to Files tab

**Steps:**
1. Create `tmpDir/proj-stub.txt`.
2. Stub `openDirDialog` to return `tmpDir`.
3. Show sidebar. Switch to Project tab. Click "Open Folder…".
4. Assert sidebar switches to File Browser. Assert `proj-stub.txt` visible.

---

## Known Limitations and Skips

- **Native dialog automation:** Any scenario relying on a real native picker must be `test.skip(true, 'requires native dialog')`. Always use the IPC bypass or renderer stub.
- **`window.prompt()` / `window.confirm()`:** Register `page.on('dialog')` handlers **before** clicking the triggering menu item.
- **CSS Modules:** Never target hashed class names. Use `data-testid`, `title`, button text, or stable Monaco classes.
- **`E2E_TEST=1`:** Must be set in launch env. Without it, session restore and close handler interfere.
- **Build requirement:** Run `npm run build` before any test run. The fixture uses `out/main/index.js`.
- **Clipboard (E-4):** Requires `navigator.clipboard.readText()` in Electron renderer. If permission denied, replace with a DOM side-effect assertion.

---

## Coverage Summary

| Group | Count | Focus |
|---|---|---|
| A — Happy path | 7 | Open, render, header, sort, click-open, auto-switch, project sync, empty-state button |
| B — Boundaries | 6 | Empty folder, dirs-only, deep nesting, 200 files, spaces, special chars |
| C — Cancel / reopen | 3 | Cancel → null, replace folder, refresh after re-open |
| D — Expand/collapse/refresh | 5 | Expand, collapse, cache, refresh absent, deleted dir |
| E — Context menu | 4 | File menu, dir menu, outside dismiss, copy path |
| F — File operations | 5 | New file, new folder, rename, delete, cancel delete |
| G — Regression | 3 | IPC return type, no crash on string path, null workspace |
| H — Editor interaction | 2 | Existing tabs intact, tree open adds tab |
| I — Entry point buttons | 2 | File Browser stub, Project panel stub |
| **Total** | **37** | |
