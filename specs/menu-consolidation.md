# Menu Consolidation

## Application Overview

NovaPad is an Electron + React + Monaco Editor desktop application (Notepad++ clone). The Menu Consolidation feature introduces a platform-conditional UI. On macOS (darwin), the custom MenuBar React component (src/renderer/src/components/editor/MenuBar.tsx) returns null and is entirely absent from the DOM. Instead, a dedicated QuickStrip component (src/renderer/src/components/editor/QuickStrip.tsx) renders as a 48px-tall title bar row that carries the NovaPad app icon, brand name, and three quick-action buttons: Find, Sidebar toggle, and Theme toggle. On Windows/Linux, the custom MenuBar renders with 11 top-level menus: File, Edit, Search, View, Encoding, Language, Settings, Macro, Plugins, Window, Help. Several menu items are visible but intentionally disabled (Bookmarks, Macro recording/playback, Split View, Plugin Manager, Shortcut Mapper, UDL Editor, Style Configurator). All menu-driven operations fire IPC events handled via Zustand store actions. An editor context menu (Radix UI ContextMenu) wraps the Monaco editor and appears on right-click on all platforms — Monaco's built-in context menu is suppressed via contextmenu:false. Bidirectional state sync keeps renderer toggle state and native macOS menu checkboxes in agreement through the ui:state-changed IPC channel. The window is configured with autoHideMenuBar: process.platform !== 'darwin' (false on macOS). All tests in this plan are designed for macOS where QuickStrip is the primary rendered UI element and the custom MenuBar is hidden.

## Test Scenarios

### 1. 1. Platform Rendering — macOS DOM Constraints

**Seed:** `tests/ui-redesign.spec.ts`

#### 1.1. 1.1 Custom MenuBar is absent from the DOM on macOS

**File:** `tests/menu-consolidation/platform-rendering.spec.ts`

**Steps:**
  1. Launch the app with E2E_TEST=1 and wait for [data-testid="app"] to be visible
    - expect: The app shell renders successfully
  2. Query the DOM for an element matching [data-testid="menubar"] using page.locator('[data-testid="menubar"]').count()
    - expect: The count is 0 — no element with data-testid="menubar" exists because MenuBar.tsx returns null on darwin

#### 1.2. 1.2 QuickStrip is present and visible on macOS startup

**File:** `tests/menu-consolidation/platform-rendering.spec.ts`

**Steps:**
  1. Wait for [data-testid="app"] to be visible
  2. Assert that [data-testid="quickstrip"] is visible using expect(page.locator('[data-testid="quickstrip"]')).toBeVisible()
    - expect: The QuickStrip element is present and visible — it is conditionally rendered only when window.api.platform === 'darwin'

#### 1.3. 1.3 QuickStrip contains all three quick-action buttons

**File:** `tests/menu-consolidation/platform-rendering.spec.ts`

**Steps:**
  1. Assert [data-testid="quickstrip-find"] is visible
    - expect: The Find quick-action button is visible inside QuickStrip
  2. Assert [data-testid="quickstrip-sidebar"] is visible
    - expect: The Sidebar toggle button is visible inside QuickStrip
  3. Assert [data-testid="quickstrip-theme"] is visible
    - expect: The Theme toggle button is visible inside QuickStrip

#### 1.4. 1.4 QuickStrip displays NovaPad brand name and app icon monogram

**File:** `tests/menu-consolidation/platform-rendering.spec.ts`

**Steps:**
  1. Within [data-testid="quickstrip"], search for text 'NovaPad'
    - expect: Text 'NovaPad' is visible
  2. Within [data-testid="quickstrip"], search for text 'N+'
    - expect: Text 'N+' is visible as the app icon monogram

#### 1.5. 1.5 QuickStrip height is 48 pixels

**File:** `tests/menu-consolidation/platform-rendering.spec.ts`

**Steps:**
  1. Evaluate document.querySelector('[data-testid="quickstrip"]').getBoundingClientRect().height in the page context via page.evaluate()
    - expect: The height is exactly 48 pixels, matching the h-12 Tailwind class

#### 1.6. 1.6 autoHideMenuBar is false on macOS

**File:** `tests/menu-consolidation/platform-rendering.spec.ts`

**Steps:**
  1. Via electronApp.evaluate, execute ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].autoHideMenuBar
    - expect: The value is false — on darwin the condition process.platform !== 'darwin' evaluates to false, so the native menu bar is never auto-hidden

#### 1.7. 1.7 App renders in dark mode by default on startup

**File:** `tests/menu-consolidation/platform-rendering.spec.ts`

**Steps:**
  1. Evaluate document.documentElement.classList.contains('dark') in the page context
    - expect: Returns true — the uiStore initializes with theme: 'dark' and the useEffect in App.tsx applies document.documentElement.classList.add('dark')

### 2. 2. QuickStrip — Find Button

**Seed:** `tests/ui-redesign.spec.ts`

#### 2.1. 2.1 Find button opens the Find & Replace dialog in Find mode

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Verify the Find & Replace dialog is not visible: expect(page.getByText('Find & Replace')).not.toBeVisible()
    - expect: No dialog heading is present — showFindReplace defaults to false
  2. Click [data-testid="quickstrip-find"]
  3. Assert the dialog heading 'Find & Replace' becomes visible and the 'Find' tab is active
    - expect: The Find & Replace dialog opens in Find mode
    - expect: The 'Find' tab button has the active styling

#### 2.2. 2.2 Escape key closes the Find & Replace dialog

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Click [data-testid="quickstrip-find"] to open the dialog
    - expect: Find & Replace dialog is visible
  2. Press the Escape key using page.keyboard.press('Escape')
    - expect: The Find & Replace dialog closes — the keydown handler calls closeFind() which sets showFindReplace=false

#### 2.3. 2.3 Close button (✕) in dialog title bar dismisses the dialog

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Click [data-testid="quickstrip-find"] to open the dialog
  2. Click the ✕ close button in the dialog title bar
    - expect: The dialog closes and is no longer visible

#### 2.4. 2.4 Clicking Find button twice does not create duplicate dialogs

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Click [data-testid="quickstrip-find"] once, then click it again
    - expect: Only one Find & Replace dialog instance exists in the DOM — the openFind store action is idempotent

### 3. 3. QuickStrip — Sidebar Toggle Button

**Seed:** `tests/ui-redesign.spec.ts`

#### 3.1. 3.1 Sidebar button opens the sidebar when it is hidden

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Assert [data-testid="sidebar"] is not visible (showSidebar initializes to false)
  2. Click [data-testid="quickstrip-sidebar"]
    - expect: [data-testid="sidebar"] becomes visible

#### 3.2. 3.2 Sidebar button closes the sidebar when it is visible

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Click [data-testid="quickstrip-sidebar"] to open the sidebar
    - expect: Sidebar is visible
  2. Click [data-testid="quickstrip-sidebar"] again
    - expect: [data-testid="sidebar"] is hidden

#### 3.3. 3.3 Sidebar button title attribute reflects current sidebar state

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Read the title attribute of [data-testid="quickstrip-sidebar"] with sidebar hidden
    - expect: Title is 'Show Explorer'
  2. Click to open sidebar, then read the title again
    - expect: Title is 'Hide Explorer'

#### 3.4. 3.4 Sidebar toggle from renderer syncs to native menu checkbox (bidirectional)

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Via electronApp.evaluate, read the native menu item: ({ Menu }) => Menu.getApplicationMenu().getMenuItemById('toggle-sidebar').checked
    - expect: Initial value is false (sidebar starts hidden)
  2. Click [data-testid="quickstrip-sidebar"] to open the sidebar
    - expect: Sidebar becomes visible
  3. Read the native menu item checked state again via electronApp.evaluate
    - expect: The value is now true — setShowSidebar(true) called syncToggleToMain('showSidebar', true) which sent 'ui:state-changed' to main, and the ipcMain handler updated item.checked

#### 3.5. 3.5 Native IPC 'ui:toggle-sidebar' controls sidebar visibility from the main process side

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Send IPC 'ui:toggle-sidebar' with argument true via electronApp.evaluate: BrowserWindow.getAllWindows()[0].webContents.send('ui:toggle-sidebar', true)
    - expect: [data-testid="sidebar"] becomes visible
  2. Send IPC 'ui:toggle-sidebar' with argument false
    - expect: [data-testid="sidebar"] is hidden again

### 4. 4. QuickStrip — Theme Toggle Button

**Seed:** `tests/ui-redesign.spec.ts`

#### 4.1. 4.1 App starts in dark mode; theme button title indicates light mode is next

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Evaluate document.documentElement.classList.contains('dark')
    - expect: Returns true
  2. Read the title attribute of [data-testid="quickstrip-theme"]
    - expect: Title is 'Switch to light mode' — the Moon icon is shown when in dark mode

#### 4.2. 4.2 Theme button toggles from dark to light mode

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Click [data-testid="quickstrip-theme"]
    - expect: The 'dark' class is removed from the html element
    - expect: The title of quickstrip-theme changes to 'Switch to dark mode'

#### 4.3. 4.3 Theme button toggles from light back to dark mode

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Click [data-testid="quickstrip-theme"] once to enter light mode, then click again
    - expect: The 'dark' class is restored to the html element
    - expect: Title reverts to 'Switch to light mode'

#### 4.4. 4.4 Native 'ui:toggle-theme' IPC updates the theme from the main-process side

**File:** `tests/menu-consolidation/quickstrip.spec.ts`

**Steps:**
  1. Send IPC 'ui:toggle-theme' via electronApp.evaluate: BrowserWindow.getAllWindows()[0].webContents.send('ui:toggle-theme')
    - expect: The html element's 'dark' class is toggled
    - expect: The title attribute of [data-testid="quickstrip-theme"] updates to reflect the new mode

### 5. 5. Editor Context Menu

**Seed:** `tests/ui-redesign.spec.ts`

#### 5.1. 5.1 Right-clicking the Monaco editor shows the custom Radix context menu

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Click .monaco-editor textarea to focus the editor
  2. Right-click on the Monaco editor container inside [data-testid="editor-pane"]
    - expect: A custom context menu appears containing 'Cut', 'Copy', 'Paste' items
    - expect: Monaco's own built-in context menu is NOT shown (contextmenu:false in EditorPane)

#### 5.2. 5.2 Context menu has all expected top-level items

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Right-click the Monaco editor to open the context menu
  2. Assert visibility of: 'Cut', 'Copy', 'Paste', 'Select All', 'Go to Line...', 'Toggle Comment', 'Convert Case'
    - expect: All seven items are present and visible in the context menu

#### 5.3. 5.3 Context menu uses macOS ⌘ modifier in keyboard shortcut hints

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Open the context menu and locate the keyboard shortcut text next to 'Cut'
    - expect: The shortcut reads '⌘+X' — the EditorContextMenu component checks window.api.platform === 'darwin' and uses the ⌘ symbol

#### 5.4. 5.4 Context menu closes on outside click

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Open the context menu via right-click
    - expect: Context menu is visible
  2. Click on a different area outside the context menu (e.g., the tab bar or an empty area)
    - expect: The context menu closes and disappears from the DOM

#### 5.5. 5.5 'Convert Case > UPPERCASE' transforms selected text in the editor

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Click .monaco-editor textarea, type 'hello world', then select all with Cmd+A
  2. Right-click, hover 'Convert Case' submenu trigger, then click 'UPPERCASE'
    - expect: The text in the editor changes to 'HELLO WORLD' — editorCmd('toUpperCase') fires a CustomEvent 'editor:command' that EditorPane handles via Monaco's editor.action.transformToUppercase

#### 5.6. 5.6 'Convert Case > lowercase' transforms selected text in the editor

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Type 'HELLO WORLD', select all, right-click, hover 'Convert Case', click 'lowercase'
    - expect: The text becomes 'hello world'

#### 5.7. 5.7 'Convert Case > Title Case' transforms selected text in the editor

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Type 'hello world', select all, right-click, hover 'Convert Case', click 'Title Case'
    - expect: The text becomes 'Hello World'

#### 5.8. 5.8 'Toggle Comment' wraps the current line in a comment

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Click .monaco-editor textarea, type 'console.log("test")', position cursor on that line
  2. Right-click and click 'Toggle Comment' in the context menu
    - expect: Monaco's editor.action.commentLine action fires
    - expect: A comment token appears at the start of the line

#### 5.9. 5.9 'Go to Line...' opens Monaco go-to-line widget

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Type multiple lines in the editor, right-click, click 'Go to Line...'
    - expect: Monaco's built-in Go to Line overlay widget appears, allowing line number entry

#### 5.10. 5.10 Context menu does not appear when right-clicking outside the editor pane

**File:** `tests/menu-consolidation/context-menu.spec.ts`

**Steps:**
  1. Right-click on [data-testid="tabbar"]
    - expect: The custom editor context menu does NOT appear — the EditorContextMenu ContextMenuTrigger only wraps [data-testid="editor-pane"]

### 6. 6. Bidirectional State Sync — Native Menu → Renderer

**Seed:** `tests/ui-redesign.spec.ts`

#### 6.1. 6.1 'ui:toggle-toolbar' IPC with false hides the toolbar

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Assert [data-testid="toolbar"] is visible (showToolbar defaults to true)
  2. Send IPC 'ui:toggle-toolbar' with false: webContents.send('ui:toggle-toolbar', false)
    - expect: [data-testid="toolbar"] becomes hidden — setShowToolbar(false, fromMain=true) suppresses redundant syncToggleToMain to prevent infinite loops
  3. Restore by sending 'ui:toggle-toolbar' with true
    - expect: [data-testid="toolbar"] becomes visible again

#### 6.2. 6.2 'ui:toggle-statusbar' IPC hides and restores the status bar

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Send 'menu:file-new' IPC to create a buffer so the status bar renders, then assert [data-testid="statusbar"] is visible
  2. Send IPC 'ui:toggle-statusbar' with false
    - expect: [data-testid="statusbar"] becomes hidden
  3. Send IPC 'ui:toggle-statusbar' with true
    - expect: [data-testid="statusbar"] reappears

#### 6.3. 6.3 'ui:toggle-sidebar' IPC with true shows the sidebar

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Confirm [data-testid="sidebar"] is not visible
  2. Send IPC 'ui:toggle-sidebar' with true
    - expect: [data-testid="sidebar"] becomes visible

#### 6.4. 6.4 Renderer toggle syncs to native menu checkbox via ui:state-changed IPC

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Read native menu item: ({ Menu }) => Menu.getApplicationMenu().getMenuItemById('toggle-sidebar').checked
    - expect: Returns false initially
  2. Click [data-testid="quickstrip-sidebar"] to toggle sidebar open
    - expect: Sidebar becomes visible
  3. Read the native menu item checked state again
    - expect: Returns true — the ipcMain.on('ui:state-changed') handler set item.checked = true when the renderer sent the syncToggleToMain message

#### 6.5. 6.5 'ui:toggle-theme' IPC toggles dark/light mode

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Confirm html element has 'dark' class
  2. Send IPC 'ui:toggle-theme'
    - expect: The 'dark' class is removed from the html element
  3. Send IPC 'ui:toggle-theme' again
    - expect: The 'dark' class is restored

#### 6.6. 6.6 'menu:find' IPC opens Find & Replace dialog in Find mode

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Send IPC 'menu:find' via electronApp.evaluate
    - expect: The Find & Replace dialog opens with the 'Find' tab active

#### 6.7. 6.7 'menu:replace' IPC opens Find & Replace dialog in Replace mode

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Send IPC 'menu:replace' via electronApp.evaluate
    - expect: The Find & Replace dialog opens with the 'Replace' tab active

#### 6.8. 6.8 'menu:find-in-files' IPC opens dialog in Find in Files mode

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Send IPC 'menu:find-in-files' via electronApp.evaluate
    - expect: The Find & Replace dialog opens with the 'Find in Files' tab active

#### 6.9. 6.9 'menu:about' IPC opens the About dialog

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Send IPC 'menu:about' via electronApp.evaluate
    - expect: The About dialog becomes visible
    - expect: The dialog contains the text 'NovaPad' and a version string

#### 6.10. 6.10 'menu:file-new' IPC creates a new buffer tab

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Count [data-tab-title] elements before sending the IPC
  2. Send IPC 'menu:file-new' via electronApp.evaluate
    - expect: A new tab appears and the tab count increases by 1

#### 6.11. 6.11 'tab:next' and 'tab:prev' IPC navigate between tabs

**File:** `tests/menu-consolidation/bidirectional-sync.spec.ts`

**Steps:**
  1. Send 'menu:file-new' twice to create two tabs
    - expect: Two tabs exist
  2. Send IPC 'tab:prev'
    - expect: The first tab becomes active
  3. Send IPC 'tab:next'
    - expect: The second tab becomes active

### 7. 7. Disabled Stubbed Items in the Native Menu

**Seed:** `tests/ui-redesign.spec.ts`

#### 7.1. 7.1 Search menu Bookmark items are disabled (enabled: false)

**File:** `tests/menu-consolidation/disabled-items.spec.ts`

**Steps:**
  1. Via electronApp.evaluate, traverse the application menu to find the Search submenu and inspect the enabled property of 'Toggle Bookmark', 'Next Bookmark', 'Previous Bookmark', 'Clear All Bookmarks' items
    - expect: All four items have enabled: false in the native menu — set explicitly in menu.ts

#### 7.2. 7.2 Macro menu items (Start Recording, Stop Recording, Playback) are disabled

**File:** `tests/menu-consolidation/disabled-items.spec.ts`

**Steps:**
  1. Via electronApp.evaluate, access the Macro submenu and check enabled for 'Start Recording', 'Stop Recording', 'Playback'
    - expect: All three have enabled: false

#### 7.3. 7.3 Plugins menu Plugin Manager item is disabled

**File:** `tests/menu-consolidation/disabled-items.spec.ts`

**Steps:**
  1. Via electronApp.evaluate, find 'Plugin Manager...' in the Plugins submenu
    - expect: enabled: false

#### 7.4. 7.4 Settings menu stubbed items (Shortcut Mapper, UDL Editor, Style Configurator) are disabled

**File:** `tests/menu-consolidation/disabled-items.spec.ts`

**Steps:**
  1. Via electronApp.evaluate, check enabled for 'Shortcut Mapper...', 'User Defined Languages...', 'Style Configurator...' in the Settings submenu
    - expect: All three have enabled: false

#### 7.5. 7.5 View menu Split View checkbox item is disabled

**File:** `tests/menu-consolidation/disabled-items.spec.ts`

**Steps:**
  1. Via electronApp.evaluate, retrieve the menu item by id: Menu.getApplicationMenu().getMenuItemById('toggle-split-view')
    - expect: The item exists as a checkbox type with enabled: false

#### 7.6. 7.6 IPC channels for disabled items do not crash the renderer when called directly

**File:** `tests/menu-consolidation/disabled-items.spec.ts`

**Steps:**
  1. Send IPC 'menu:shortcut-mapper' directly to the renderer via electronApp.evaluate
    - expect: No JavaScript exception is thrown — the renderer handles it by setting showShortcutMapper=true in the store
  2. Send IPC 'menu:udl-editor'
    - expect: No crash — showUDLEditor is set to true
  3. Send IPC 'menu:style-configurator'
    - expect: No crash — showStyleConfigurator is set to true
  4. Check the browser console for error-level messages
    - expect: Zero unhandled errors in the renderer console after sending stub IPC channels
