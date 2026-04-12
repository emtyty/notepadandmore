# Menu Consolidation - Overview

## 1. Description

NovaPad currently renders two overlapping menu systems on macOS: an Electron native menu (top of screen) and a custom in-window MenuBar component. This causes duplicate actions, inconsistent toggle state, keyboard shortcut conflicts, and violates macOS Human Interface Guidelines. This feature consolidates menus into a single authoritative source per platform — native menu on macOS, custom MenuBar on Windows/Linux — with full feature parity, bidirectional state sync, and an editor right-click context menu.

> See [Brainstorm Notes](./raw/notes.md) for decision rationale and architecture sketch.

---

## 2. Features

| ID | Feature | Priority | Stories | Description |
|----|---------|----------|---------|-------------|
| F1 | Platform-conditional MenuBar | Must Have | US-001, US-002 | Hide custom MenuBar on macOS; show on Windows/Linux. Auto-hide native menu on Windows/Linux (Alt to reveal). |
| F2 | QuickStrip | Must Have | US-003, US-004 | Always-visible strip with app icon and quick action icons (Find, Sidebar, Theme). Separate row on macOS, merged into MenuBar right side on Windows/Linux. |
| F3 | Feature-parity MenuBar | Must Have | US-005, US-006 | Upgrade custom MenuBar from 4 menus (~20 items) to 10 menus (~60 items), matching all native menu entries. |
| F4 | Bidirectional state sync | Must Have | US-007, US-008 | Sync toggle state (toolbar, statusbar, sidebar, word wrap, whitespace, etc.) between renderer Zustand store and main process native menu checkboxes in both directions. |
| F5 | Editor context menu | Should Have | US-009 | Right-click in Monaco editor shows context menu with clipboard actions and editor commands. |
| F6 | Disabled stubbed items | Should Have | US-010 | Unimplemented features (Macro, Bookmarks, Split View, etc.) appear in menus as disabled/grayed entries. |

---

## 3. User Stories

### Actors

| Actor | Description |
|-------|-------------|
| macOS User | Uses NovaPad on macOS, expects native menu bar at top of screen |
| Windows/Linux User | Uses NovaPad on Windows or Linux, expects in-window menu bar |

### Stories

#### US-001: macOS user sees only native menu
> **As a** macOS User, **I want** the in-window MenuBar to be hidden, **so that** I don't see duplicate menus and the app feels native.

**Acceptance Criteria:**
- [ ] Custom MenuBar component does not render on macOS (`window.api.platform === 'darwin'`)
- [ ] Native Electron menu remains fully functional at top of screen
- [ ] macOS traffic light buttons (close/minimize/maximize) are not blocked
- [ ] Window drag region still works via QuickStrip

#### US-002: Windows/Linux user uses custom MenuBar
> **As a** Windows/Linux User, **I want** a full-featured in-window menu bar, **so that** I can access all app functions without relying on the hard-to-discover native menu.

**Acceptance Criteria:**
- [ ] Custom MenuBar renders with all 10 top-level menus on Windows/Linux
- [ ] Native Electron menu is auto-hidden (`win.setAutoHideMenuBar(true)`)
- [ ] Pressing Alt key reveals the native menu as a fallback
- [ ] No keyboard shortcut fires twice (once from native accelerator, once from custom handler)

#### US-003: QuickStrip on macOS
> **As a** macOS User, **I want** quick access to Find, Sidebar toggle, and Theme toggle without opening menus, **so that** common actions are always one click away.

**Acceptance Criteria:**
- [ ] QuickStrip renders as a separate row (~24-28px) below the title bar area on macOS
- [ ] Contains app icon/name on the left, quick action icons on the right
- [ ] Quick icons: Find (opens find panel), Sidebar toggle, Theme toggle
- [ ] Entire strip acts as a window drag region (except icon buttons)
- [ ] Traffic light spacer (78px) is present on the left

#### US-004: QuickStrip on Windows/Linux
> **As a** Windows/Linux User, **I want** the same quick action icons available, **so that** I have consistent access to common actions.

**Acceptance Criteria:**
- [ ] Quick icons render on the right side of the MenuBar row (same row, no extra vertical space)
- [ ] Icons match macOS QuickStrip: Find, Sidebar toggle, Theme toggle
- [ ] No separate QuickStrip row is rendered on Windows/Linux

#### US-005: Full menus on custom MenuBar
> **As a** Windows/Linux User, **I want** the custom MenuBar to include all menus (File, Edit, Search, View, Encoding, Language, Settings, Macro, Plugins, Window, Help), **so that** I have access to every feature without needing the native menu.

**Acceptance Criteria:**
- [ ] File menu: New, Open, Open Folder, Save, Save As, Save All, Reload, Close, Close All, Recent Files
- [ ] Edit menu: Undo, Redo, Cut, Copy, Paste, Select All, Line Operations submenu, Convert Case submenu, Toggle Comment, Toggle Block Comment, Trim Whitespace, Indent/Outdent
- [ ] Search menu: Find, Replace, Find in Files, Go to Line, Bookmark operations (Toggle, Next, Previous, Clear All)
- [ ] View menu: Toggle Toolbar/StatusBar/Sidebar, Word Wrap, Show Whitespace, Indentation Guides, Column Select, Zoom In/Out/Reset, Split View
- [ ] Encoding menu: UTF-8, UTF-8 BOM, UTF-16 LE/BE, Windows-1252, ISO-8859-1, EOL submenu (CRLF/LF/CR)
- [ ] Language menu: Auto Detect, Plain Text, 20+ programming languages
- [ ] Settings menu: Preferences, Shortcut Mapper, UDL Editor, Style Configurator, Dark Mode toggle
- [ ] Macro menu: Start/Stop Recording, Playback, Saved Macros
- [ ] Plugins menu: Plugin Manager
- [ ] Window menu: Minimize, Zoom, Next/Previous Tab
- [ ] Help menu: About NovaPad, Open DevTools

#### US-006: Menu keyboard shortcuts display correctly
> **As a** Windows/Linux User, **I want** each menu item to show its keyboard shortcut, **so that** I can learn and use shortcuts.

**Acceptance Criteria:**
- [ ] Shortcuts display platform-appropriate modifier (Ctrl on Windows/Linux)
- [ ] Shortcuts match the native menu accelerators exactly
- [ ] No shortcut conflicts between menu items

#### US-007: Toggle state syncs from renderer to main
> **As a** macOS User, **I want** the native menu checkboxes to update when I toggle settings via other UI (e.g., Toolbar button, keyboard shortcut), **so that** the menu always reflects the current state.

**Acceptance Criteria:**
- [ ] When renderer toggles Toolbar/StatusBar/Sidebar/Word Wrap/Whitespace/Indentation Guides/Column Select/Split View, an IPC message is sent to main process
- [ ] Main process updates the corresponding native menu checkbox state
- [ ] State is consistent after any number of toggles from any source

#### US-008: Toggle state syncs from main to renderer
> **As a** User on any platform, **I want** the UI to update when I toggle settings via the native menu, **so that** the app responds immediately.

**Acceptance Criteria:**
- [ ] Native menu checkbox click sends IPC to renderer
- [ ] Renderer Zustand store updates immediately
- [ ] UI re-renders to reflect the new state (e.g., toolbar appears/disappears)
- [ ] No infinite loop between main→renderer→main sync

#### US-009: Editor right-click context menu
> **As a** User, **I want** to right-click in the editor to see a context menu with common actions, **so that** I can quickly access clipboard and editing operations.

**Acceptance Criteria:**
- [ ] Right-click in Monaco editor area shows a styled context menu (Radix UI, matching app theme)
- [ ] Menu items: Cut, Copy, Paste, Select All (separator), Go to Line, Toggle Comment, Convert Case submenu (UPPERCASE, lowercase, Title Case)
- [ ] Menu items trigger the correct editor actions
- [ ] Context menu closes on click outside or after selecting an item
- [ ] Monaco's built-in context menu is suppressed

#### US-010: Stubbed features shown as disabled
> **As a** User, **I want** to see all planned features in the menus even if they're not yet implemented, **so that** I know what's coming and the menu structure is complete.

**Acceptance Criteria:**
- [ ] These items appear disabled (grayed out, non-clickable): Macro Start/Stop/Playback, Saved Macros, Bookmarks (Toggle/Next/Previous/Clear), Split View, Plugin Manager, UDL Editor, Style Configurator, Shortcut Mapper
- [ ] Disabled items use standard disabled styling (reduced opacity, no hover effect)
- [ ] Disabled state applies in both native menu and custom MenuBar

---

## 4. Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-001 | Platform determines menu authority | macOS: native menu is authoritative, custom MenuBar hidden. Windows/Linux: custom MenuBar is authoritative, native menu auto-hidden. |
| BR-002 | Single shortcut registration | Each keyboard shortcut registers via one mechanism only — native accelerator on macOS, custom event handler on Windows/Linux — to prevent double-firing. |
| BR-003 | Toggle state consistency | Toggle state (toolbar, statusbar, sidebar, word wrap, etc.) must be identical between native menu checkboxes and renderer Zustand store at all times, regardless of which UI triggered the change. |
| BR-004 | No sync loops | Bidirectional sync must include a guard to prevent infinite main→renderer→main→... update loops. |
| BR-005 | Drag region preservation | QuickStrip and MenuBar must maintain `WebkitAppRegion: 'drag'` on the background area and `'no-drag'` on interactive elements, preserving frameless window drag behavior. |
| BR-006 | Disabled items are visible | Stubbed features must be visible (not hidden) in menus, rendered in disabled state. |

---

## 5. Dependencies

### Upstream (Required by this feature)

| Dependency | Purpose |
|------------|---------|
| Electron `Menu` API | Native menu construction, checkbox state, `setAutoHideMenuBar()` |
| shadcn/ui menubar, dropdown-menu, context-menu | Styled custom menu components (already installed) |
| Radix UI ContextMenu primitives | Editor right-click menu (pattern established in FileBrowser) |
| Preload IPC whitelist (`src/preload/index.ts`) | Must allow new sync channels |
| Zustand uiStore | Source of truth for UI toggle state in renderer |
| Monaco Editor API | Suppress built-in context menu, attach custom overlay |

### Downstream (Features that depend on this)

| Feature | Impact |
|---------|--------|
| Future Macro implementation | Menu entry already present (disabled), just needs enabling |
| Future Bookmarks implementation | Menu entry already present (disabled), just needs enabling |
| Future Split View implementation | Menu entry already present (disabled), just needs enabling |
| Future Plugin/Settings dialogs | Menu entries wired, just need dialog components |

---

## 6. Out of Scope

- Implementing stubbed features (Macro recording, Bookmarks, Split View) — only menu entries
- Custom keyboard shortcut remapping / Shortcut Mapper functionality
- Toolbar customization (drag-to-reorder, hide/show individual buttons)
- StatusBar right-click context menu
- Toolbar right-click context menu
- Touch Bar support on macOS
- Menu item search / command palette

---

## 7. Assumptions

- `window.api.platform` is available at render time and correctly reflects the OS
- Electron `Menu.getApplicationMenu()` and `getMenuItemById()` work reliably for checkbox state updates
- Monaco editor's built-in context menu can be disabled without side effects
- Users on Windows/Linux will not primarily rely on the auto-hidden native menu

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Native menu | Electron's `Menu.setApplicationMenu()` — renders in macOS system menu bar or Windows/Linux window frame |
| Custom MenuBar | React component (`MenuBar.tsx`) rendered inside the app window with dropdown menus |
| QuickStrip | New always-visible strip containing app icon and quick action buttons (Find, Sidebar, Theme) |
| Bidirectional sync | State changes propagated in both directions: renderer→main and main→renderer |
| Stubbed feature | Feature with menu entry and store state but no functional UI implementation |
| Auto-hide menu | `win.setAutoHideMenuBar(true)` — native menu hidden by default, revealed with Alt key |
