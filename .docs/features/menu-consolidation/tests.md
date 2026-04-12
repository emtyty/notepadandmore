# Menu Consolidation - Test Cases

Tests for platform-conditional MenuBar, QuickStrip, feature-parity menus, bidirectional state sync, editor context menu, and disabled stubbed items. All tests are Playwright E2E against the compiled Electron app. Platform-specific tests use `test.skip` guards based on `process.platform`.

---

## Test Scenarios

### Test 1: macOS hides custom MenuBar

**Type**: E2E Test
**Category**: Functional
**Covers**: US-001, BR-001

**Preconditions**
- App launched on macOS (`process.platform === 'darwin'`)
- Skip on Windows/Linux

**Steps**

1. Launch the app and wait for `[data-testid="app"]`
2. Query for `[data-testid="menubar"]`

**Expected Result**

- `[data-testid="menubar"]` is not present in the DOM (count = 0)
- No "File", "Edit", "Search", "View" menu buttons visible in the window

**Status:** Not Tested

---

### Test 2: macOS shows QuickStrip

**Type**: E2E Test
**Category**: Functional
**Covers**: US-003

**Preconditions**
- App launched on macOS
- Skip on Windows/Linux

**Steps**

1. Launch the app and wait for `[data-testid="app"]`
2. Query for `[data-testid="quickstrip"]`
3. Check for app icon/name text "NovaPad"
4. Check for quick action buttons: Find, Sidebar toggle, Theme toggle

**Expected Result**

- `[data-testid="quickstrip"]` is visible
- Contains text "NovaPad"
- Find button (`[data-testid="quickstrip-find"]`) is visible
- Sidebar toggle button (`[data-testid="quickstrip-sidebar"]`) is visible
- Theme toggle button (`[data-testid="quickstrip-theme"]`) is visible

**Status:** Not Tested

---

### Test 3: QuickStrip Find button opens Find panel

**Type**: E2E Test
**Category**: Functional
**Covers**: US-003

**Preconditions**
- App launched on macOS
- Skip on Windows/Linux

**Steps**

1. Launch the app
2. Click `[data-testid="quickstrip-find"]`

**Expected Result**

- Find/Replace dialog becomes visible

**Status:** Not Tested

---

### Test 4: QuickStrip Sidebar toggle works

**Type**: E2E Test
**Category**: Functional
**Covers**: US-003

**Preconditions**
- App launched on macOS
- Sidebar initially hidden (default state)
- Skip on Windows/Linux

**Steps**

1. Launch the app
2. Verify sidebar is hidden
3. Click `[data-testid="quickstrip-sidebar"]`
4. Verify sidebar is visible
5. Click `[data-testid="quickstrip-sidebar"]` again
6. Verify sidebar is hidden

**Expected Result**

- Sidebar toggles on/off with each click
- `[data-testid="sidebar"]` visibility matches toggle state

**Status:** Not Tested

---

### Test 5: QuickStrip Theme toggle works

**Type**: E2E Test
**Category**: Functional
**Covers**: US-003

**Preconditions**
- App launched on macOS
- Default theme is dark
- Skip on Windows/Linux

**Steps**

1. Launch the app
2. Verify `<html>` has class `dark`
3. Click `[data-testid="quickstrip-theme"]`
4. Verify `<html>` does NOT have class `dark`
5. Click `[data-testid="quickstrip-theme"]` again
6. Verify `<html>` has class `dark`

**Expected Result**

- Theme alternates between dark and light with each click

**Status:** Not Tested

---

### Test 6: Windows/Linux shows custom MenuBar with all menus

**Type**: E2E Test
**Category**: Functional
**Covers**: US-002, US-005

**Preconditions**
- App launched on Windows or Linux (`process.platform !== 'darwin'`)
- Skip on macOS

**Steps**

1. Launch the app and wait for `[data-testid="app"]`
2. Query for `[data-testid="menubar"]`
3. Check that all 10 top-level menu buttons are present: File, Edit, Search, View, Encoding, Language, Settings, Macro, Plugins, Window, Help

**Expected Result**

- `[data-testid="menubar"]` is visible
- All 11 menu labels (File, Edit, Search, View, Encoding, Language, Settings, Macro, Plugins, Window, Help) are visible as buttons

**Status:** Not Tested

---

### Test 7: Windows/Linux does not render separate QuickStrip row

**Type**: E2E Test
**Category**: Functional
**Covers**: US-004

**Preconditions**
- App launched on Windows or Linux
- Skip on macOS

**Steps**

1. Launch the app
2. Query for `[data-testid="quickstrip"]`
3. Check right side of MenuBar for quick icons

**Expected Result**

- `[data-testid="quickstrip"]` is not present (count = 0)
- Quick icons (Find, Sidebar, Theme) are visible within the MenuBar row

**Status:** Not Tested

---

### Test 8: Windows/Linux native menu is auto-hidden

**Type**: E2E Test
**Category**: Functional
**Covers**: US-002, BR-001

**Preconditions**
- App launched on Windows or Linux
- Skip on macOS

**Steps**

1. Launch the app
2. Use `electronApp.evaluate()` to check `BrowserWindow.getAllWindows()[0].autoHideMenuBar`

**Expected Result**

- `autoHideMenuBar` is `true`

**Status:** Not Tested

---

### Test 9: File menu — all items present

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux (custom MenuBar visible)
- Skip on macOS

**Steps**

1. Click "File" menu button
2. Inspect dropdown items

**Expected Result**

- Dropdown contains: New File, Open File..., Open Folder..., Save, Save As..., Save All, Reload from Disk, Close File, Close All Files, Recent Files
- Each item with implemented shortcut shows correct shortcut text (e.g., Ctrl+N, Ctrl+O, Ctrl+S)
- Separators are present between logical groups

**Status:** Not Tested

---

### Test 10: Edit menu — submenus for Line Operations and Convert Case

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Edit" menu button
2. Verify top-level items: Undo, Redo, Cut, Copy, Paste, Select All, Line Operations, Convert Case, Toggle Comment, Toggle Block Comment, Trim Trailing Whitespace, Indent Selection, Outdent Selection
3. Hover over "Line Operations"
4. Verify submenu appears with: Duplicate Line, Delete Line, Move Line Up, Move Line Down, Sort Lines Ascending, Sort Lines Descending
5. Hover over "Convert Case"
6. Verify submenu appears with: UPPERCASE, lowercase, Title Case

**Expected Result**

- All Edit items present
- Line Operations submenu expands on hover with 6 items
- Convert Case submenu expands on hover with 3 items

**Status:** Not Tested

---

### Test 11: Search menu — includes Go to Line and Bookmarks (disabled)

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005, US-010

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Search" menu button
2. Check for items: Find..., Replace..., Find in Files..., Go to Line..., Toggle Bookmark, Next Bookmark, Previous Bookmark, Clear All Bookmarks

**Expected Result**

- Find, Replace, Find in Files, Go to Line are enabled (clickable)
- Toggle Bookmark, Next Bookmark, Previous Bookmark, Clear All Bookmarks are visible but disabled (grayed out, not clickable)

**Status:** Not Tested

---

### Test 12: View menu — all toggles and zoom controls

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "View" menu button
2. Check for items: Toggle Toolbar, Toggle Status Bar, Toggle Sidebar, Word Wrap, Show Whitespace, Show Indentation Guides, Column Select Mode, Zoom In, Zoom Out, Reset Zoom, Split View

**Expected Result**

- Toggle items (Toolbar, Status Bar, Sidebar, Word Wrap, Whitespace, Indent Guides, Column Select) are enabled
- Zoom In, Zoom Out, Reset Zoom are enabled
- Split View is visible but disabled

**Status:** Not Tested

---

### Test 13: Encoding menu — all encodings and EOL submenu

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Encoding" menu button
2. Check encoding items: UTF-8, UTF-8 with BOM, UTF-16 LE, UTF-16 BE, Windows-1252, ISO-8859-1
3. Hover over "EOL Format"
4. Verify submenu: Windows (CRLF), Unix (LF), Classic Mac (CR)

**Expected Result**

- All 6 encoding options present and enabled
- EOL Format submenu expands with 3 options

**Status:** Not Tested

---

### Test 14: Language menu — 20+ languages present

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Language" menu button
2. Check for: Auto Detect, Plain Text, JavaScript, TypeScript, Python, C++, HTML, CSS, JSON, Markdown (at minimum)

**Expected Result**

- At least 20 language options visible
- Auto Detect and Plain Text are at the top, separated from the rest

**Status:** Not Tested

---

### Test 15: Settings menu — Preferences enabled, others disabled

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005, US-010

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Settings" menu button
2. Check items: Preferences..., Shortcut Mapper..., User Defined Languages..., Style Configurator..., Toggle Dark Mode

**Expected Result**

- Preferences and Toggle Dark Mode are enabled
- Shortcut Mapper, User Defined Languages, Style Configurator are visible but disabled

**Status:** Not Tested

---

### Test 16: Macro menu — all items disabled

**Type**: E2E Test
**Category**: Functional
**Covers**: US-010

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Macro" menu button
2. Check items: Start Recording, Stop Recording, Playback, Saved Macros

**Expected Result**

- All 4 items are visible but disabled (grayed out)

**Status:** Not Tested

---

### Test 17: Plugins menu — Plugin Manager disabled

**Type**: E2E Test
**Category**: Functional
**Covers**: US-010

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Plugins" menu button
2. Check for "Plugin Manager..."

**Expected Result**

- Plugin Manager item is visible but disabled

**Status:** Not Tested

---

### Test 18: Keyboard shortcuts display correct modifier

**Type**: E2E Test
**Category**: Functional
**Covers**: US-006

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "File" menu button
2. Read shortcut text for "New File"
3. Read shortcut text for "Save"

**Expected Result**

- New File shows "Ctrl+N" (not "⌘+N")
- Save shows "Ctrl+S" (not "⌘+S")

**Status:** Not Tested

---

### Test 19: Bidirectional sync — toggle sidebar from custom MenuBar updates native menu

**Type**: E2E Test
**Category**: Functional
**Covers**: US-007, BR-003

**Preconditions**
- App launched on any platform
- Sidebar initially hidden

**Steps**

1. Toggle sidebar via custom MenuBar (Windows/Linux) or via QuickStrip (macOS)
2. Use `electronApp.evaluate()` to read native menu item state: `Menu.getApplicationMenu().getMenuItemById('toggle-sidebar').checked`

**Expected Result**

- Native menu checkbox for sidebar is `true` (checked)

**Status:** Not Tested

---

### Test 20: Bidirectional sync — toggle toolbar from native menu updates renderer

**Type**: E2E Test
**Category**: Functional
**Covers**: US-008, BR-003

**Preconditions**
- App launched on any platform
- Toolbar initially visible

**Steps**

1. Use `sendIPC(electronApp, 'ui:toggle-toolbar', false)` to simulate native menu toggle
2. Wait for UI update
3. Check if Toolbar component is hidden

**Expected Result**

- Toolbar (`[data-testid="toolbar"]`) is no longer visible
- No IPC sent back from renderer (no sync loop)

**Status:** Not Tested

---

### Test 21: Bidirectional sync — no infinite loop

**Type**: E2E Test
**Category**: Edge Case
**Covers**: US-008, BR-004

**Preconditions**
- App launched on any platform

**Steps**

1. Toggle sidebar rapidly 10 times via `sendIPC` alternating true/false
2. After all 10 toggles, read final state from renderer (`page.evaluate`)
3. Read final state from native menu (`electronApp.evaluate`)

**Expected Result**

- Both renderer and native menu agree on the final sidebar state
- No crash, no hang, no console errors about maximum call stack

**Status:** Not Tested

---

### Test 22: Bidirectional sync — word wrap toggle

**Type**: E2E Test
**Category**: Functional
**Covers**: US-007, BR-003

**Preconditions**
- App launched on any platform
- A file is open in the editor

**Steps**

1. Word wrap starts as off (default)
2. Toggle word wrap via View menu (custom MenuBar on Win/Linux, or via sendIPC on macOS)
3. Check native menu item `toggle-word-wrap` checked state
4. Check Monaco editor option `wordWrap`

**Expected Result**

- Native menu checkbox reflects `true`
- Monaco editor wordWrap option is `'on'`

**Status:** Not Tested

---

### Test 23: Editor context menu — appears on right-click

**Type**: E2E Test
**Category**: Functional
**Covers**: US-009

**Preconditions**
- App launched on any platform
- A file is open with content in the editor

**Steps**

1. Click `.monaco-editor textarea` to focus editor
2. Right-click inside the editor area
3. Wait for context menu to appear

**Expected Result**

- A styled context menu (Radix UI, not Monaco built-in) appears near the click position
- Contains items: Cut, Copy, Paste, Select All, Go to Line..., Toggle Comment, Convert Case

**Status:** Not Tested

---

### Test 24: Editor context menu — Cut/Copy/Paste work

**Type**: E2E Test
**Category**: Functional
**Covers**: US-009

**Preconditions**
- App launched on any platform
- A file is open with text "hello world" in the editor

**Steps**

1. Select "hello" in the editor (Ctrl+Shift+Right or double-click)
2. Right-click to open context menu
3. Click "Cut"
4. Verify editor content is now " world" (with leading space)
5. Right-click again
6. Click "Paste"
7. Verify editor content is restored to "hello world"

**Expected Result**

- Cut removes selected text and places it on clipboard
- Paste inserts clipboard content at cursor

**Status:** Not Tested

---

### Test 25: Editor context menu — Toggle Comment

**Type**: E2E Test
**Category**: Functional
**Covers**: US-009

**Preconditions**
- A JavaScript file is open with line: `const x = 1`
- Cursor is on that line

**Steps**

1. Right-click in the editor
2. Click "Toggle Comment"

**Expected Result**

- Line becomes `// const x = 1`
- Right-clicking and toggling again removes the comment prefix

**Status:** Not Tested

---

### Test 26: Editor context menu — Convert Case submenu

**Type**: E2E Test
**Category**: Functional
**Covers**: US-009

**Preconditions**
- A file is open with text "Hello World"
- "Hello World" is selected

**Steps**

1. Right-click in the editor
2. Hover over "Convert Case" to open submenu
3. Click "UPPERCASE"

**Expected Result**

- Selected text becomes "HELLO WORLD"

**Status:** Not Tested

---

### Test 27: Editor context menu — Monaco built-in menu suppressed

**Type**: E2E Test
**Category**: Edge Case
**Covers**: US-009

**Preconditions**
- App launched on any platform
- A file is open in the editor

**Steps**

1. Right-click in the editor
2. Inspect the DOM for Monaco's default context menu (`.monaco-editor .context-view`)

**Expected Result**

- Monaco's built-in context menu (`.context-view`) does NOT appear
- Only the custom Radix UI context menu is visible

**Status:** Not Tested

---

### Test 28: Editor context menu — closes on click outside

**Type**: E2E Test
**Category**: Edge Case
**Covers**: US-009

**Preconditions**
- Context menu is open after right-clicking in editor

**Steps**

1. Right-click in editor to open context menu
2. Click on the tab bar (outside the context menu)

**Expected Result**

- Context menu disappears
- No action is triggered

**Status:** Not Tested

---

### Test 29: Disabled items — cannot be clicked

**Type**: E2E Test
**Category**: Functional
**Covers**: US-010, BR-006

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Macro" menu button
2. Attempt to click "Start Recording" (disabled item)
3. Check that no recording started (no visual indicator of recording mode)

**Expected Result**

- Click on disabled item has no effect
- No console errors
- Menu remains open (or closes normally without triggering action)

**Status:** Not Tested

---

### Test 30: Disabled items — correct visual styling

**Type**: E2E Test
**Category**: Functional
**Covers**: US-010

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Macro" menu button
2. Inspect CSS of "Start Recording" item

**Expected Result**

- Disabled items have reduced opacity (e.g., `opacity: 0.4` or similar)
- Disabled items have `pointer-events: none` or equivalent (no hover effect)

**Status:** Not Tested

---

### Test 31: File menu — New File action works

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "File" menu
2. Click "New File"
3. Wait for tab bar update

**Expected Result**

- A new tab appears (e.g., "Untitled 1")
- Editor area is empty and focused
- Menu dropdown closes after click

**Status:** Not Tested

---

### Test 32: View menu — Toggle Toolbar hides/shows toolbar

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005, US-007

**Preconditions**
- App launched on Windows/Linux
- Toolbar initially visible
- Skip on macOS

**Steps**

1. Click "View" menu
2. Click "Toggle Toolbar" (or equivalent label like "Hide Toolbar")
3. Verify toolbar disappears
4. Click "View" menu again
5. Click "Toggle Toolbar" (now "Show Toolbar")
6. Verify toolbar reappears

**Expected Result**

- Toolbar (`[data-testid="toolbar"]`) toggles visibility
- Menu label updates to reflect current state ("Hide Toolbar" / "Show Toolbar")

**Status:** Not Tested

---

### Test 33: Encoding menu — switch to UTF-16 LE

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- A file is open
- Skip on macOS

**Steps**

1. Click "Encoding" menu
2. Click "UTF-16 LE"
3. Check status bar for encoding indicator

**Expected Result**

- Status bar encoding display updates to show "UTF-16 LE" (or equivalent)

**Status:** Not Tested

---

### Test 34: Language menu — switch language to Python

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- A file is open (default: plain text)
- Skip on macOS

**Steps**

1. Click "Language" menu
2. Click "Python"
3. Check status bar for language indicator

**Expected Result**

- Status bar language display updates to "Python"
- Editor syntax highlighting updates accordingly

**Status:** Not Tested

---

### Test 35: Window menu — Next Tab / Previous Tab

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Two or more files/tabs are open
- First tab is active
- Skip on macOS

**Steps**

1. Click "Window" menu
2. Click "Next Tab"
3. Verify second tab is now active
4. Click "Window" menu
5. Click "Previous Tab"
6. Verify first tab is now active

**Expected Result**

- Active tab switches correctly in both directions
- Tab bar visual indicator (active highlight) updates

**Status:** Not Tested

---

### Test 36: Help menu — About NovaPad opens dialog

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "Help" menu
2. Click "About NovaPad"

**Expected Result**

- About dialog opens showing app name and version

**Status:** Not Tested

---

### Test 37: Settings menu — Toggle Dark Mode

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Default theme is dark
- Skip on macOS

**Steps**

1. Click "Settings" menu
2. Click "Toggle Dark Mode" (or "Light Mode")
3. Check `<html>` class

**Expected Result**

- `<html>` class toggles: `dark` removed (now light) or added (now dark)
- UI colors change to reflect new theme

**Status:** Not Tested

---

### Test 38: Menu dropdown closes after item click

**Type**: E2E Test
**Category**: Edge Case
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "File" menu to open dropdown
2. Click "New File"
3. Check if dropdown is still visible

**Expected Result**

- Dropdown closes immediately after clicking a menu item
- New file is created (action still fires)

**Status:** Not Tested

---

### Test 39: Menu hover-to-switch between top-level menus

**Type**: E2E Test
**Category**: Edge Case
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "File" menu to open dropdown
2. Hover mouse over "Edit" label (without clicking)
3. Check which dropdown is visible

**Expected Result**

- File dropdown closes, Edit dropdown opens
- Hover switching works for all adjacent menus

**Status:** Not Tested

---

### Test 40: Menu click outside closes dropdown

**Type**: E2E Test
**Category**: Edge Case
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- Skip on macOS

**Steps**

1. Click "File" menu to open dropdown
2. Click on the editor area (outside any menu)

**Expected Result**

- Dropdown closes
- No menu action fires

**Status:** Not Tested

---

### Test 41: Native menu Reload from Disk triggers editor reload

**Type**: E2E Test
**Category**: Integration
**Covers**: US-008

**Preconditions**
- A file is open in the editor
- File content has been modified externally (simulated)

**Steps**

1. Send IPC: `sendIPC(electronApp, 'menu:file-reload')`
2. Wait for editor content to update

**Expected Result**

- Editor content reloads from disk
- If file was externally modified, new content appears

**Status:** Not Tested

---

### Test 42: macOS traffic lights not blocked by QuickStrip

**Type**: E2E Test
**Category**: Edge Case
**Covers**: US-001

**Preconditions**
- App launched on macOS
- Skip on Windows/Linux

**Steps**

1. Launch the app
2. Check that QuickStrip has a left spacer of ~78px
3. Verify the spacer area does not contain any interactive elements

**Expected Result**

- Traffic light spacer div exists with width ~78px
- No buttons or clickable elements within the spacer area
- macOS close/minimize/maximize buttons are accessible (not visually verifiable in Playwright, but spacer ensures no overlap)

**Status:** Not Tested

---

### Test 43: Bidirectional sync — multiple toggles in sequence

**Type**: E2E Test
**Category**: Edge Case
**Covers**: BR-003, BR-004

**Preconditions**
- App launched on any platform

**Steps**

1. Toggle sidebar ON via renderer
2. Toggle toolbar OFF via native menu IPC
3. Toggle statusbar OFF via renderer
4. Toggle sidebar OFF via native menu IPC
5. Read all three states from renderer and native menu

**Expected Result**

- Renderer state: sidebar=false, toolbar=false, statusbar=false
- Native menu state: sidebar=unchecked, toolbar=unchecked, statusbar=unchecked
- All states match between renderer and native menu

**Status:** Not Tested

---

### Test 44: Disabled items in native menu

**Type**: E2E Test
**Category**: Functional
**Covers**: US-010, BR-006

**Preconditions**
- App launched on any platform

**Steps**

1. Use `electronApp.evaluate()` to read native menu item state for:
   - `Menu.getApplicationMenu().getMenuItemById('macro-stop').enabled`
   - `Menu.getApplicationMenu().getMenuItemById('toggle-split-view')` (if it has enabled=false)

**Expected Result**

- Stubbed items in native menu have `enabled: false`

**Status:** Not Tested

---

### Test 45: Editor context menu — Go to Line

**Type**: E2E Test
**Category**: Functional
**Covers**: US-009

**Preconditions**
- A file with multiple lines is open

**Steps**

1. Right-click in the editor
2. Click "Go to Line..."
3. Check if Go to Line input/dialog appears (Monaco's built-in or custom)

**Expected Result**

- Go to Line prompt appears
- User can enter a line number to navigate

**Status:** Not Tested

---

### Test 46: Empty state — menus work with no file open

**Type**: E2E Test
**Category**: Edge Case

**Preconditions**
- App launched with no files open (welcome screen visible)

**Steps**

1. Click "File" menu (Windows/Linux) or use native menu (macOS)
2. Click "New File"
3. Verify a new tab opens
4. Click "Edit" menu
5. Verify Undo/Redo are available (may be disabled if nothing to undo — that's OK)

**Expected Result**

- Menus function correctly even with no file open
- "New File" creates a buffer
- No crashes or errors in empty state

**Status:** Not Tested

---

### Test 47: Edit menu — Toggle Comment dispatches editor command

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- A JavaScript file is open with content `const x = 1`
- Cursor is on that line
- Skip on macOS

**Steps**

1. Click "Edit" menu
2. Click "Toggle Comment"

**Expected Result**

- Line becomes `// const x = 1`
- Editor content updates immediately

**Status:** Not Tested

---

### Test 48: View menu — Zoom In increases editor font size

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005

**Preconditions**
- App launched on Windows/Linux
- A file is open
- Skip on macOS

**Steps**

1. Note initial editor font size
2. Click "View" menu
3. Click "Zoom In"
4. Check editor font size

**Expected Result**

- Editor font size increases from baseline

**Status:** Not Tested
