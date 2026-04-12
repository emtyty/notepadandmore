# Menu Consolidation — Brainstorm Notes

## Problem

On macOS, the app shows two menus simultaneously:
1. **Electron native menu** (top of screen) — 10 top-level menus, ~60 items
2. **Custom MenuBar** (`src/renderer/src/components/editor/MenuBar.tsx`) — 4 menus, ~20 items

This causes duplicate actions, inconsistent coverage, keyboard shortcut conflicts, and violates macOS HIG.

## Decisions

### D1: Platform strategy — Option A
- **macOS**: Native menu only, custom MenuBar hidden
- **Windows/Linux**: Custom MenuBar is primary UI (native menu still exists as fallback)

### D2: Feature parity
- Custom MenuBar will be upgraded to match ALL native menu items
- Missing menus to add: Encoding, Language, Macro, Settings, Plugins, Window, Help
- Missing submenus to add: Line Operations, Convert Case, Comments, Whitespace/Indent, Bookmarks, Zoom, Split View, EOL Format

### D3: QuickStrip — Separate always-visible strip
- New `QuickStrip` component, always rendered on all platforms
- Contains: app icon/name + quick action icons (Find, Sidebar toggle, Theme toggle)
- On macOS: replaces the hidden MenuBar's title bar role (drag region, traffic light spacer)
- On Windows/Linux: sits between MenuBar and Toolbar (or merges into MenuBar right side)
- Height: ~24-28px, minimal footprint

### D4: State sync — Bidirectional
- Current: Main → Renderer only (one-way). Native menu checkboxes go stale when toggled from renderer
- Required: Renderer → Main IPC channel (`renderer:ui-state-changed`) to update native menu checkboxes
- Affected toggles: Toolbar, StatusBar, Sidebar, Word Wrap, Show Whitespace, Indentation Guides, Column Select, Split View

### D5: Context menu — Editor only
- Right-click in editor area shows context menu
- Items: Cut, Copy, Paste, Select All, separator, editor-specific actions (Go to Line, Toggle Comment, Convert Case submenu)
- Use Radix UI `<ContextMenu>` (already used in FileBrowser)
- StatusBar and Toolbar context menus are out of scope

### D6: Stubbed/unimplemented features — Show as disabled
- Menu items for unimplemented features (Macro, Bookmarks, Split View, Plugin Manager, UDL Editor, Style Configurator, Shortcut Mapper) will be visible but grayed out/disabled
- No tooltip or "coming soon" text needed — standard disabled state is sufficient

## Requirements

### Features
| # | Feature | Priority |
|---|---------|----------|
| F1 | Platform-conditional MenuBar: hidden on macOS, visible on Windows/Linux | P0 |
| F2 | QuickStrip component: always visible, app icon + quick icons, drag region on macOS | P0 |
| F3 | Feature-parity custom MenuBar: all native menu items mirrored | P0 |
| F4 | Bidirectional state sync: renderer ↔ main for all toggle states | P0 |
| F5 | Editor context menu: right-click in Monaco editor area | P1 |
| F6 | Disabled menu items for stubbed features | P1 |

### Business Rules
- macOS: native menu is authoritative; custom MenuBar must not render
- Windows/Linux: custom MenuBar is primary interaction surface
- Keyboard shortcuts register once only (native accelerator on macOS, custom handler on Win/Linux)
- Toggle state must be consistent between native menu checkboxes and renderer Zustand store at all times
- QuickStrip must preserve WebkitAppRegion drag behavior for frameless window

### Dependencies
- shadcn/ui `menubar`, `dropdown-menu`, `context-menu` components (already installed)
- Radix UI context menu primitives (already used in FileBrowser)
- New IPC channels needed in preload whitelist: `renderer:ui-state-changed`
- Monaco editor's `onContextMenu` or overlay approach for editor context menu

### Out of Scope
- Implementing stubbed features (Macro, Bookmarks, Split View, etc.) — only menu entries
- Custom keyboard shortcut remapping / Shortcut Mapper functionality
- Toolbar customization (drag-to-reorder, hide/show individual buttons)
- StatusBar context menu
- Toolbar context menu

## Architecture Sketch

```
macOS layout:
  [native menu at top of screen]
  ┌─────────────────────────────────────────┐
  │ 🚦  N+ NovaPad          🔍 📁 🌙      │ ← QuickStrip (always visible)
  │ [Toolbar icons...]                      │ ← Toolbar (optional)
  │ [Tabs]                                  │
  │ [Editor]                                │
  │ [StatusBar]                             │
  └─────────────────────────────────────────┘

Windows/Linux layout:
  ┌─────────────────────────────────────────┐
  │ N+ NovaPad  File Edit Search View ...   │ ← MenuBar (custom, full menus)
  │                              🔍 📁 🌙  │   (quick icons on right side)
  │ [Toolbar icons...]                      │ ← Toolbar (optional)
  │ [Tabs]                                  │
  │ [Editor]                                │
  │ [StatusBar]                             │
  └─────────────────────────────────────────┘
```

## Resolved Questions

### Q1: QuickStrip on Windows/Linux — same row
Quick icons stay on the right side of the MenuBar row (like current layout). QuickStrip only renders as a separate row on macOS where MenuBar is hidden. This saves vertical space and keeps the layout familiar.

### Q2: Native menu on Windows/Linux — auto-hide
`win.setAutoHideMenuBar(true)` on Windows/Linux. Native menu is hidden by default, accessible via Alt key. Custom MenuBar is the primary UI. No visual duplication.

## Files to Modify
- `src/main/menu.ts` — add state sync listener, update checkbox state on IPC from renderer
- `src/preload/index.ts` — add new IPC channels to whitelist
- `src/renderer/src/components/editor/MenuBar.tsx` — add all missing menus, conditional render per platform
- `src/renderer/src/components/editor/QuickStrip.tsx` — NEW component
- `src/renderer/src/App.tsx` — wire QuickStrip, conditional MenuBar, bidirectional sync
- `src/renderer/src/store/uiStore.ts` — add sync-back actions
- `src/renderer/src/components/EditorPane/EditorPane.tsx` — add editor context menu
