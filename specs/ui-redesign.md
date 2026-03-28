# UI Redesign Test Plan

## Application Overview

Notepad and More is an Electron + React + Monaco Editor desktop app (Notepad++ clone). This test plan covers the UI redesign features introduced on the `feature/ui-style-redesign` branch: the TopAppBar glass header, SideNav 80px left navigation rail, custom portal Tooltip component, redesigned Sidebar, redesigned StatusBar, and the MD3 teal CSS variable palette. All tests use the custom Playwright fixture in `tests/fixtures.ts`, which launches `out/main/index.js` with `E2E_TEST=1` and waits for `[data-testid="app"]`, `.monaco-editor textarea`, and a visible tab before handing the page to each test. CSS Modules hash all class names — only `data-testid`, ARIA roles, text content, and computed styles are used for assertions.

## Test Scenarios

### 1. TopAppBar

**Seed:** `tests/seed.spec.ts`

#### 1.1. TopAppBar renders and is visible on startup

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Launch app fresh (fixture handles this).
  2. Assert `[data-testid="topbar"]` is visible.
    - expect: The TopAppBar header element is present in the DOM and visible.
  3. Assert the element has height 64 px by evaluating `document.querySelector('[data-testid="topbar"]').getBoundingClientRect().height`.
    - expect: Computed height equals 64.

#### 1.2. TopAppBar displays brand name 'Notepad & More'

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Locate `[data-testid="topbar"]` and within it find the element containing the text 'Notepad & More'.
    - expect: The brand name text 'Notepad & More' is visible inside the topbar.

#### 1.3. TopAppBar brand name has teal accent colour

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Query the element that contains text 'Notepad & More' inside `[data-testid="topbar"]`.
  2. Evaluate `getComputedStyle(el).color` on that element.
    - expect: The computed colour resolves to the teal accent value (rgb(104, 229, 203) / #68e5cb in dark theme).

#### 1.4. TopAppBar has glass-effect background (semi-transparent dark)

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Evaluate `getComputedStyle(document.querySelector('[data-testid="topbar"]')).backgroundColor` in the renderer.
    - expect: The background colour value contains an alpha channel less than 1 (e.g. rgba(15, 15, 15, 0.92)), confirming the glass/frosted style rather than a solid colour.

#### 1.5. TopAppBar New button click creates a new untitled tab

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Count the current number of `[data-tab-title]` elements.
  2. Click the 'New' icon button (FilePlus icon) inside `[data-testid="topbar"]`. It is the first button in the actions group.
  3. Assert that a new `[data-tab-title]` element has appeared, making the total count one more than before.
    - expect: A new untitled tab (e.g. 'new 2') appears in the tab bar.

#### 1.6. TopAppBar Save button click is wired (no crash on clean buffer)

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Ensure there is an active untitled buffer (fresh state from fixture).
  2. Click the Save icon button (third button in the topbar actions group).
  3. Assert no JavaScript error is thrown (check browser console) and the app remains responsive — `[data-testid="app"]` is still visible.
    - expect: No crash. Because the buffer has no file path, the Save-As dialog would appear (but in E2E test mode a native dialog appears which blocks; testing only that the click is handled without error).

#### 1.7. TopAppBar Close button closes the active tab

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Send IPC `menu:file-new` to ensure at least two tabs are open so closing one does not leave zero tabs.
  2. Record the current active tab title.
  3. Click the Close (X) icon button — the last button in the topbar actions group.
  4. Assert the previously active tab title is no longer present in the tab bar.
    - expect: The active tab is closed. A different tab becomes active.

#### 1.8. TopAppBar quick search input accepts text and pressing Enter triggers Find

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Locate the search `<input>` inside `[data-testid="topbar"]` (placeholder text 'Quick search...').
  2. Click the input to focus it.
    - expect: The search input gains focus. The border transitions to the teal accent colour via `:focus-within` on the wrapper.
  3. Type the text 'hello'.
    - expect: The text 'hello' appears in the search input.
  4. Press Enter.
    - expect: The Find/Replace dialog opens (the `openFind('find')` callback is invoked). Assert `[data-testid="find-replace-dialog"]` or similar becomes visible.

#### 1.9. TopAppBar quick search Escape blurs the input without opening Find

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Click the quick search input.
  2. Type 'abc'.
  3. Press Escape.
    - expect: The input loses focus (the blur handler fires). The Find dialog does NOT open.

#### 1.10. TopAppBar is hidden when toolbar is toggled off via IPC

**File:** `tests/ui-redesign/topappbar.spec.ts`

**Steps:**
  1. Assert `[data-testid="topbar"]` is visible.
  2. Send IPC `ui:toggle-toolbar` with argument `false`.
  3. Assert `[data-testid="topbar"]` is no longer visible in the DOM.
    - expect: The TopAppBar unmounts when `showToolbar` is false in the UIStore.
  4. Send IPC `ui:toggle-toolbar` with argument `true` to restore state.
    - expect: The TopAppBar reappears.

### 2. SideNav

**Seed:** `tests/seed.spec.ts`

#### 2.1. SideNav renders and is exactly 80 px wide

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Assert `[data-testid="sidenav"]` is visible.
  2. Evaluate `document.querySelector('[data-testid="sidenav"]').getBoundingClientRect().width`.
    - expect: The width is 80.

#### 2.2. SideNav logo icon is rendered at the top

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Within `[data-testid="sidenav"]`, assert an SVG icon is present near the top of the nav (the Feather icon logo).
    - expect: An SVG element is found inside the logo section of the SideNav.

#### 2.3. SideNav renders all 6 nav item labels

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Within `[data-testid="sidenav"]`, assert the following text labels are all visible: 'Files', 'Search', 'View', 'Symbols', 'Tools', 'Plugins'.
    - expect: All 6 nav item labels are visible inside the SideNav.

#### 2.4. SideNav renders Undo and Redo buttons at the bottom

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Locate `[data-testid="sidenav"]` and find all buttons with SVG icons in the bottom-actions section (the last group of buttons).
  2. Assert there are exactly 2 buttons in the bottom-actions area.
    - expect: The Undo and Redo icon buttons are present at the bottom of the SideNav.

#### 2.5. SideNav Files button opens the Sidebar with 'File Browser' panel

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Assert `[data-testid="sidebar"]` is not visible initially.
  2. Click the button labelled 'Files' inside `[data-testid="sidenav"]`.
  3. Assert `[data-testid="sidebar"]` becomes visible.
  4. Assert the sidebar header title contains 'FILE BROWSER' (uppercase, as styled by CSS text-transform).
    - expect: The Sidebar opens and shows the File Browser panel title in the header.

#### 2.6. SideNav Files button is active (teal border) when Sidebar is open on Files panel

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Click the 'Files' button in `[data-testid="sidenav"]` to open the sidebar.
  2. Evaluate `getComputedStyle(document.querySelector('[data-testid="sidenav"] button:nth-child(1)')).borderLeftColor` — or check that the active class is applied by evaluating the element's class list.
    - expect: The border-left-color of the active Files button resolves to the teal accent (rgb(104, 229, 203)), confirming the active state visual indicator.

#### 2.7. SideNav Files button toggles Sidebar closed on second click

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Click the 'Files' button to open the sidebar.
    - expect: Sidebar becomes visible.
  2. Click the 'Files' button again.
    - expect: Sidebar is hidden. The Files button is no longer in active state.

#### 2.8. SideNav Symbols button switches Sidebar to Symbols panel

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Click 'Files' button to open the sidebar on the Files panel.
  2. Click the 'Symbols' button in the SideNav.
  3. Assert the sidebar header title contains 'SYMBOLS'.
    - expect: The Sidebar switches to the Symbols (Function List) panel without closing and reopening.
  4. Assert the 'Symbols' nav button has the active visual state and the 'Files' button does not.
    - expect: Only the Symbols button shows the teal left border active indicator.

#### 2.9. SideNav Search button opens the Find/Replace dialog

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Click the 'Search' button in `[data-testid="sidenav"]`.
  2. Assert the Find/Replace dialog opens. The UIStore `findMode` should be 'find'. Assert the find dialog is visible by checking `[data-testid="find-replace-dialog"]` or by locating the visible find input.
    - expect: The Find/Replace dialog appears. The Search SideNav button does not trigger a sidebar panel — it invokes `openFind('find')` instead.

#### 2.10. SideNav Tools button opens the Preferences dialog

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Click the 'Tools' button in `[data-testid="sidenav"]`.
  2. Assert the Preferences dialog becomes visible (locate by role 'dialog' or by its heading text 'Preferences').
    - expect: The Preferences dialog opens. The Tools button calls `setShowPreferences(true)`.

#### 2.11. SideNav Plugins button opens the Plugin Manager dialog

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Click the 'Plugins' button in `[data-testid="sidenav"]`.
  2. Assert `[data-testid="plugin-manager-dialog"]` becomes visible.
    - expect: The Plugin Manager dialog opens. The Plugins button calls `setShowPluginManager(true)`.

#### 2.12. SideNav Undo button dispatches editor:undo custom event

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Attach a listener to `window` for the 'editor:undo' custom event via `page.evaluate`: `window._undoFired = false; window.addEventListener('editor:undo', () => { window._undoFired = true })`.
  2. Click the Undo button (first button in the bottom-actions of `[data-testid="sidenav"]`).
  3. Evaluate `window._undoFired` and assert it is `true`.
    - expect: The custom event 'editor:undo' was dispatched to the window, which the EditorPane listens to.

#### 2.13. SideNav Redo button dispatches editor:redo custom event

**File:** `tests/ui-redesign/sidenav.spec.ts`

**Steps:**
  1. Attach a listener for 'editor:redo': `window._redoFired = false; window.addEventListener('editor:redo', () => { window._redoFired = true })`.
  2. Click the Redo button (second button in the bottom-actions of `[data-testid="sidenav"]`).
  3. Evaluate `window._redoFired` and assert it is `true`.
    - expect: The custom event 'editor:redo' was dispatched.

### 3. Tooltip Component

**Seed:** `tests/seed.spec.ts`

#### 3.1. Tooltip does not appear immediately on hover (300 ms delay)

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the 'Files' nav button in `[data-testid="sidenav"]`.
  2. Immediately after the hover (within ~100 ms), assert that no element with the tooltip text 'File Browser' exists in `document.body`.
    - expect: The tooltip has not yet appeared because the 300 ms setTimeout has not elapsed.
  3. Wait 400 ms.
  4. Assert the tooltip text 'File Browser' is now present in the document.
    - expect: After the 300 ms delay the tooltip portal renders into document.body and is visible.

#### 3.2. Tooltip disappears when the cursor leaves the trigger element

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the 'Files' nav button and wait 400 ms for the tooltip to appear.
    - expect: Tooltip with text 'File Browser' is visible.
  2. Move the cursor away from the button (hover over a neutral area such as `[data-testid="app"]`).
  3. Assert the tooltip text 'File Browser' is no longer present in the document.
    - expect: The tooltip portal is removed from document.body when `onMouseLeave` fires.

#### 3.3. Tooltip text is correct for each SideNav item (spot-check)

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the 'Files' button, wait 400 ms, assert tooltip text is 'File Browser'. Move away.
    - expect: Tooltip shows 'File Browser'.
  2. Hover over the 'Search' button, wait 400 ms, assert tooltip text is 'Find & Replace (Ctrl+F)'. Move away.
    - expect: Tooltip shows 'Find & Replace (Ctrl+F)'.
  3. Hover over the 'View' button, wait 400 ms, assert tooltip text is 'Document Map'. Move away.
    - expect: Tooltip shows 'Document Map'.
  4. Hover over the 'Symbols' button, wait 400 ms, assert tooltip text is 'Function List'. Move away.
    - expect: Tooltip shows 'Function List'.
  5. Hover over the 'Tools' button, wait 400 ms, assert tooltip text is 'Preferences'. Move away.
    - expect: Tooltip shows 'Preferences'.
  6. Hover over the 'Plugins' button, wait 400 ms, assert tooltip text is 'Plugin Manager'. Move away.
    - expect: Tooltip shows 'Plugin Manager'.

#### 3.4. SideNav tooltips render to the right side of the trigger

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the 'Files' button in `[data-testid="sidenav"]` and wait 400 ms.
  2. Locate the tooltip element in `document.body` and get its bounding rect via `getBoundingClientRect()`.
  3. Get the bounding rect of the 'Files' button.
  4. Assert `tooltip.left >= button.right`, confirming the tooltip is positioned to the right of the nav item.
    - expect: The 'right' side prop places the tooltip to the right of its trigger, consistent with the SideNav layout.

#### 3.5. TopAppBar tooltips render below the trigger (default 'bottom' side)

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the first icon button inside `[data-testid="topbar"]` (the New/FilePlus button) and wait 400 ms.
  2. Locate the tooltip element in `document.body` and get its bounding rect.
  3. Get the bounding rect of the New button.
  4. Assert `tooltip.top >= button.bottom`, confirming the tooltip is positioned below the button.
    - expect: The default 'bottom' side prop places the tooltip below the TopAppBar icon buttons.

#### 3.6. TopAppBar New button tooltip shows 'New (Ctrl+N)'

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the first button in `[data-testid="topbar"]`'s actions area and wait 400 ms.
  2. Assert tooltip text 'New (Ctrl+N)' is present in the document.
    - expect: Tooltip correctly labels the New file action with its keyboard shortcut.

#### 3.7. TopAppBar Save button tooltip shows 'Save (Ctrl+S)'

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the third button in `[data-testid="topbar"]`'s actions area (Save icon) and wait 400 ms.
  2. Assert tooltip text 'Save (Ctrl+S)' is present in the document.
    - expect: Save button tooltip is correctly labelled.

#### 3.8. Sidebar Close button tooltip shows 'Close Sidebar'

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Click the 'Files' nav button to open the sidebar.
  2. Hover over the close button (✕) in `[data-testid="sidebar"]`'s header and wait 400 ms.
  3. Assert tooltip text 'Close Sidebar' appears in the document.
    - expect: The Sidebar close button has a 'Close Sidebar' tooltip with the default 'bottom' side placement.

#### 3.9. Tooltip timer is cancelled if cursor leaves before 300 ms

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the 'Files' nav button.
  2. Move the cursor away within 100 ms (before the 300 ms delay elapses).
  3. Wait an additional 400 ms.
  4. Assert no tooltip with text 'File Browser' is present in the document.
    - expect: The clearTimeout in the hide() callback cancels the pending show, so no tooltip ever renders.

#### 3.10. Tooltip renders as a portal into document.body (not inside sidenav DOM subtree)

**File:** `tests/ui-redesign/tooltip.spec.ts`

**Steps:**
  1. Hover over the 'Files' nav button and wait 400 ms.
  2. Evaluate: locate the tooltip element that contains 'File Browser' text and check its parent is `document.body` (or a direct child of body), not inside `[data-testid="sidenav"]`.
    - expect: The tooltip is a React portal rendered directly into document.body — it must not be a descendant of the sidenav element.

### 4. Sidebar

**Seed:** `tests/seed.spec.ts`

#### 4.1. Sidebar is hidden on fresh app startup

**File:** `tests/ui-redesign/sidebar.spec.ts`

**Steps:**
  1. Assert `[data-testid="sidebar"]` is not visible (either absent from DOM or display:none).
    - expect: On a fresh launch the UIStore sets showSidebar=false, so the Sidebar panel is not rendered.

#### 4.2. Sidebar header title is uppercase and uses teal accent colour

**File:** `tests/ui-redesign/sidebar.spec.ts`

**Steps:**
  1. Click the 'Files' nav button to open the sidebar.
  2. Locate the header title element within `[data-testid="sidebar"]`.
  3. Assert its text content is 'FILE BROWSER' (all uppercase, either via CSS text-transform or literal uppercase string).
    - expect: The title renders as 'FILE BROWSER'. The CSS applies `text-transform: uppercase` and `font-family: Space Grotesk`.
  4. Evaluate `getComputedStyle(titleElement).color` and assert it equals the teal accent colour (rgb(104, 229, 203)).
    - expect: The header title colour is the MD3 teal accent, confirming the `color: var(--accent)` rule is applied.

#### 4.3. Sidebar close button hides the sidebar

**File:** `tests/ui-redesign/sidebar.spec.ts`

**Steps:**
  1. Click 'Files' in SideNav to open the sidebar.
    - expect: Sidebar is visible.
  2. Click the close button (✕) in the sidebar header.
  3. Assert `[data-testid="sidebar"]` is no longer visible.
    - expect: The close button calls `setShowSidebar(false)`, which hides the sidebar panel.

#### 4.4. Sidebar switches from Files to Symbols panel when Symbols nav item is clicked

**File:** `tests/ui-redesign/sidebar.spec.ts`

**Steps:**
  1. Click 'Files' in SideNav to open the Files panel.
    - expect: Sidebar header shows 'FILE BROWSER'.
  2. Click 'Symbols' in SideNav.
  3. Assert the sidebar header title now contains 'SYMBOLS'.
    - expect: The panel switches to Symbols (FunctionListPanel) without the sidebar closing.

#### 4.5. Sidebar switches from Files to Document Map (View) panel

**File:** `tests/ui-redesign/sidebar.spec.ts`

**Steps:**
  1. Open the sidebar via the 'Files' button.
  2. Click the 'View' button in SideNav.
  3. Assert the sidebar header title contains 'DOCUMENT MAP'.
    - expect: The Sidebar shows the Document Map panel.

#### 4.6. Sidebar is resizable via drag handle

**File:** `tests/ui-redesign/sidebar.spec.ts`

**Steps:**
  1. Open the sidebar via the 'Files' button.
  2. Record the initial width of `[data-testid="sidebar"]`.
  3. Locate the horizontal resize handle between the sidebar and the editor (the `hResizeHandle` element from `react-resizable-panels`). Drag it 50 px to the right.
  4. Assert the sidebar's width has increased by approximately 50 px.
    - expect: The sidebar panel is resizable. The resize handle uses the teal accent colour on hover/drag (background: var(--accent)).

#### 4.7. Sidebar does not render when showSidebar is toggled off via IPC

**File:** `tests/ui-redesign/sidebar.spec.ts`

**Steps:**
  1. Open the sidebar via the 'Files' button.
    - expect: Sidebar visible.
  2. Send IPC `ui:toggle-sidebar` with argument `false`.
  3. Assert `[data-testid="sidebar"]` is not visible.
    - expect: IPC toggling the sidebar visibility hides the sidebar correctly.

### 5. StatusBar

**Seed:** `tests/seed.spec.ts`

#### 5.1. StatusBar renders and is visible on startup

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Assert `[data-testid="statusbar"]` is visible.
    - expect: The StatusBar is rendered and visible on fresh launch.

#### 5.2. StatusBar has 32 px height

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Evaluate `document.querySelector('[data-testid="statusbar"]').getBoundingClientRect().height`.
    - expect: The computed height is 32, matching the `height: 32px` CSS rule.

#### 5.3. StatusBar background is dark (not blue)

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Evaluate `getComputedStyle(document.querySelector('[data-testid="statusbar"]')).backgroundColor`.
    - expect: The background resolves to the dark `--statusbar-bg` value (rgb(14, 14, 14) / #0e0e0e), not a blue colour. This confirms the redesign moved away from the Notepad++-style blue status bar.

#### 5.4. StatusBar status dot is visible and has teal accent colour

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Locate the status dot element inside `[data-testid="statusbar"]` — it is the first `.statusDot` span.
  2. Evaluate `getComputedStyle(dotElement).backgroundColor`.
    - expect: The dot's background colour is the teal accent (rgb(104, 229, 203) / #68e5cb), confirming the `background: var(--accent)` rule.
  3. Assert the dot is visible (not hidden or zero-sized).
    - expect: The status dot is a 6x6 px teal circle.

#### 5.5. StatusBar cursor position shows 'Ln 1, Col 1' on fresh buffer

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Assert `[data-testid="cursor-position"]` is visible and contains the text 'Ln 1, Col 1'.
    - expect: On a fresh untitled buffer with the cursor at the start, the cursor position reads 'Ln 1, Col 1'.

#### 5.6. StatusBar cursor position updates when typing in the editor

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Click `.monaco-editor textarea` to focus the editor.
  2. Type 'Hello\nWorld' (two lines).
  3. Assert `[data-testid="cursor-position"]` now shows 'Ln 2, Col 6'.
    - expect: The cursor position updates in real time via the 'editor:cursor' custom event. After typing 'Hello' then Enter then 'World', the cursor is on line 2, column 6.

#### 5.7. StatusBar EOL indicator shows 'LF' by default

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Locate the EOL text within `[data-testid="statusbar"]`.
  2. Assert its text content is 'LF'.
    - expect: The default EOL for new buffers is LF.

#### 5.8. StatusBar EOL cycles from LF to CRLF on click

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Locate the EOL span element within `[data-testid="statusbar"]` (the clickable section showing 'LF').
  2. Click the EOL span.
  3. Assert the text now reads 'CRLF'.
    - expect: Clicking the EOL indicator cycles it from LF to CRLF via the `cycleEOL` callback.

#### 5.9. StatusBar encoding shows 'UTF-8' by default

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Assert the text 'UTF-8' is visible inside `[data-testid="statusbar"]`.
    - expect: New buffers default to UTF-8 encoding.

#### 5.10. StatusBar encoding cycles on click

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Locate the encoding span inside `[data-testid="statusbar"]` (text 'UTF-8').
  2. Click the encoding span.
  3. Assert the text changes to 'UTF-8 BOM'.
    - expect: The first click cycles UTF-8 → UTF-8 BOM.
  4. Click again.
  5. Assert the text changes to 'UTF-16 LE'.
    - expect: Second click cycles to UTF-16 LE.

#### 5.11. StatusBar language shows 'Plain Text' for a new untitled buffer

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Assert the text 'Plain Text' is visible inside `[data-testid="statusbar"]`.
    - expect: New untitled buffers have no language assigned, falling back to 'Plain Text'.

#### 5.12. StatusBar dirty state shows 'New File' for an unsaved untitled buffer

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Assert the text 'New File' is visible inside `[data-testid="statusbar"]`.
    - expect: An untitled buffer with no file path and no changes shows 'New File'.

#### 5.13. StatusBar dirty state shows 'Modified' after typing in the editor

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Click `.monaco-editor textarea` and type 'x'.
  2. Assert the text 'Modified' is visible inside `[data-testid="statusbar"]`.
    - expect: Once the buffer has unsaved changes, `isDirty` becomes true and the StatusBar shows 'Modified'.

#### 5.14. StatusBar is hidden when toggled off via IPC

**File:** `tests/ui-redesign/statusbar.spec.ts`

**Steps:**
  1. Assert `[data-testid="statusbar"]` is visible.
  2. Send IPC `ui:toggle-statusbar` with argument `false`.
  3. Assert `[data-testid="statusbar"]` is no longer visible.
    - expect: Setting `showStatusBar = false` in UIStore removes the StatusBar from the layout.
  4. Send IPC `ui:toggle-statusbar` with argument `true` to restore.
    - expect: StatusBar reappears.

### 6. MD3 Teal CSS Variable Palette

**Seed:** `tests/seed.spec.ts`

#### 6.1. Root CSS variable --bg resolves to #131313 in dark theme

**File:** `tests/ui-redesign/css-palette.spec.ts`

**Steps:**
  1. Evaluate `getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()` in the renderer.
    - expect: The value is '#131313' (or its RGB equivalent rgb(19, 19, 19)), confirming the MD3 dark background token is applied.

#### 6.2. Root CSS variable --accent resolves to #68e5cb in dark theme

**File:** `tests/ui-redesign/css-palette.spec.ts`

**Steps:**
  1. Evaluate `getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()` in the renderer.
    - expect: The value is '#68e5cb' (or rgb(104, 229, 203)), confirming the MD3 teal primary accent token.

#### 6.3. App root background uses --bg token (#131313)

**File:** `tests/ui-redesign/css-palette.spec.ts`

**Steps:**
  1. Evaluate `getComputedStyle(document.querySelector('[data-testid="app"]')).backgroundColor`.
    - expect: The computed background is rgb(19, 19, 19) matching #131313, not a blue, not white, confirming the dark theme palette.

#### 6.4. Light theme switches --bg and --accent tokens via data-theme attribute

**File:** `tests/ui-redesign/css-palette.spec.ts`

**Steps:**
  1. Send IPC `ui:toggle-theme` to switch to light theme.
  2. Evaluate `getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()`.
    - expect: The value is '#f5f5f0', the light theme background token.
  3. Evaluate `getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()`.
    - expect: The value is '#006b5b', the light theme teal accent.
  4. Send IPC `ui:toggle-theme` again to restore dark theme.
    - expect: The tokens revert to #131313 and #68e5cb.

#### 6.5. SideNav background uses --sidenav-bg token (darker than app bg)

**File:** `tests/ui-redesign/css-palette.spec.ts`

**Steps:**
  1. Evaluate `getComputedStyle(document.querySelector('[data-testid="sidenav"]')).backgroundColor`.
    - expect: The background resolves to rgb(14, 14, 14) / #0e0e0e (--sidenav-bg), which is darker than the app's #131313 background, creating visual depth.

#### 6.6. StatusBar background uses --statusbar-bg token, matching SideNav bg (dark, not blue)

**File:** `tests/ui-redesign/css-palette.spec.ts`

**Steps:**
  1. Evaluate `getComputedStyle(document.querySelector('[data-testid="statusbar"]')).backgroundColor`.
    - expect: The background is rgb(14, 14, 14) / #0e0e0e — same dark shade as the SideNav, not blue. This confirms the redesign broke away from the Notepad++-style blue status bar.

#### 6.7. Input focus border uses --accent (teal) token

**File:** `tests/ui-redesign/css-palette.spec.ts`

**Steps:**
  1. Click the quick search input in `[data-testid="topbar"]` to focus it.
  2. Evaluate `getComputedStyle(document.querySelector('[data-testid="topbar"] input').parentElement).borderColor`.
    - expect: The border colour of the focused search wrapper resolves to the teal accent rgb(104, 229, 203), confirming `--input-focus-border` is wired to `var(--accent)`.

#### 6.8. SideNav logo icon uses teal gradient background

**File:** `tests/ui-redesign/css-palette.spec.ts`

**Steps:**
  1. Evaluate the background style of the logo icon div inside `[data-testid="sidenav"]` (the child of `.logo` containing the Feather SVG).
  2. Assert the computed `backgroundImage` property contains a gradient with the teal accent values.
    - expect: The logo icon uses `linear-gradient(135deg, var(--accent) 0%, var(--accent-container) 100%)`, giving a teal gradient background as part of the MD3 teal brand identity.
