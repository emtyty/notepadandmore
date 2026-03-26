# Phase 6 E2E Test Plan — Plugin System

**App:** Notepad and More (Electron + React + Monaco Editor)
**Phase:** 6 — Plugin System (Plugin Manager UI, plugin events, plugin loading)
**Test framework:** Playwright (`@playwright/test`) + Playwright Electron integration
**Test directory:** `tests/`
**Estimated total scenarios:** 16
**Last updated:** 2026-03-26

---

## Setup notes

All tests use the extended fixture from `tests/fixtures.ts` which:
- Launches `out/main/index.js` with `E2E_TEST=1` (bypasses session restore and close handler)
- Waits for `[data-testid="app"]`, `.monaco-editor textarea`, and `[data-testid="tabbar"] [data-tab-title]` before handing the page to each test

Tests that need both `electronApp` and `page` use the same fixture extension pattern as Phase 5:

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

**IPC helper:**
```ts
async function sendIPC(electronApp: ElectronApplication, channel: string, ...args: unknown[]) {
  await electronApp.evaluate(
    ({ BrowserWindow }, { ch, a }) =>
      BrowserWindow.getAllWindows()[0].webContents.send(ch, ...(a as unknown[])),
    { ch: channel, a: args }
  )
}
```

**CSS Modules warning:** All component class names are hashed. Use only `data-testid`, ARIA roles, text content, and stable CSS classes. The PluginManagerDialog exposes these `data-testid` values:
- `plugin-manager-dialog` — the main dialog container
- `plugin-manager-close` — the ✕ close button
- `plugin-manager-empty` — the empty-state div (when no plugins)
- `plugin-manager-table` — the plugin list `<table>` (when plugins exist)
- `plugin-manager-reload` — the "Reload Plugins" button

---

## Feature 1: Plugin Manager Dialog — Open & Close

**Estimated scenarios: 5**

---

### Scenario 1: Plugin Manager opens via `menu:plugin-manager` IPC

**Preconditions:** App launched fresh. Plugin Manager dialog is not visible.

**Steps:**
1. Assert `[data-testid="plugin-manager-dialog"]` is absent or not visible.
2. Send IPC: `menu:plugin-manager`.
3. Wait up to 2 s for `[data-testid="plugin-manager-dialog"]` to be visible.

**Expected result:** The Plugin Manager dialog is rendered and visible.

**Notes:** `App.tsx` wires `menu:plugin-manager` → `useUIStore.getState().setShowPluginManager(true)`. The dialog checks `showPluginManager` from UIStore and returns `null` when false.

---

### Scenario 2: Plugin Manager closes via Close (✕) button

**Preconditions:** Plugin Manager dialog is open.

**Steps:**
1. Send IPC: `menu:plugin-manager` to open the dialog.
2. Assert `[data-testid="plugin-manager-dialog"]` is visible.
3. Click `[data-testid="plugin-manager-close"]`.
4. Assert `[data-testid="plugin-manager-dialog"]` is no longer visible.

**Expected result:** Dialog unmounts (returns `null`) after close button click.

---

### Scenario 3: Plugin Manager closes via Escape key

**Preconditions:** Plugin Manager dialog is open.

**Steps:**
1. Send IPC: `menu:plugin-manager` to open dialog.
2. Assert dialog is visible.
3. Press `Escape`.
4. Assert dialog is no longer visible.

**Expected result:** The `keydown` Escape listener calls `setShowPluginManager(false)`.

---

### Scenario 4: Plugin Manager shows empty state when no plugins installed

**Preconditions:** App launched with no plugins in the userData plugins directory. (Default state in CI/dev.)

**Steps:**
1. Open Plugin Manager via `menu:plugin-manager` IPC.
2. Assert `[data-testid="plugin-manager-empty"]` is visible.
3. Assert text "No plugins installed." is visible.
4. Assert text about the plugins directory location is visible (`~/.config/notepad-and-more/plugins/`).

**Expected result:** When `plugins.length === 0`, the empty state div renders.

**Notes:** In a fresh dev environment with no plugins installed, this is the default state. If the test machine has plugins, this scenario may need adjustment.

---

### Scenario 5: Plugin Manager shows plugin table when plugins exist [requires temp plugin]

**Preconditions:** A minimal valid plugin is written to the userData plugins directory before the app launches.

**Steps:**
1. Determine the userData plugins path via Electron API:
   ```ts
   const pluginsDir = await electronApp.evaluate(({ app }) =>
     require('path').join(app.getPath('userData'), 'plugins')
   )
   ```
2. Create a minimal plugin: `pluginsDir/hello-world/package.json` + `pluginsDir/hello-world/index.js`.
   - `package.json`: `{ "name": "hello-world", "version": "1.2.3", "author": "Tester" }`
   - `index.js`: `exports.activate = function(api) {}`
3. Open Plugin Manager (`menu:plugin-manager`).
4. Click `[data-testid="plugin-manager-reload"]` to pick up the new plugin.
5. Wait for `[data-testid="plugin-manager-table"]` to appear.
6. Assert a row with text "hello-world" is visible.
7. Assert a row with version "1.2.3" is visible.
8. Assert a row with author "Tester" is visible.
9. Assert a row with status "Active" is visible.
10. Clean up by deleting the plugin directory.

**Expected result:** The plugin table renders one row per loaded plugin with correct metadata columns.

---

## Feature 2: Plugin Manager — Reload

**Estimated scenarios: 3**

---

### Scenario 6: Reload button re-fetches plugin list and updates UI

**Preconditions:** Plugin Manager is open. No plugins initially.

**Steps:**
1. Open Plugin Manager via IPC.
2. Assert empty state is shown (`[data-testid="plugin-manager-empty"]`).
3. Create a plugin directory in the userData plugins path.
4. Click `[data-testid="plugin-manager-reload"]`.
5. Wait up to 3 s for `[data-testid="plugin-manager-table"]` to appear.
6. Assert the new plugin's name is visible in the table.

**Expected result:** `plugin:reload` IPC → `PluginLoader.reloadAll()` → renderer `fetchPlugins()` → table re-renders.

**Notes:** There's a brief `reloading` state where the button text changes to "Reloading…" — this can be asserted if timing allows.

---

### Scenario 7: Reload button shows "Reloading…" during reload

**Preconditions:** Plugin Manager is open.

**Steps:**
1. Open Plugin Manager.
2. Click `[data-testid="plugin-manager-reload"]`.
3. Within the same tick, assert the button text contains "Reloading…" OR assert the button is disabled.

**Expected result:** While `reloading` state is `true`, the button shows "Reloading…" and is disabled (`disabled` attribute).

**Notes:** The reload is fast (disk scan) — this may be a race condition. Use `toBeDisabled()` immediately after click if the text assertion is too timing-sensitive.

---

### Scenario 8: Plugin error state is displayed [requires temp plugin with error]

**Preconditions:** A plugin is installed that throws during `activate()`.

**Steps:**
1. Create a plugin with: `index.js` → `exports.activate = function() { throw new Error('Boom!') }`
2. Open Plugin Manager, reload.
3. Assert the status cell for that plugin shows "Error".
4. Hover over "Error" text — assert `title` attribute contains "Boom!".

**Expected result:** `PluginLoader.loadPlugin()` catches the error, sets `info.error = err.message` and `info.enabled = false`. Dialog renders `<span class="statusError" title={p.error}>Error</span>`.

---

## Feature 3: Plugin Events (via IPC injection)

**Estimated scenarios: 4**

---

### Scenario 9: `ui:show-toast` IPC shows a toast notification

**Preconditions:** App running.

**Steps:**
1. Send IPC: `ui:show-toast` with args `'Hello from plugin!'` and `'info'`.
2. Wait up to 2 s for text "Hello from plugin!" to appear on screen.
3. Assert the toast element is visible.

**Expected result:** `App.tsx` wires `ui:show-toast` → `useUIStore.getState().addToast(msg, level)`. The ToastContainer renders the toast. This is the same path as `api.ui.showMessage()` in plugins.

**Notes:** The toast auto-dismisses after 4 s. Assert within 2 s of sending IPC. Use `page.getByText('Hello from plugin!')`.

---

### Scenario 10: `plugin:add-menu-item` IPC is received without error

**Preconditions:** App running.

**Steps:**
1. Send IPC: `plugin:add-menu-item` with args `'my-plugin'` and `'Do Something'`.
2. Wait 500 ms.
3. Evaluate the plugin store state from the renderer:
   ```ts
   const items = await page.evaluate(() => {
     // Access through window if exposed — otherwise just check no errors
     return true
   })
   ```
4. Assert no error toast is visible.

**Expected result:** `App.tsx` handles `plugin:add-menu-item` by calling `usePluginStore.getState().addDynamicMenuItem(...)`. The store update is silent (no UI element for dynamic items yet beyond the native menu). The test verifies no crash occurs.

**Notes:** The native Plugins menu is updated by `addPluginMenuItem()` in `menu.ts` (main process side), which happens before the IPC fires. The renderer store update is a companion side-effect. This test is primarily a smoke/crash test.

---

### Scenario 11: `plugin:insert-text` IPC inserts text at cursor

**Preconditions:** App running with an active editor buffer. Cursor is positioned in the editor.

**Steps:**
1. Click `.monaco-editor textarea` to focus the editor.
2. Position cursor at the start of the document (press `Ctrl+Home`).
3. Send IPC: `plugin:insert-text` with args `'my-plugin'` and `'INSERTED_TEXT'`.
4. Wait 500 ms.
5. Assert the editor contains "INSERTED_TEXT" at the beginning.

**Expected result:** `EditorPane.tsx` handles `plugin:insert-text` → `editor.executeEdits(...)` inserts text at the current selection/cursor.

**Notes:** After send, read editor content via `page.evaluate(() => window.__editorGetText?.() ?? '')` — OR assert the text is visible in the Monaco editor's DOM. Use `page.locator('.monaco-editor .view-line').first().textContent()` to check the first line.

---

### Scenario 12: `plugin:editor-get-text` IPC is handled and replies correctly

**Preconditions:** App running with an active editor buffer containing known text.

**Steps:**
1. Focus editor, type `"hello plugin world"`.
2. From the main process, simulate `plugin:editor-get-text` send:
   ```ts
   await sendIPC(electronApp, 'plugin:editor-get-text')
   ```
3. Capture the reply by inspecting the IPC reply channel from the main process:
   ```ts
   const reply = await electronApp.evaluate(() =>
     new Promise((resolve) => {
       const { ipcMain } = require('electron')
       ipcMain.once('plugin:editor-get-text:reply', (_e, val) => resolve(val))
     })
   )
   ```
4. Assert `reply` includes `"hello plugin world"`.

**Expected result:** `EditorPane.tsx` handles `plugin:editor-get-text` → reads active buffer model value → sends `plugin:editor-get-text:reply` with the full text.

**Notes:** The IPC round-trip: main sends `plugin:editor-get-text` → renderer handles in `EditorPane` → renderer sends `plugin:editor-get-text:reply` back to main. The test simulates the main-to-renderer direction and captures the renderer-to-main reply.

---

## Feature 4: Plugin Loading Integration [requires plugin setup]

**Estimated scenarios: 4**

---

### Scenario 13: Plugin with `addMenuItem` call adds item to Plugins native menu [SKIP in headless]

**Preconditions:** A plugin is installed that calls `api.ui.addMenuItem({ label: 'Say Hello', callback: fn })`.

**Steps:**
1. Install the plugin in the userData plugins directory.
2. Launch the app (or reload plugins).
3. Inspect the native Plugins menu via Electron evaluate to confirm the submenu item exists.

**Expected result:** `addPluginMenuItem()` in `menu.ts` appends a `MenuItem` with the plugin's label as a submenu under the Plugins menu.

**Notes:** Native menus are not accessible via DOM in Playwright. Use `electronApp.evaluate()` to inspect `Menu.getApplicationMenu()`.

---

### Scenario 14: Plugin with `showMessage` triggers visible toast

**Preconditions:** A plugin installed that calls `api.ui.showMessage('Test toast', 'info')` from `activate()`.

**Steps:**
1. Ensure the plugin exists in the userData plugins directory.
2. Launch the app (fresh start, plugins loaded on startup via `loadAll()`).
3. Wait up to 3 s for toast text "Test toast" to appear.
4. Assert the toast is visible.

**Expected result:** `api.ui.showMessage` calls `win.webContents.send('ui:show-toast', msg, level)` → `App.tsx` handler → `addToast()` → `ToastContainer` renders.

---

### Scenario 15: Plugin list is populated on app startup

**Preconditions:** One valid plugin exists in the userData plugins directory.

**Steps:**
1. Launch the app.
2. Open Plugin Manager via `menu:plugin-manager` IPC.
3. Assert `[data-testid="plugin-manager-table"]` is visible immediately (no reload needed).
4. Assert the plugin row is visible.

**Expected result:** `PluginLoader.loadAll()` is called during app startup (in `src/main/index.ts`). `App.tsx` calls `usePluginStore.getState().fetchPlugins()` on mount. The dialog should show the already-loaded list on first open.

---

### Scenario 16: Plugin with invalid `activate` shows "Missing activate() export" error

**Preconditions:** A plugin installed with `index.js` that exports `{}` (no `activate` function).

**Steps:**
1. Install plugin: `index.js` → `module.exports = {}`.
2. Launch app or reload plugins.
3. Open Plugin Manager.
4. Assert the plugin row shows "Error" status.
5. Assert the error tooltip text contains "Missing activate() export".

**Expected result:** `PluginLoader.loadPlugin()` line 73–76: `if (typeof plugin.activate !== 'function')` → sets `info.error = 'Missing activate() export'`. Dialog renders the error status with the message as `title` tooltip.

---

## Appendix: Selector Reference

| Element | Selector |
|---|---|
| Plugin Manager dialog | `[data-testid="plugin-manager-dialog"]` |
| Plugin Manager close button | `[data-testid="plugin-manager-close"]` |
| Plugin Manager empty state | `[data-testid="plugin-manager-empty"]` |
| Plugin Manager table | `[data-testid="plugin-manager-table"]` |
| Plugin Manager reload button | `[data-testid="plugin-manager-reload"]` |
| App root | `[data-testid="app"]` |
| Editor pane | `[data-testid="editor-pane"]` |
| Monaco editor | `.monaco-editor` |
| Monaco input target | `.monaco-editor textarea` |
| Toast notifications | `page.getByText('...')` (no testid; auto-dismiss in 4s) |
| Cursor position | `[data-testid="cursor-position"]` |

## Appendix: IPC Channel Reference

| Channel | Direction | Payload | Effect |
|---|---|---|---|
| `menu:plugin-manager` | main → renderer | — | Opens Plugin Manager dialog |
| `plugin:add-menu-item` | main → renderer | `pluginName: string, label: string` | Adds to pluginStore.dynamicMenuItems |
| `plugin:insert-text` | main → renderer | `pluginName: string, text: string` | Inserts text at cursor in active editor |
| `plugin:editor-get-text` | main → renderer | — | Triggers reply with current buffer text |
| `plugin:editor-get-selection` | main → renderer | — | Triggers reply with selected text |
| `plugin:editor-get-path` | main → renderer | — | Triggers reply with active file path |
| `plugin:editor-get-text:reply` | renderer → main | `string` | Active buffer full text |
| `plugin:editor-get-selection:reply` | renderer → main | `string` | Current selection text |
| `plugin:editor-get-path:reply` | renderer → main | `string \| null` | Active file path |
| `ui:show-toast` | main → renderer | `msg: string, level: string` | Shows toast notification |
| `plugin:list` | renderer → main invoke | — | Returns `PluginInfo[]` |
| `plugin:reload` | renderer → main invoke | — | Reloads all plugins, returns new `PluginInfo[]` |

## Appendix: Scenario Summary by Feature

| Feature | Scenarios | Notes |
|---|---|---|
| 1. Plugin Manager Dialog Open & Close | 1–5 | Scenario 5 requires plugin setup |
| 2. Plugin Manager Reload | 6–8 | Scenario 8 requires error plugin |
| 3. Plugin Events via IPC | 9–12 | All injectable via IPC, no plugin needed |
| 4. Plugin Loading Integration | 13–16 | All require plugin setup |
| **Total** | **16** | |
