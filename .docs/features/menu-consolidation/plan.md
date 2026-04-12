# Implementation Plan: Menu Consolidation

**Feature:** menu-consolidation
**Date:** 2026-04-12
**Prerequisites:** PRD, Spec, and Tests must be finalized before implementation begins.

> References:
> - [PRD](./prd.md) — features, user stories, business rules
> - [Spec](./spec.md) — data shapes, IPC channels, component contracts
> - [Tests](./tests.md) — 48 E2E test cases

---

## Phase Overview

| # | Phase | Description | Depends On | Deliverable | Verification |
|---|-------|-------------|------------|-------------|--------------|
| 1 | Foundation | IPC plumbing, uiStore expansion, native menu IDs, window config | — | All data shapes + IPC channels in place | Typecheck |
| 2 | Bidirectional State Sync | Wire renderer↔main toggle sync with loop guard | Phase 1 | Toggle state stays consistent across all UI surfaces | E2E tests 19-22, 43, 44 |
| 3 | Platform-Conditional Rendering + QuickStrip | Hide MenuBar on macOS, create QuickStrip component | Phase 1 | macOS: QuickStrip only. Win/Linux: MenuBar only. | E2E tests 1-5, 7, 8, 42 |
| 4 | Feature-Parity MenuBar | Expand custom MenuBar to 11 menus with submenus + disabled items | Phase 1 | Full menu structure matching native menu | E2E tests 6, 9-18, 29-40, 46 |
| 5 | Editor Context Menu | Right-click context menu in Monaco editor | Phase 1 | Radix UI context menu with clipboard + editor actions | E2E tests 23-28, 45 |

> Phases 2, 3, 4, and 5 depend only on Phase 1 and are **independent of each other** — they can be executed in parallel.

---

## Phase 1: Foundation

**Goal:** Establish all data shapes, IPC channels, store fields, and native menu infrastructure without changing any visible UI behavior.

**Input:** Finalized spec (sections 2-4): UIToggleKey, UIToggleUpdate, native menu ID mapping, preload allowlist, uiStore expansion, window config.
**Output:** All plumbing in place. App compiles and runs identically to before — no behavioral changes yet.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 1.1 | Add `ui:state-changed` to preload send allowlist | `src/preload/index.ts` | Add `'ui:state-changed'` to the `allowedChannels` array in `api.send`. Per spec §3.3. | Typecheck |
| 1.2 | Add stable IDs to native menu checkbox items | `src/main/menu.ts` | Add `id` property to Toggle Toolbar, Toggle Status Bar, Toggle Sidebar, Word Wrap, Show Whitespace, Show Indentation Guides, Split View menu items. Per spec §2.2 mapping table. | Typecheck |
| 1.3 | Add `enabled: false` for stubbed items in native menu | `src/main/menu.ts` | Set `enabled: false` on: Bookmark items (Toggle/Next/Previous/Clear All), Split View, Shortcut Mapper, UDL Editor, Style Configurator, Macro Start/Stop/Playback, Saved Macros, Plugin Manager. Per spec §6. | Typecheck |
| 1.4 | Set `autoHideMenuBar` conditionally | `src/main/index.ts` | Change `autoHideMenuBar: false` to `autoHideMenuBar: process.platform !== 'darwin'`. Per spec §4.1. | Typecheck |
| 1.5 | Add toggle fields to uiStore | `src/renderer/src/store/uiStore.ts` | Add `wordWrap`, `renderWhitespace`, `indentationGuides`, `columnSelectMode`, `splitView` state fields with defaults. Add corresponding setters with `fromMain?: boolean` parameter. Per spec §2.5. | Typecheck |
| 1.6 | Add `fromMain` parameter to existing setters | `src/renderer/src/store/uiStore.ts` | Modify `setShowToolbar`, `setShowStatusBar`, `setShowSidebar` signatures to accept optional `fromMain?: boolean`. No behavioral change yet — parameter is accepted but not used until Phase 2. | Typecheck |
| 1.7 | Add `syncToggleToMain` action | `src/renderer/src/store/uiStore.ts` | Add `syncToggleToMain(key, value)` that calls `window.api.send('ui:state-changed', { key, value })`. Per spec §2.5. Guard: only call when `fromMain` is falsy. | Typecheck |
| 1.8 | Register `ui:state-changed` IPC listener in main | `src/main/index.ts` | Add `ipcMain.on('ui:state-changed', ...)` handler that looks up native menu item by ID (using spec §2.2 mapping) and sets `.checked`. Per spec §7.1. | Typecheck |

### Phase Exit Criteria

- [ ] `npm run build` compiles with no errors
- [ ] App launches and behaves identically to before (no visual changes)
- [ ] New uiStore fields exist with correct defaults
- [ ] Native menu items have stable IDs (verifiable via `electronApp.evaluate`)
- [ ] Stubbed native menu items are disabled

---

## Phase 2: Bidirectional State Sync

**Goal:** Wire all toggle state changes to flow bidirectionally between renderer and main process, with loop prevention.

**Input:** Phase 1 output (IPC channel, uiStore `syncToggleToMain`, `fromMain` parameter, native menu IDs).
**Output:** Any toggle change — regardless of origin (native menu, custom MenuBar, Toolbar, QuickStrip) — updates both renderer state and native menu checkbox. No infinite loops.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 2.1 | Wire `fromMain: true` on IPC toggle handlers | `src/renderer/src/App.tsx` | Update the `ui:toggle-toolbar`, `ui:toggle-statusbar`, `ui:toggle-sidebar` IPC listeners (lines 98-100) to pass `fromMain: true` to setters. Also handle `editor:set-option` toggles (wordWrap, renderWhitespace, indentGuides) to update uiStore with `fromMain: true`. | Typecheck |
| 2.2 | Wire `syncToggleToMain` on renderer-initiated toggles | `src/renderer/src/store/uiStore.ts` | In each setter, when `fromMain` is falsy, call `syncToggleToMain(key, value)` after `set()`. Applies to: `setShowToolbar`, `setShowStatusBar`, `setShowSidebar`, `setWordWrap`, `setRenderWhitespace`, `setIndentationGuides`, `setColumnSelectMode`, `setSplitView`. | Typecheck |
| 2.3 | Verify main process updates native checkbox | `src/main/index.ts` | The listener from 1.8 already exists. Verify it maps `UIToggleKey` → native menu `id` correctly and sets `checked`. Add a key→id lookup map. | E2E test |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 2.2 | Test 19 | Toggle sidebar from renderer updates native menu |
| 2.1 | Test 20 | Toggle toolbar from native menu updates renderer |
| 2.2 | Test 21 | No infinite loop under rapid toggles |
| 2.2 | Test 22 | Word wrap bidirectional sync |
| 2.1+2.2 | Test 43 | Multiple toggles in sequence from mixed sources |
| 1.3 | Test 44 | Disabled items in native menu |

### Phase Exit Criteria

- [ ] `npm run build` compiles
- [ ] Toggle sidebar via renderer → native menu checkbox updates (Test 19)
- [ ] Toggle toolbar via native menu → renderer UI updates (Test 20)
- [ ] 10 rapid toggles → no crash, final state consistent (Test 21)
- [ ] Word wrap toggle → both Monaco and native menu reflect change (Test 22)
- [ ] Mixed-source sequential toggles → all states match (Test 43)
- [ ] Stubbed native items are disabled (Test 44)

---

## Phase 3: Platform-Conditional Rendering + QuickStrip

**Goal:** On macOS, hide the custom MenuBar and show a QuickStrip. On Windows/Linux, keep the MenuBar and embed quick icons in its right side (existing behavior).

**Input:** Phase 1 output (uiStore fields, `syncToggleToMain`).
**Output:** macOS shows QuickStrip (no MenuBar). Windows/Linux shows MenuBar (no separate QuickStrip).

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 3.1 | Add platform guard to MenuBar | `src/renderer/src/components/editor/MenuBar.tsx` | At the top of the component, add: `if (window.api.platform === 'darwin') return null`. Per spec §5.2. | Typecheck |
| 3.2 | Create QuickStrip component | `src/renderer/src/components/editor/QuickStrip.tsx` | **New file.** Implements spec §5.1: 28px height, traffic light spacer (78px on macOS), app icon + "NovaPad" label, quick icons (Find, Sidebar, Theme) on right. Drag region + no-drag on buttons. `data-testid="quickstrip"` and per-button testids. | Typecheck |
| 3.3 | Wire QuickStrip into App.tsx | `src/renderer/src/App.tsx` | Import QuickStrip. On macOS: render QuickStrip as a separate row above Toolbar. On Win/Linux: do not render QuickStrip (quick icons remain in MenuBar right side). Pass `onFind`, `onToggleSidebar`, `onToggleTheme` props. | Typecheck |
| 3.4 | Ensure quick icons in MenuBar remain for Win/Linux | `src/renderer/src/components/editor/MenuBar.tsx` | Verify existing right-side quick icons (Find, Sidebar, Theme) are still rendered when MenuBar is visible (Win/Linux). No change needed if platform guard returns null for macOS — Win/Linux path is unchanged. | Visual check |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 3.1 | Test 1 | macOS hides custom MenuBar |
| 3.2 | Test 2 | macOS shows QuickStrip |
| 3.2 | Test 3 | QuickStrip Find button opens Find panel |
| 3.2 | Test 4 | QuickStrip Sidebar toggle works |
| 3.2 | Test 5 | QuickStrip Theme toggle works |
| 3.4 | Test 7 | Win/Linux does not render separate QuickStrip row |
| 3.1 | Test 8 | Win/Linux native menu is auto-hidden |
| 3.2 | Test 42 | macOS traffic lights not blocked by QuickStrip |

### Phase Exit Criteria

- [ ] `npm run build` compiles
- [ ] On macOS: MenuBar not in DOM, QuickStrip visible with all 3 buttons (Tests 1-2)
- [ ] QuickStrip buttons trigger correct actions (Tests 3-5)
- [ ] On Win/Linux: MenuBar visible, no separate QuickStrip row (Test 7)
- [ ] `autoHideMenuBar` is `true` on Win/Linux (Test 8)
- [ ] Traffic light spacer present on macOS (Test 42)

---

## Phase 4: Feature-Parity MenuBar

**Goal:** Expand the custom MenuBar from 4 menus (~20 items) to 11 menus (~60 items) with submenu support and disabled items, matching the native Electron menu.

**Input:** Phase 1 output (uiStore fields, `syncToggleToMain` for toggle items).
**Output:** Windows/Linux custom MenuBar has full feature parity with the native menu. Disabled items are grayed out.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 4.1 | Extend MenuItem interface | `src/renderer/src/components/editor/MenuBar.tsx` | Add `disabled?: boolean`, `checked?: boolean`, `submenu?: MenuItem[]` to the existing `MenuItem` interface. Per spec §2.3. | Typecheck |
| 4.2 | Add submenu rendering | `src/renderer/src/components/editor/MenuBar.tsx` | When a MenuItem has `submenu`, render a nested dropdown on hover (positioned to the right of the parent item). Use a chevron icon to indicate submenu presence. | Visual check |
| 4.3 | Add disabled item styling | `src/renderer/src/components/editor/MenuBar.tsx` | When `disabled: true`, render item with `opacity-40 pointer-events-none` classes. Per spec §6. | Visual check |
| 4.4 | Add `onOpenFolder` prop and wire in App.tsx | `src/renderer/src/App.tsx`, `MenuBar.tsx` | Add `onOpenFolder` to MenuBarProps. In App.tsx, pass the open-folder-dialog callback. Per spec §5.2. | Typecheck |
| 4.5 | Upgrade File menu | `src/renderer/src/components/editor/MenuBar.tsx` | Add: Open Folder... (Ctrl+Shift+O), Recent Files submenu (reads from store/IPC). Per spec §5.2 table. | Visual check |
| 4.6 | Upgrade Edit menu | `src/renderer/src/components/editor/MenuBar.tsx` | Add: Line Operations submenu (6 items), Convert Case submenu (3 items), Toggle Comment, Toggle Block Comment, Trim Trailing Whitespace, Indent/Outdent Selection. All dispatch `editor:command` events. Per spec §5.2 table. | Visual check |
| 4.7 | Upgrade Search menu | `src/renderer/src/components/editor/MenuBar.tsx` | Add: Go to Line... (Ctrl+G), Bookmark group (Toggle/Next/Previous/Clear All — all `disabled: true`). Per spec §6 disabled table. | Visual check |
| 4.8 | Upgrade View menu | `src/renderer/src/components/editor/MenuBar.tsx` | Add: Word Wrap (Alt+Z), Show Whitespace, Show Indentation Guides, Column Select Mode, Zoom In/Out/Reset, Split View (`disabled: true`). Toggle items use `syncToggleToMain`. Per spec §5.2 table. | Visual check |
| 4.9 | Add Encoding menu | `src/renderer/src/components/editor/MenuBar.tsx` | New top-level menu: UTF-8, UTF-8 BOM, UTF-16 LE/BE, Windows-1252, ISO-8859-1. EOL Format submenu (CRLF, LF, CR). Actions send `editor:set-encoding` / `editor:set-eol` events. | Visual check |
| 4.10 | Add Language menu | `src/renderer/src/components/editor/MenuBar.tsx` | New top-level menu: Auto Detect, Plain Text, separator, 20+ languages. Actions send `editor:set-language` event. | Visual check |
| 4.11 | Add Settings menu | `src/renderer/src/components/editor/MenuBar.tsx` | New top-level menu: Preferences (opens dialog), Shortcut Mapper (`disabled`), UDL Editor (`disabled`), Style Configurator (`disabled`), Toggle Dark Mode. | Visual check |
| 4.12 | Add Macro menu | `src/renderer/src/components/editor/MenuBar.tsx` | New top-level menu: Start Recording, Stop Recording, Playback, Saved Macros. All `disabled: true`. Per spec §6. | Visual check |
| 4.13 | Add Plugins menu | `src/renderer/src/components/editor/MenuBar.tsx` | New top-level menu: Plugin Manager (`disabled`). Per spec §6. | Visual check |
| 4.14 | Add Window menu | `src/renderer/src/components/editor/MenuBar.tsx` | New top-level menu: Minimize, Zoom (via `electronApp` if possible, or no-op), Next Tab, Previous Tab. Tab actions dispatch `tab:next`/`tab:prev` events. | Visual check |
| 4.15 | Add Help menu | `src/renderer/src/components/editor/MenuBar.tsx` | New top-level menu: About NovaPad (opens dialog), Open DevTools (sends IPC or `window.api` call). | Visual check |
| 4.16 | Update `topMenus` array | `src/renderer/src/components/editor/MenuBar.tsx` | Change from `['File', 'Edit', 'Search', 'View']` to `['File', 'Edit', 'Search', 'View', 'Encoding', 'Language', 'Settings', 'Macro', 'Plugins', 'Window', 'Help']`. | Typecheck |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 4.16 | Test 6 | Win/Linux shows all 11 menu labels |
| 4.5 | Test 9 | File menu — all items present |
| 4.6 | Test 10 | Edit menu — submenus for Line Ops and Convert Case |
| 4.7 | Test 11 | Search menu — Go to Line + Bookmarks disabled |
| 4.8 | Test 12 | View menu — all toggles and zoom |
| 4.9 | Test 13 | Encoding menu — all encodings + EOL submenu |
| 4.10 | Test 14 | Language menu — 20+ languages |
| 4.11 | Test 15 | Settings menu — Preferences enabled, others disabled |
| 4.12 | Test 16 | Macro menu — all items disabled |
| 4.13 | Test 17 | Plugins menu — Plugin Manager disabled |
| 4.16 | Test 18 | Keyboard shortcuts display Ctrl (not Cmd) |
| 4.3 | Test 29 | Disabled items cannot be clicked |
| 4.3 | Test 30 | Disabled items correct visual styling |
| 4.5 | Test 31 | File > New File action works |
| 4.8 | Test 32 | View > Toggle Toolbar hides/shows toolbar |
| 4.9 | Test 33 | Encoding > UTF-16 LE updates status bar |
| 4.10 | Test 34 | Language > Python updates status bar |
| 4.14 | Test 35 | Window > Next/Previous Tab |
| 4.15 | Test 36 | Help > About NovaPad opens dialog |
| 4.11 | Test 37 | Settings > Toggle Dark Mode |
| all | Test 38 | Menu dropdown closes after item click |
| all | Test 39 | Menu hover-to-switch between menus |
| all | Test 40 | Menu click outside closes dropdown |
| all | Test 46 | Empty state — menus work with no file open |

### Phase Exit Criteria

- [ ] `npm run build` compiles
- [ ] All 11 menu labels visible on Win/Linux (Test 6)
- [ ] Each menu opens with correct items and shortcuts (Tests 9-18)
- [ ] Submenu rendering works for Line Operations, Convert Case, EOL Format (Tests 10, 13)
- [ ] Disabled items have correct styling and are non-clickable (Tests 29-30)
- [ ] Menu actions trigger correct behavior (Tests 31-37)
- [ ] Menu UX: close-on-click, hover-switch, click-outside (Tests 38-40)
- [ ] Menus work in empty state (Test 46)

---

## Phase 5: Editor Context Menu

**Goal:** Add a styled right-click context menu to the Monaco editor with clipboard actions and editor commands. Suppress Monaco's built-in context menu.

**Input:** Phase 1 output (uiStore, editor command dispatch pattern).
**Output:** Right-click in editor shows Radix UI context menu. Monaco built-in menu is suppressed.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 5.1 | Suppress Monaco built-in context menu | `src/renderer/src/components/EditorPane/EditorPane.tsx` | Add `contextmenu: false` to Monaco editor options. Per spec §5.3. | Visual check |
| 5.2 | Create EditorContextMenu component | `src/renderer/src/components/EditorPane/EditorContextMenu.tsx` | **New file.** Radix UI `<ContextMenu>` with items: Cut, Copy, Paste, Select All, separator, Go to Line, Toggle Comment, Convert Case submenu (UPPERCASE, lowercase, Title Case). Per spec §5.3 menu structure. | Typecheck |
| 5.3 | Wire context menu actions | `src/renderer/src/components/EditorPane/EditorContextMenu.tsx` | Cut/Copy/Paste via `document.execCommand` or clipboard API. Select All via `editor.getAction('editor.action.selectAll')`. Go to Line, Toggle Comment, Convert Case via `window.dispatchEvent(new CustomEvent('editor:command', ...))` or direct Monaco actions. | Visual check |
| 5.4 | Wrap editor container with ContextMenu trigger | `src/renderer/src/components/EditorPane/EditorPane.tsx` | Wrap the editor container div with `<ContextMenu><ContextMenuTrigger asChild>...</ContextMenuTrigger><ContextMenuContent>...</ContextMenuContent></ContextMenu>`. | E2E test |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 5.4 | Test 23 | Context menu appears on right-click |
| 5.3 | Test 24 | Cut/Copy/Paste work |
| 5.3 | Test 25 | Toggle Comment works |
| 5.3 | Test 26 | Convert Case submenu works |
| 5.1 | Test 27 | Monaco built-in menu suppressed |
| 5.4 | Test 28 | Context menu closes on click outside |
| 5.3 | Test 45 | Go to Line works |

### Phase Exit Criteria

- [ ] `npm run build` compiles
- [ ] Right-click in editor shows custom context menu (Test 23)
- [ ] Monaco's built-in context menu does not appear (Test 27)
- [ ] Clipboard actions work (Test 24)
- [ ] Toggle Comment works from context menu (Test 25)
- [ ] Convert Case submenu works (Test 26)
- [ ] Go to Line works from context menu (Test 45)
- [ ] Context menu closes on click outside (Test 28)

---

## Verification Strategy

### Automated Checks (per task)

| Method | When to Use | How |
|--------|-------------|-----|
| **Typecheck** | All code tasks | `npm run build` (electron-vite compiles all 3 bundles) |
| **E2E Test** | User-facing flows | `npm run test:e2e` (Playwright against built app) |
| **Visual check** | UI rendering, styling, layout | `npm run dev` + manual inspection in app |
| **Sub-agent review** | Complex sync logic (Phase 2) | Spawn Opus sub-agent to review against spec §3.4 and §7 |

### Sub-agent Review Protocol

For Phase 2 (bidirectional sync), spawn a review agent with:

> "Review the implementation of bidirectional state sync against spec §3.4 (loop prevention) and §7 (sequence diagrams). Verify:
> 1. `fromMain` parameter is passed correctly in all IPC handlers
> 2. `syncToggleToMain` is only called when `fromMain` is falsy
> 3. Main process listener maps UIToggleKey → native menu ID correctly
> 4. No code path can trigger an infinite main→renderer→main loop
> Report any discrepancies."

---

## Execution Notes

- **Parallel phases**: Phases 2, 3, 4, and 5 are independent — execute concurrently for fastest delivery.
- **Phase handoff**: Phase 1 must complete before any other phase starts. After Phase 1, confirm `npm run build` passes.
- **Build order**: Always `npm run build` after changes before running E2E tests (tests use compiled `out/main/index.js`).
- **Platform testing**: macOS-specific tests (1-5, 42) only run on macOS. Win/Linux tests (6-18, 29-40) skip on macOS. Use `test.skip(process.platform === 'darwin')` guards.
- **Test linking**: After completing a phase, run its linked E2E tests immediately. Do not proceed to the next phase if tests fail.
- **Largest phase**: Phase 4 has 16 tasks but they are all menu data additions in a single file — low risk, high volume. Consider splitting into 2-3 commits: (a) infrastructure (4.1-4.4), (b) upgraded existing menus (4.5-4.8), (c) new menus (4.9-4.16).
