# PRD: NovaPad UI Refactor

**Epic:** Renderer UI Overhaul  
**Branch:** `novapad`  
**Date:** 2026-04-10  
**Status:** Draft

---

## 1. Overview

Complete replacement of the renderer UI layer in Notepad & More. The current UI uses hand-crafted CSS Modules with a Material Design 3 teal theme. The new UI (source: `/Users/haht/Documents/Workspace/viber/novapad`) uses **Tailwind CSS + Shadcn/ui + Radix UI** with a VS Code-inspired blue/gray palette.

**Scope:** Only the renderer (`src/renderer/src/`). Main process, preload, IPC, and build system are untouched.

---

## 2. Goals

| # | Goal | Rationale |
|---|------|-----------|
| G1 | Adopt Tailwind CSS as the styling system | Faster iteration, utility-first, no more maintaining dozens of `.module.css` files |
| G2 | Adopt Shadcn/ui component library | 43 accessible, composable primitives — less custom code for dialogs, menus, tooltips, etc. |
| G3 | New visual design language | HSL-based CSS variable theme, VS Code-inspired color palette (light + dark) |
| G4 | Keep all existing features working | Every feature from the current UI must work identically after the refactor |
| G5 | Keep Zustand state management | Novapad source uses simple local state — we keep our Zustand stores which are more scalable |

---

## 3. Non-Goals

- No changes to main process, preload, or IPC contracts
- No new features — this is a 1:1 visual replacement
- No changes to the build system (electron-vite stays)
- No changes to E2E test infrastructure (tests will need updates to match new selectors)

---

## 4. Current vs. Target Architecture

### 4.1 Styling

| Aspect | Current | Target |
|--------|---------|--------|
| Framework | CSS Modules (`.module.css` per component) | Tailwind CSS 3.4 (utility classes in JSX) |
| Theme vars | CSS custom properties (hex: `--bg: #131313`) | CSS custom properties (HSL: `--background: 220 16% 12%`) |
| Design tokens | Material Design 3 teal palette | VS Code-inspired blue/gray palette |
| Fonts | Inter + Space Grotesk (via `@fontsource`) | Inter + JetBrains Mono (via Google Fonts or `@fontsource`) |
| Scrollbars | Global webkit scrollbar styles | Scoped `.editor-scrollbar` utility |
| Component styling | Per-file CSS modules | Inline Tailwind classes + `cn()` utility |

### 4.2 Component Library

| Aspect | Current | Target |
|--------|---------|--------|
| Primitives | Custom (hand-built everything) | Shadcn/ui + Radix UI (43 primitives) |
| Icons | Lucide React (custom imports) | Lucide React (same, keep) |
| Dialogs | Custom modal with CSS modules | Radix `@radix-ui/react-dialog` via Shadcn |
| Tooltips | Custom `Tooltip` component | Radix `@radix-ui/react-tooltip` via Shadcn |
| Menus | Custom context menus | Radix dropdown/context menus via Shadcn |
| Toasts | Custom inline toasts | Sonner toast library via Shadcn |

### 4.3 State Management (NO CHANGE)

Zustand stores remain as-is:
- `editorStore.ts` — buffers, active ID, split view
- `uiStore.ts` — theme, visibility toggles, dialog flags
- `configStore.ts` — persistent settings
- `searchStore.ts` — find/replace state
- `pluginStore.ts` — plugins, dynamic menus

### 4.4 Hooks (NO CHANGE)

Business logic hooks remain as-is:
- `useFileOps.ts` — file I/O via IPC
- `useSearchEngine.ts` — find/replace/mark logic
- `useBookmarks.ts` — bookmark decorations
- `useMacroRecorder.ts` — macro record/playback

---

## 5. Deliverables

### Phase 1: Infrastructure Setup

| # | Task | Details |
|---|------|---------|
| 1.1 | Install Tailwind CSS + dependencies | `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate`, `tailwind-merge`, `clsx`, `class-variance-authority` |
| 1.2 | Install Shadcn/ui dependencies | All `@radix-ui/*` packages, `cmdk`, `sonner`, `vaul`, `lucide-react` (already installed) |
| 1.3 | Configure Tailwind | Create `tailwind.config.ts` with custom editor color tokens (toolbar, tab, statusbar, explorer, sidebar) |
| 1.4 | Create base CSS | Replace `styles/global.css` with Tailwind-based `index.css` containing HSL theme variables (light + dark) |
| 1.5 | Add `cn()` utility | Create `src/renderer/src/lib/utils.ts` with `clsx + tailwind-merge` |
| 1.6 | Add Shadcn components dir | Create `src/renderer/src/components/ui/` with all 43 Shadcn primitives from novapad source |
| 1.7 | Configure `components.json` | Shadcn CLI config pointing to renderer src paths |

### Phase 2: Core Layout Rewrite

| # | Task | Details |
|---|------|---------|
| 2.1 | Rewrite `App.tsx` | Replace CSS module layout with Tailwind flex layout. Keep all IPC wiring, store subscriptions, and panel logic. Adapt from novapad's `EditorLayout.tsx` visual structure |
| 2.2 | Rewrite `MenuBar` (new) | Port novapad's `MenuBar.tsx` — Radix menubar with File/Edit/Search/View dropdowns. Wire to existing IPC menu actions |
| 2.3 | Rewrite `Toolbar` | Port novapad's grouped toolbar with Tailwind styling. Keep existing IPC action bindings |
| 2.4 | Rewrite `TabBar` | Port novapad's tab design (blue active indicator, scroll arrows, modified dot). Keep drag-reorder, context menu, ghost/missing indicators. Wire to `editorStore` |
| 2.5 | Rewrite `EditorPane` | Minimal changes — just restyle container with Tailwind. Monaco integration stays identical |
| 2.6 | Rewrite `StatusBar` | Port novapad's compact status bar (24px). Keep all existing status fields (cursor, EOL, encoding, language, state, macro indicator) |
| 2.7 | Rewrite `SideNav` | Restyle with Tailwind. Keep icon navigation + panel switching via `uiStore` |

### Phase 3: Sidebar & Panels

| # | Task | Details |
|---|------|---------|
| 3.1 | Rewrite `Sidebar` container | Tailwind-styled collapsible sidebar. Keep `react-resizable-panels` integration |
| 3.2 | Rewrite `FileBrowserPanel` | Port novapad's `FileExplorer` tree visual style. Keep existing tree data source, context menu, lazy-loading |
| 3.3 | Restyle `ProjectPanel` | Apply Tailwind classes, keep functionality |
| 3.4 | Restyle `DocumentMapPanel` | Apply Tailwind classes, keep Monaco minimap integration |
| 3.5 | Restyle `FunctionListPanel` | Apply Tailwind classes, keep symbol tree functionality |
| 3.6 | Rewrite `BottomPanelContainer` | Tailwind styling for bottom panel tabs |
| 3.7 | Restyle `FindResultsPanel` | Apply Tailwind. Keep virtual scrolling (`@tanstack/react-virtual`) |

### Phase 4: Dialogs

| # | Task | Details |
|---|------|---------|
| 4.1 | Rewrite `FindReplaceDialog` | Port novapad's `FindReplace` overlay design. Use Shadcn Input/Button/Toggle. Keep `useSearchEngine` hook wiring |
| 4.2 | Rewrite `PreferencesDialog` | Use Shadcn Dialog + Tabs + form components. Keep 6-tab structure, keep `configStore` wiring |
| 4.3 | Restyle `PluginManagerDialog` | Use Shadcn Dialog. Keep plugin list + enable/disable via `pluginStore` |
| 4.4 | Restyle `ShortcutMapperDialog` | Use Shadcn Dialog + Table. Keep keybinding editor logic |
| 4.5 | Restyle `StyleConfiguratorDialog` | Use Shadcn Dialog + color inputs. Keep theme editing logic |
| 4.6 | Restyle `UDLEditorDialog` | Use Shadcn Dialog + form components. Keep UDL logic |
| 4.7 | Restyle `AboutDialog` | Use Shadcn Dialog. Simple content update |
| 4.8 | Restyle `WelcomeScreen` | Port novapad's empty-state design with Tailwind |

### Phase 5: Theme & Polish

| # | Task | Details |
|---|------|---------|
| 5.1 | Implement dark/light toggle | Use CSS class strategy (`.dark` on root). Adapt `uiStore.theme` to toggle class instead of `data-theme` attribute |
| 5.2 | Replace toast system | Swap custom inline toasts with Sonner. Keep `uiStore.addToast()` API |
| 5.3 | Replace Tooltip component | Swap custom Tooltip with Shadcn/Radix Tooltip |
| 5.4 | Audit color consistency | Verify all components use CSS variable tokens, no hardcoded colors |
| 5.5 | Audit scrollbar styling | Ensure `.editor-scrollbar` utility applies everywhere needed |
| 5.6 | Font loading | Switch from `@fontsource` to Tailwind font config. Add JetBrains Mono for editor |

### Phase 6: Cleanup & Testing

| # | Task | Details |
|---|------|---------|
| 6.1 | Remove all `.module.css` files | Delete every CSS module file from `src/renderer/src/components/` |
| 6.2 | Remove `styles/global.css` | Replaced by Tailwind `index.css` |
| 6.3 | Remove `@fontsource/*` deps | If switching to Google Fonts CDN |
| 6.4 | Update E2E test selectors | Tests may break due to changed class names / DOM structure. Update selectors |
| 6.5 | Visual regression check | Manual comparison of every screen: editor, all sidebar panels, all dialogs, both themes |
| 6.6 | Performance check | Ensure no regressions in large file loading, find-in-files, session restore |

---

## 6. New Dependencies to Add

```
# Tailwind ecosystem
tailwindcss@^3.4.17
postcss@^8.5.6
autoprefixer@^10.4.21
tailwindcss-animate@^1.0.7
tailwind-merge@^2.6.0

# Shadcn/ui utilities
class-variance-authority@^0.7.1
clsx@^2.1.1

# Radix UI primitives (Shadcn uses these)
@radix-ui/react-accordion
@radix-ui/react-alert-dialog
@radix-ui/react-checkbox
@radix-ui/react-collapsible
@radix-ui/react-context-menu
@radix-ui/react-dialog
@radix-ui/react-dropdown-menu
@radix-ui/react-hover-card
@radix-ui/react-label
@radix-ui/react-menubar
@radix-ui/react-popover
@radix-ui/react-progress
@radix-ui/react-radio-group
@radix-ui/react-scroll-area
@radix-ui/react-select
@radix-ui/react-separator
@radix-ui/react-slider
@radix-ui/react-slot
@radix-ui/react-switch
@radix-ui/react-tabs
@radix-ui/react-toast
@radix-ui/react-toggle
@radix-ui/react-toggle-group
@radix-ui/react-tooltip

# Toast replacement
sonner@^1.7.4

# Command palette (optional, for future)
cmdk@^1.1.1
```

### Dependencies to Remove (Phase 6)

```
@fontsource/inter
@fontsource/space-grotesk
```

---

## 7. File Impact Map

```
MODIFIED (rewrite content, keep file):
  src/renderer/src/App.tsx
  src/renderer/src/main.tsx
  src/renderer/src/components/EditorPane/EditorPane.tsx
  src/renderer/src/components/TabBar/TabBar.tsx
  src/renderer/src/components/TopAppBar/TopAppBar.tsx        (or rename to Toolbar)
  src/renderer/src/components/ToolBar/ToolBar.tsx
  src/renderer/src/components/SideNav/SideNav.tsx
  src/renderer/src/components/Sidebar/Sidebar.tsx
  src/renderer/src/components/StatusBar/StatusBar.tsx
  src/renderer/src/components/FileBrowser/FileBrowserPanel.tsx
  src/renderer/src/components/ProjectPanel/ProjectPanel.tsx
  src/renderer/src/components/DocumentMap/DocumentMapPanel.tsx
  src/renderer/src/components/FunctionList/FunctionListPanel.tsx
  src/renderer/src/components/Panels/BottomPanelContainer.tsx
  src/renderer/src/components/Panels/FindResults/FindResultsPanel.tsx
  src/renderer/src/components/Dialogs/FindReplace/FindReplaceDialog.tsx
  src/renderer/src/components/Dialogs/Preferences/PreferencesDialog.tsx
  src/renderer/src/components/Dialogs/PluginManager/PluginManagerDialog.tsx
  src/renderer/src/components/Dialogs/ShortcutMapper/ShortcutMapperDialog.tsx
  src/renderer/src/components/Dialogs/StyleConfigurator/StyleConfiguratorDialog.tsx
  src/renderer/src/components/Dialogs/UDLEditor/UDLEditorDialog.tsx
  src/renderer/src/components/Dialogs/AboutDialog/AboutDialog.tsx
  src/renderer/src/components/WelcomeScreen/WelcomeScreen.tsx
  src/renderer/src/components/Tooltip/Tooltip.tsx             (replace with Shadcn)

CREATED (new files):
  tailwind.config.ts
  postcss.config.js
  src/renderer/src/index.css                                  (Tailwind base + theme vars)
  src/renderer/src/lib/utils.ts                               (cn utility)
  src/renderer/src/lib/fileIcons.tsx                           (file type icon mapping)
  src/renderer/src/components/ui/*.tsx                         (43 Shadcn components)
  src/renderer/src/components/editor/MenuBar.tsx               (new Radix menubar)
  components.json                                              (Shadcn config)

DELETED (cleanup):
  src/renderer/src/styles/global.css
  src/renderer/src/App.module.css
  src/renderer/src/components/EditorPane/EditorPane.module.css
  src/renderer/src/components/TabBar/TabBar.module.css
  src/renderer/src/components/TopAppBar/TopAppBar.module.css
  src/renderer/src/components/ToolBar/ToolBar.module.css
  src/renderer/src/components/SideNav/SideNav.module.css
  src/renderer/src/components/Sidebar/Sidebar.module.css
  src/renderer/src/components/StatusBar/StatusBar.module.css
  src/renderer/src/components/FileBrowser/FileBrowserPanel.module.css
  src/renderer/src/components/ProjectPanel/ProjectPanel.module.css
  src/renderer/src/components/DocumentMap/DocumentMapPanel.module.css
  src/renderer/src/components/FunctionList/FunctionListPanel.module.css
  src/renderer/src/components/Panels/BottomPanelContainer.module.css
  src/renderer/src/components/Panels/FindResults/FindResultsPanel.module.css
  src/renderer/src/components/Dialogs/FindReplace/FindReplaceDialog.module.css
  src/renderer/src/components/Dialogs/Preferences/PreferencesDialog.module.css
  src/renderer/src/components/Dialogs/PluginManager/PluginManagerDialog.module.css
  src/renderer/src/components/Dialogs/ShortcutMapper/ShortcutMapperDialog.module.css
  src/renderer/src/components/Dialogs/StyleConfigurator/StyleConfiguratorDialog.module.css
  src/renderer/src/components/Dialogs/UDLEditor/UDLEditorDialog.module.css
  src/renderer/src/components/Dialogs/AboutDialog/AboutDialog.module.css
  src/renderer/src/components/WelcomeScreen/WelcomeScreen.module.css
  src/renderer/src/components/Tooltip/Tooltip.module.css

NOT TOUCHED:
  src/renderer/src/store/*                                     (all Zustand stores)
  src/renderer/src/hooks/*                                     (all business logic hooks)
  src/renderer/src/utils/*                                     (all utilities)
  src/main/*                                                   (entire main process)
  src/preload/*                                                (preload bridge)
```

---

## 8. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tailwind purge removes needed classes | UI broken in production | Configure `content` paths correctly in `tailwind.config.ts` |
| Radix UI adds bundle size | Larger app download | Tree-shaking should keep it minimal; monitor with `npm run build` |
| CSS variable migration breaks theme | Colors wrong in one mode | Phase 5.4 audit pass — check every component in both themes |
| E2E tests break with new selectors | CI red | Phase 6.4 — update selectors after UI stabilizes |
| Monaco Editor theme integration | Editor doesn't match app theme | Keep existing `vs`/`vs-dark` mapping, test with both themes |
| Novapad uses local state, we use Zustand | Component wiring mismatch | Every novapad component must be adapted to read from Zustand stores instead of props |

---

## 9. Execution Order

```
Phase 1 (Infrastructure)  ──▶  Phase 2 (Core Layout)  ──▶  Phase 3 (Panels)
                                                              │
                                                              ▼
Phase 6 (Cleanup) ◀──  Phase 5 (Theme & Polish)  ◀──  Phase 4 (Dialogs)
```

Each phase is independently shippable for testing. Phase 2 is the critical path — once the core layout renders, all other phases can proceed in parallel.

---

## 10. Success Criteria

- [ ] All existing features work identically (no functional regression)
- [ ] Zero `.module.css` files remain in `src/renderer/src/`
- [ ] All components use Tailwind utility classes
- [ ] Light and dark themes render correctly on all components
- [ ] Shadcn primitives used for dialogs, tooltips, menus, toasts
- [ ] Bundle size delta < +200KB gzipped
- [ ] E2E tests pass with updated selectors
- [ ] `npm run dev` hot reload works with Tailwind
