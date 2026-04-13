# App Settings Rework — Test Cases

Verifies that the legacy `Settings` menu and `PreferencesDialog` modal are fully replaced by (a) a macOS `App → Settings…` entry, (b) a right-side gear icon with a dropdown, and (c) a VS Code–style virtual Settings tab. Covers menu surface, gear dropdown interaction, virtual-tab lifecycle, live autosave, and session restore. Targets macOS and Windows.

---

## Test Scenarios

### Test 1: macOS App menu exposes Settings… with Cmd+,

**Type**: E2E Test  
**Category**: Functional  
**Platform**: macOS only

**Preconditions**
- App running on macOS (`process.platform === 'darwin'`).
- No Settings tab currently open.

**Steps**

1. Open the native macOS menu bar and click the `NovaPad` (App) menu.
2. Observe the menu items in order.
3. Click `Settings…`.
4. Press `Cmd+,` anywhere in the app to re-trigger.

**Expected Result**

- `Settings…` appears between `About NovaPad` and the first separator.
- Its displayed accelerator is `⌘,`.
- Step 3: a tab labeled `Settings` with a gear icon opens in the TabBar and becomes active.
- Step 4: the existing Settings tab is focused — no duplicate tab is created.

**Status:** Not Tested

---

### Test 2: Settings top-level menu removed on all platforms

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- App running on macOS or Windows.

**Steps**

1. Inspect all top-level menu labels (native menu on macOS, custom MenuBar on Windows).

**Expected Result**

- No top-level menu labeled `Settings` exists.
- On macOS the menu order is: `NovaPad`, `File`, `Edit`, `Search`, `View`, `Macro`, `Plugins`, `Window`, `Help`.
- On Windows the custom MenuBar top-menu row is: `File`, `Edit`, `Search`, `View`, `Macro`, `Plugins`, `Window`, `Help`.

**Status:** Not Tested

---

### Test 3: Right-side icon strip — Search and theme toggle removed, gear added

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- App running on macOS or Windows.
- Default theme and sidebar visibility.

**Steps**

1. Inspect the right-side icon area of the MenuBar / title bar.

**Expected Result**

- No magnifier (Search) icon is visible in that area.
- No Sun/Moon (theme toggle) icon is visible in that area.
- A `Toggle Sidebar` icon is visible (unchanged).
- A gear (Settings) icon is visible.
- The gear icon is visible on both macOS and Windows.

**Status:** Not Tested

---

### Test 4: Gear dropdown opens with exactly four entries in fixed order

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- App running; theme is light.
- Settings and Shortcuts tabs are closed.

**Steps**

1. Click the gear icon.
2. Read the dropdown contents.
3. Click the gear icon again.

**Expected Result**

- Dropdown opens with exactly these items, in this order: `Toggle Dark Mode`, separator, `Keyboard Shortcuts`, `Settings`.
- No other items appear (no `User Defined Languages…`, no `Style Configurator…`, no `About`).
- Step 3: dropdown closes.

**Status:** Not Tested

---

### Test 5: Gear dropdown dismisses on outside click

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- Gear dropdown is open.

**Steps**

1. Click anywhere in the editor area (outside the dropdown).

**Expected Result**

- Dropdown closes.
- No tab is opened.
- No theme change occurs.

**Status:** Not Tested

---

### Test 6: Theme toggle from gear dropdown — label flips and persists

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- App running with theme = light.

**Steps**

1. Click the gear icon.
2. Click `Toggle Dark Mode`.
3. Re-open the gear dropdown.
4. Click `Toggle Light Mode`.
5. Close the app and relaunch it.

**Expected Result**

- Step 2: theme switches to dark immediately; dropdown closes.
- Step 3: the entry label now reads `Toggle Light Mode`.
- Step 4: theme switches back to light; dropdown closes.
- Step 5: on relaunch, the last selected theme persists (matches behavior of the old toolbar theme button).

**Status:** Not Tested

---

### Test 7: Open Settings tab from gear dropdown

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- No Settings tab open.
- One or more file tabs open.

**Steps**

1. Click the gear icon.
2. Click `Settings`.
3. Inspect the TabBar and the editor area.

**Expected Result**

- A new tab appears in the TabBar with title `Settings`, a gear icon, and no file-path tooltip.
- The Settings tab is active.
- The editor area shows the Settings view (General/Editor/Appearance/New Document/Backup/Auto-Completion categories) — not a Monaco editor.
- The Settings tab has no dirty dot.

**Status:** Not Tested

---

### Test 8: Cmd/Ctrl+, opens Settings tab directly

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- No Settings tab currently open.
- An unrelated file tab is active and focused.

**Steps**

1. Press `Cmd+,` (macOS) or `Ctrl+,` (Windows).

**Expected Result**

- The Settings tab opens and becomes active.
- The gear dropdown does not open.

**Status:** Not Tested

---

### Test 9: Cmd/Ctrl+, focuses existing Settings tab (no duplicates)

**Type**: E2E Test  
**Category**: Edge Case

**Preconditions**
- Settings tab is already open but not active (another tab is focused).

**Steps**

1. Press `Cmd+,` / `Ctrl+,`.
2. Count Settings tabs in the TabBar.

**Expected Result**

- The existing Settings tab is focused and becomes active.
- Exactly one Settings tab exists.

**Status:** Not Tested

---

### Test 10: Clicking Settings in gear dropdown with tab already open focuses existing tab

**Type**: E2E Test  
**Category**: Edge Case

**Preconditions**
- Settings tab is open but another tab is active.

**Steps**

1. Click the gear icon.
2. Click `Settings`.
3. Count Settings tabs.

**Expected Result**

- The existing Settings tab is focused, becomes active.
- No second Settings tab is created.

**Status:** Not Tested

---

### Test 11: Settings tab live-saves changes (no Save button, no dirty state)

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- Settings tab open and active.
- `configStore` default font size is known (e.g., 14).

**Steps**

1. Navigate to the `Editor` category in the Settings tab.
2. Change `Font Size` from 14 to 18.
3. Observe the Settings tab.
4. Open a file tab (or create a new buffer) and observe the Monaco editor font size.
5. Close the app without any explicit save, then relaunch.
6. Open Settings tab again and read `Font Size`.

**Expected Result**

- Step 3: no dirty dot appears on the Settings tab at any point.
- Step 3: no `Save` button is present in the Settings view.
- Step 4: the editor renders with font size 18 immediately.
- Step 6: the value is still 18 after relaunch (live-saved to config).

**Status:** Not Tested

---

### Test 12: Settings tab closes like a file tab

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- Settings tab is open and active.

**Steps**

1. Click the `X` close button on the Settings tab.
2. Reopen via the gear dropdown → `Settings`.
3. With Settings tab active again, press `Cmd/Ctrl+W`.
4. Observe TabBar.

**Expected Result**

- Step 1: Settings tab closes; a neighboring tab (or an empty state) becomes active.
- Step 2: Settings tab reappears.
- Step 3: Settings tab closes.

**Status:** Not Tested

---

### Test 13: Settings tab context menu shows close-family only

**Type**: Component Test  
**Category**: Functional

**Preconditions**
- Settings tab exists in TabBar.

**Steps**

1. Right-click the Settings tab.
2. Inspect the context menu items.

**Expected Result**

- Menu contains only close-family items: `Close`, `Close Others`, `Close All`.
- Menu does not contain file-specific items: `Reveal in Explorer/Finder`, `Copy Path`, `Copy Relative Path`.

**Status:** Not Tested

---

### Test 14: Settings tab is drag-reorderable alongside file tabs

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- Tabs open in this order: `fileA.txt`, `Settings`, `fileB.txt`.

**Steps**

1. Drag the Settings tab to the left of `fileA.txt`.
2. Observe TabBar order.
3. Drag it to the right of `fileB.txt`.
4. Observe TabBar order.

**Expected Result**

- Step 2: order is `Settings`, `fileA.txt`, `fileB.txt`.
- Step 4: order is `fileA.txt`, `fileB.txt`, `Settings`.
- No errors or tab flicker.

**Status:** Not Tested

---

### Test 15: Session restore reopens Settings tab with correct active state

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- Settings tab open; two file tabs open (`fileA.txt`, `fileB.txt`); Settings tab is active.

**Steps**

1. Close the app cleanly (the session save runs).
2. Relaunch the app.
3. Observe TabBar and active tab.

**Expected Result**

- Settings tab is present.
- File tabs `fileA.txt` and `fileB.txt` are present.
- Settings tab is the active tab.
- No duplicate Settings tab is created.

**Status:** Not Tested

---

### Test 16: Session restore preserves drag-reorder position of Settings tab

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- Settings tab has been dragged between two file tabs: `fileA.txt`, `Settings`, `fileB.txt`.

**Steps**

1. Close app and relaunch.
2. Observe TabBar order.

**Expected Result**

- Tabs appear in the same order as before close: `fileA.txt`, `Settings`, `fileB.txt` (if the "unified order" implementation is chosen).
- If the "separate arrays" implementation is chosen, Settings tab appears grouped according to the serialized order — this is an **acceptable documented limitation** per spec §2.4. Test status should reflect which implementation was chosen.

**Status:** Not Tested

---

### Test 17: Session restore from v2 file works without virtual tabs

**Type**: Unit Test (SessionManager)  
**Category**: Edge Case

**Preconditions**
- An existing v2 `session.json` on disk with 2 file entries, no `virtualTabs` field.

**Steps**

1. Launch the app.
2. Inspect the loaded session and TabBar.

**Expected Result**

- Both file tabs are restored.
- No Settings or Shortcuts tabs appear.
- Subsequent save writes the session as v3 with `virtualTabs: []`.
- No runtime errors or warnings about missing fields.

**Status:** Not Tested

---

### Test 18: Session restore with malformed virtualTabs is resilient

**Type**: Unit Test (SessionManager)  
**Category**: Error Handling

**Preconditions**
- A v3 `session.json` where `virtualTabs` is `null` or a non-array value.

**Steps**

1. Launch the app.

**Expected Result**

- App launches normally.
- File tabs restore correctly.
- No virtual tabs appear.
- A dev-mode warning is logged; no user-visible error.

**Status:** Not Tested

---

### Test 19: Session restore skips unknown virtual-tab kinds

**Type**: Unit Test (SessionManager)  
**Category**: Error Handling

**Preconditions**
- A v3 session with `virtualTabs: [{ kind: 'settings' }, { kind: 'xyz' }]`.

**Steps**

1. Launch the app.

**Expected Result**

- Exactly one Settings tab is restored.
- The `xyz` entry is silently skipped (dev-mode warning logged).
- No error toast.

**Status:** Not Tested

---

### Test 20: Keyboard Shortcuts stub tab opens from gear dropdown

**Type**: E2E Test  
**Category**: Functional

**Preconditions**
- No Shortcuts tab open.

**Steps**

1. Click the gear icon.
2. Click `Keyboard Shortcuts`.
3. Inspect TabBar and editor area.

**Expected Result**

- A new tab labeled `Keyboard Shortcuts` with a keyboard icon appears and is active.
- Editor area shows a placeholder ("Keyboard Shortcuts editor — coming soon" or similar).
- No Monaco editor is mounted for this tab.

**Status:** Not Tested

---

### Test 21: Keyboard Shortcuts tab is a singleton

**Type**: E2E Test  
**Category**: Edge Case

**Preconditions**
- Shortcuts tab is open but inactive.

**Steps**

1. Open the gear dropdown and click `Keyboard Shortcuts`.
2. Count Shortcuts tabs.

**Expected Result**

- The existing Shortcuts tab is focused; no duplicate.

**Status:** Not Tested

---

### Test 22: PreferencesDialog modal is fully removed

**Type**: E2E Test  
**Category**: Functional (regression)

**Preconditions**
- App running.

**Steps**

1. Attempt to trigger any path that previously opened the Preferences modal: native menu, keyboard shortcut, in-app button.
2. Inspect the DOM for a Preferences dialog element.
3. From DevTools console, attempt to call `useUIStore.getState().setShowPreferences(true)`.

**Expected Result**

- No modal dialog appears via any historical path.
- No DOM node for a Preferences dialog exists.
- Step 3: the `setShowPreferences` function no longer exists on the store (TypeError) — confirming complete removal.

**Status:** Not Tested

---

### Test 23: Removed IPC channels are rejected by preload

**Type**: Unit Test (preload allowlist)  
**Category**: Functional (regression)

**Preconditions**
- Preload bundle built.

**Steps**

1. From renderer DevTools, register a listener via `window.api.on('menu:preferences', ...)`.
2. From main, send `menu:preferences`.
3. Repeat for `menu:udl-editor`, `menu:style-configurator`, `menu:shortcut-mapper`.

**Expected Result**

- Each `on` call silently returns without registering (channel not in allowlist).
- No listener is invoked on the renderer side.

**Status:** Not Tested

---

### Test 24: New IPC channel `menu:settings-open` is accepted

**Type**: Unit Test (preload allowlist)  
**Category**: Functional

**Preconditions**
- Preload bundle built.

**Steps**

1. From renderer, register `window.api.on('menu:settings-open', cb)`.
2. From main, `win.webContents.send('menu:settings-open')`.

**Expected Result**

- The callback fires exactly once.
- Settings tab opens / focuses on receipt.

**Status:** Not Tested

---

### Test 25: Closing Settings tab removes it from next session

**Type**: E2E Test  
**Category**: Edge Case

**Preconditions**
- Settings tab open; one file tab open.

**Steps**

1. Close the Settings tab (`X`).
2. Close the app.
3. Relaunch.

**Expected Result**

- Only the file tab is restored.
- No Settings tab appears.
- Persisted session's `virtualTabs` array does not contain a `settings` entry.

**Status:** Not Tested

---

### Test 26: Virtual tab never marks dirty even under contrived input

**Type**: Component Test  
**Category**: Edge Case

**Preconditions**
- Settings tab mounted.

**Steps**

1. Rapidly change several fields (e.g., font size, tab size, encoding).
2. Inspect the Settings tab's dirty indicator during and after the changes.

**Expected Result**

- No dirty dot appears at any point.
- `buffer.isDirty` remains `false` throughout.

**Status:** Not Tested

---

### Test 27: Disabled UI surfaces confirmed removed

**Type**: E2E Test  
**Category**: Functional (regression)

**Preconditions**
- App running.

**Steps**

1. Inspect all native-menu and in-app menu surfaces.
2. Inspect the gear dropdown.

**Expected Result**

- No reachable `User Defined Languages…` entry anywhere.
- No reachable `Style Configurator…` entry anywhere.
- No reachable `Preferences…` entry anywhere (replaced by `Settings…` / `Settings`).
- No reachable `Shortcut Mapper` label (renamed to `Keyboard Shortcuts` in the gear dropdown; nowhere else).

**Status:** Not Tested

---

### Test 28: Gear icon remains visible on macOS (no native MenuBar)

**Type**: E2E Test  
**Category**: Edge Case  
**Platform**: macOS only

**Preconditions**
- App running on macOS (where the custom `MenuBar.tsx` historically returned `null`).

**Steps**

1. Inspect the app window for the gear icon.
2. Click it.

**Expected Result**

- The gear icon is visible in a persistent header/strip at the top of the window.
- Clicking it opens the dropdown with the four expected entries.
- The rest of the custom MenuBar menu rows (File, Edit, …) are NOT shown — those live in the native menu bar.

**Status:** Not Tested

---

### Test 29: `Cmd+,` on macOS uses native menu item accelerator

**Type**: E2E Test  
**Category**: Functional  
**Platform**: macOS only

**Preconditions**
- Settings tab not open.
- App is focused.

**Steps**

1. Press `Cmd+,`.
2. Inspect which menu item is flashed (system UI) and which IPC channel is emitted.

**Expected Result**

- Native macOS menu flash occurs on the `Settings…` item under the App menu.
- `menu:settings-open` is emitted once.
- Exactly one Settings tab is open.

**Status:** Not Tested

---

### Test 30: `Ctrl+,` on Windows opens Settings tab without visible menu

**Type**: E2E Test  
**Category**: Functional  
**Platform**: Windows only

**Preconditions**
- App running on Windows.
- Settings tab not open.

**Steps**

1. Press `Ctrl+,`.

**Expected Result**

- Settings tab opens and becomes active.
- No menu UI flickers (since there is no Settings menu entry on Windows).
- `menu:settings-open` is emitted once.

**Status:** Not Tested

---

### Test 31: Toggle Sidebar icon still works after MenuBar rework

**Type**: E2E Test  
**Category**: Functional (regression)

**Preconditions**
- Sidebar currently visible.

**Steps**

1. Click the Toggle Sidebar icon (right-side area).
2. Click it again.

**Expected Result**

- Step 1: sidebar hides; icon state flips (panel-left-close ↔ panel-left).
- Step 2: sidebar shows again.

**Status:** Not Tested
