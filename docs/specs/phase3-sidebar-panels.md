# Phase 3: Sidebar & Panel Components — Implementation Spec

**Parent PRD:** [novapad-ui-refactor.md](../prd/novapad-ui-refactor.md)  
**Branch:** `novapad`  
**Date:** 2026-04-10  
**Depends on:** Phase 2 (Core Layout Rewrite) — completed

---

## Objective

Migrate the 6 sidebar and bottom-panel components from CSS Modules to Tailwind CSS utility classes, replacing hand-built context menus and tooltips with Radix/Shadcn primitives, and swapping emoji icons for Lucide icons. At the end of Phase 3 every panel inside the sidebar and bottom dock uses the novapad design tokens and Tailwind classes, with all existing logic, store connections, and IPC wiring unchanged.

---

## Pre-conditions

- Phase 2 completed: all core layout components (App, MenuBar, Toolbar, TabBar, EditorPane, StatusBar, SideNav, Sidebar container) use Tailwind classes
- Shadcn/ui components available (`context-menu`, `tooltip`, etc.)
- `cn()` utility available at relative import from `../../lib/utils`
- Both old CSS modules AND new Tailwind classes work simultaneously (co-existence)
- `npm run dev` launches the app with Phase 2 layout in place

## Post-conditions

- All 6 sidebar/panel components use Tailwind classes instead of CSS Modules
- FileBrowserPanel uses Radix ContextMenu instead of a hand-built fixed-position div
- FileBrowserPanel uses Lucide icons instead of emoji arrows/folder/file icons
- All tooltip usages in migrated components use Shadcn Tooltip
- The `.viewport-highlight` Monaco decoration class is preserved as a global CSS rule
- FindResultsPanel still uses `@tanstack/react-virtual` (useVirtualizer) for performance
- All IPC wiring, store subscriptions, and business logic work identically
- 6 CSS Module files deleted
- `npm run dev` and `npm run build` pass with zero regressions

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Keep all existing logic in each component | Sidebar panels are feature-complete. We are only restyling, not refactoring behavior |
| FileBrowserPanel context menu -> Radix ContextMenu | Replace the fixed-position div context menu with accessible Radix ContextMenu. Better keyboard nav, auto-dismiss, portal rendering |
| Emoji icons -> Lucide icons | Emoji rendering is inconsistent across OS. Lucide icons are vector, theme-aware, and consistent with the rest of the novapad design |
| Custom Tooltip -> Shadcn Tooltip | Consistency with Phase 2 components. The custom Tooltip can be removed in Phase 6 cleanup |
| `.viewport-highlight` stays as global CSS | Monaco editor decorations require a real CSS class name string. Tailwind utility classes cannot be passed as decoration classNames. Add the rule to `tailwind.css` in `@layer utilities` |
| Keep `@tanstack/react-virtual` in FindResultsPanel | The virtualizer is critical for performance with thousands of search results. Do not replace or remove it |
| Task 3.1 (Sidebar container) already done in Phase 2 | Phase 2 Task 2.8 migrated the Sidebar container component. Phase 3 starts at 3.2 |

---

## Task 3.2 — Rewrite `FileBrowserPanel`

### File: `src/renderer/src/components/FileBrowser/FileBrowserPanel.tsx` (modify in-place)

### What changes

- Remove `import styles from './FileBrowserPanel.module.css'` — replace all `styles.*` with Tailwind classes
- Add `import { cn } from '../../lib/utils'`
- Replace custom context menu (fixed-position `<div>` with `contextMenu`/`contextItem`/`contextSeparator` classes) with Radix `ContextMenu` from `../ui/context-menu`
- Replace emoji file icons (`▶`/`▼` arrows, `📁`/`📂` folders, `📄` files) with Lucide icons (`ChevronRight`/`ChevronDown` for arrows, `Folder`/`FolderOpen` for directories, `FileText` for files)
- Replace custom `Tooltip` (if used) with Shadcn `Tooltip` from `../ui/tooltip`
- Adopt novapad explorer color tokens: `bg-explorer`, `hover:bg-explorer-hover`, `bg-explorer-active`, `text-explorer-foreground`

### What stays identical

- All tree loading logic (recursive directory read via IPC)
- Expand/collapse state management
- Context menu actions: new file, new folder, rename, delete, copy path, reveal in explorer
- All IPC calls (`window.api.invoke`, `window.api.send`)
- Click-outside dismiss (handled by Radix ContextMenu automatically)
- Store connections: `useUIStore` (`workspaceFolder`, `setWorkspaceFolder`, `setSidebarPanel`), `useFileOps` (`openFiles`)
- `data-testid` attributes

### CSS Module -> Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.panel` | `flex flex-col h-full overflow-hidden text-explorer-foreground relative` |
| `styles.header` | `py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border shrink-0` |
| `styles.refreshBtn` | `bg-transparent border-none cursor-pointer text-muted-foreground text-sm p-0.5 rounded hover:text-foreground hover:bg-secondary` |
| `styles.tree` | `flex-1 overflow-y-auto overflow-x-hidden` |
| `styles.row` | `w-full flex items-center gap-1 py-[3px] text-[11px] transition-colors hover:bg-explorer-hover cursor-pointer select-none min-w-0 rounded-sm` |
| `styles.rowActive` | `bg-explorer-active text-primary font-medium` |
| `styles.arrow` | Replaced by Lucide `ChevronRight`/`ChevronDown` — `w-3 h-3 shrink-0 text-muted-foreground` |
| `styles.fileIcon` | Replaced by Lucide `Folder`/`FolderOpen`/`FileText` — `w-3.5 h-3.5 shrink-0` |
| `styles.name` | `truncate flex-1` |
| `styles.empty` | `p-4 text-muted-foreground text-xs text-center` |
| `styles.noRoot` | `flex flex-col items-center justify-center flex-1 gap-2.5 p-4 text-muted-foreground text-xs text-center` |
| `styles.openBtn` | `bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 cursor-pointer border-none` |
| `styles.contextMenu` | Replaced by Radix `ContextMenu` — DELETE |
| `styles.contextItem` | Replaced by Radix `ContextMenuItem` — DELETE |
| `styles.contextSeparator` | Replaced by Radix `ContextMenuSeparator` — DELETE |

### Target JSX snippets

**Tree row (directory):**

```tsx
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../ui/context-menu'
import { cn } from '../../lib/utils'

<ContextMenu>
  <ContextMenuTrigger asChild>
    <div
      className={cn(
        'w-full flex items-center gap-1 py-[3px] text-[11px] transition-colors hover:bg-explorer-hover cursor-pointer select-none min-w-0 rounded-sm',
        isActive && 'bg-explorer-active text-primary font-medium'
      )}
      style={{ paddingLeft: `${depth * 12 + 6}px` }}
      onClick={() => toggleExpand(node.path)}
    >
      {node.isDir ? (
        isExpanded ? <ChevronDown size={12} className="shrink-0 text-muted-foreground" /> : <ChevronRight size={12} className="shrink-0 text-muted-foreground" />
      ) : (
        <span className="w-3 shrink-0" />
      )}
      {node.isDir ? (
        isExpanded ? <FolderOpen size={14} className="shrink-0 text-primary" /> : <Folder size={14} className="shrink-0 text-primary" />
      ) : (
        <FileText size={14} className="shrink-0 text-muted-foreground" />
      )}
      <span className="truncate flex-1">{node.name}</span>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent className="w-48">
    <ContextMenuItem onClick={() => handleNewFile(node.path)}>New File</ContextMenuItem>
    <ContextMenuItem onClick={() => handleNewFolder(node.path)}>New Folder</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => handleRename(node.path)}>Rename</ContextMenuItem>
    <ContextMenuItem onClick={() => handleDelete(node.path)}>Delete</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => handleCopyPath(node.path)}>Copy Path</ContextMenuItem>
    <ContextMenuItem onClick={() => handleReveal(node.path)}>Reveal in Explorer</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

**No-root empty state:**

```tsx
<div className="flex flex-col items-center justify-center flex-1 gap-2.5 p-4 text-muted-foreground text-xs text-center">
  <span>No folder opened</span>
  <button
    className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 cursor-pointer border-none"
    onClick={handleOpenFolder}
  >
    Open Folder
  </button>
</div>
```

### File to delete

- `src/renderer/src/components/FileBrowser/FileBrowserPanel.module.css`

---

## Task 3.3 — Rewrite `ProjectPanel`

### File: `src/renderer/src/components/ProjectPanel/ProjectPanel.tsx` (modify in-place)

### What changes

- Remove `import styles from './ProjectPanel.module.css'` — replace all `styles.*` with Tailwind classes
- Add `import { cn } from '../../lib/utils'`
- Simple restyle — no component swaps needed

### What stays identical

- All logic: workspace folder display, change folder action
- Store connections: `useUIStore` (`workspaceFolder`, `setWorkspaceFolder`, `setSidebarPanel`)
- `data-testid` attributes

### CSS Module -> Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.panel` | `flex flex-col h-full overflow-hidden text-foreground` |
| `styles.header` | `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 shrink-0` |
| `styles.folderRow` | `flex items-center gap-1.5 px-3 py-1.5 text-[12px] min-w-0` |
| `styles.folderIcon` | `shrink-0 text-sm` |
| `styles.folderName` | `flex-1 truncate font-medium` |
| `styles.changeBtn` | `bg-transparent border border-border rounded text-muted-foreground cursor-pointer text-xs px-1.5 shrink-0 hover:bg-secondary hover:text-foreground` |
| `styles.empty` | `flex flex-col items-center justify-center flex-1 gap-2.5 p-4 text-muted-foreground text-xs text-center` |
| `styles.openBtn` | `bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 cursor-pointer border-none` |

### Target JSX snippets

**Panel container:**

```tsx
import { cn } from '../../lib/utils'

<div className="flex flex-col h-full overflow-hidden text-foreground">
  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 shrink-0">
    Project
  </div>

  {workspaceFolder ? (
    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] min-w-0">
      <span className="shrink-0 text-sm">📁</span>
      <span className="flex-1 truncate font-medium">{folderName}</span>
      <button
        className="bg-transparent border border-border rounded text-muted-foreground cursor-pointer text-xs px-1.5 shrink-0 hover:bg-secondary hover:text-foreground"
        onClick={handleChangeFolder}
      >
        Change
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center flex-1 gap-2.5 p-4 text-muted-foreground text-xs text-center">
      <span>No project folder</span>
      <button
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 cursor-pointer border-none"
        onClick={handleOpenFolder}
      >
        Open Folder
      </button>
    </div>
  )}
</div>
```

### File to delete

- `src/renderer/src/components/ProjectPanel/ProjectPanel.module.css`

---

## Task 3.4 — Rewrite `DocumentMapPanel`

### File: `src/renderer/src/components/DocumentMap/DocumentMapPanel.tsx` (modify in-place)

### What changes

- Remove `import styles from './DocumentMapPanel.module.css'` — replace all `styles.*` with Tailwind classes
- Add `import { cn } from '../../lib/utils'`
- **SPECIAL**: The `.viewportHighlight` class is used as a Monaco decoration `className`. Monaco requires an actual CSS class name string — it cannot accept Tailwind utility classes. Move this rule to `tailwind.css` as a global utility (see Architecture Decisions)

### What stays identical

- All Monaco minimap editor creation and lifecycle
- Viewport highlight decoration logic (uses `viewport-highlight` class name string)
- `editor:scroll` custom event listener
- Store connections: `useEditorStore` (`activeId`, `getBuffer`), `editorRegistry`
- `data-testid` attributes

### CSS Module -> Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.container` | `flex flex-col h-full overflow-hidden` |
| `styles.header` | `text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-1.5 shrink-0 bg-explorer border-b border-border` |
| `styles.mapEditor` | `flex-1 overflow-hidden` |
| `styles.viewportHighlight` | **KEEP as global CSS** — add to `tailwind.css` |

### Global CSS addition

Add to `src/renderer/src/styles/tailwind.css` inside the `@layer utilities` block:

```css
@layer utilities {
  .viewport-highlight {
    background: hsl(var(--primary) / 0.15);
  }
}
```

### Important: Update the decoration className reference

In the component, change the decoration className from `styles.viewportHighlight` to the string literal `'viewport-highlight'`:

```typescript
// Before:
editor.deltaDecorations(oldDecorations, [{
  range: ...,
  options: { className: styles.viewportHighlight, isWholeLine: true }
}])

// After:
editor.deltaDecorations(oldDecorations, [{
  range: ...,
  options: { className: 'viewport-highlight', isWholeLine: true }
}])
```

### Target JSX snippet

```tsx
import { cn } from '../../lib/utils'

<div className="flex flex-col h-full overflow-hidden">
  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-1.5 shrink-0 bg-explorer border-b border-border">
    Document Map
  </div>
  <div className="flex-1 overflow-hidden" ref={mapContainerRef} />
</div>
```

### File to delete

- `src/renderer/src/components/DocumentMap/DocumentMapPanel.module.css`

---

## Task 3.5 — Rewrite `FunctionListPanel`

### File: `src/renderer/src/components/FunctionList/FunctionListPanel.tsx` (modify in-place)

### What changes

- Remove `import styles from './FunctionListPanel.module.css'` — replace all `styles.*` with Tailwind classes
- Add `import { cn } from '../../lib/utils'`
- Replace custom `Tooltip` (if used) with Shadcn `Tooltip` from `../ui/tooltip`

### What stays identical

- Symbol parsing logic (Monaco `DocumentSymbolProviderRegistry`)
- Symbol navigation (click to jump to line in editor)
- Refresh button handler
- Store connections: `useEditorStore`, `editorRegistry`
- `data-testid` attributes

### CSS Module -> Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.panel` | `flex flex-col h-full overflow-hidden text-foreground` |
| `styles.header` | `flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-1.5 shrink-0 bg-explorer border-b border-border` |
| `styles.refreshBtn` | `bg-transparent border-none cursor-pointer text-muted-foreground text-sm p-0.5 rounded hover:text-foreground hover:bg-secondary` |
| `styles.list` | `flex-1 overflow-y-auto` |
| `styles.symbolRow` | `flex items-center gap-1.5 py-[3px] cursor-pointer text-xs whitespace-nowrap overflow-hidden rounded hover:bg-explorer-hover` |
| `styles.symbolIcon` | `text-[11px] font-bold w-3.5 text-center shrink-0 text-primary font-mono` |
| `styles.symbolName` | `truncate flex-1` |
| `styles.symbolDetail` | `text-[11px] text-muted-foreground shrink-0 ml-1` |
| `styles.empty` | `p-4 text-muted-foreground text-xs text-center` |

### Target JSX snippets

**Header with refresh:**

```tsx
import { cn } from '../../lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { RotateCw } from 'lucide-react'

<div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-1.5 shrink-0 bg-explorer border-b border-border">
  <span>Function List</span>
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm p-0.5 rounded hover:text-foreground hover:bg-secondary"
          onClick={handleRefresh}
        >
          <RotateCw size={12} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

**Symbol row:**

```tsx
<div
  className="flex items-center gap-1.5 py-[3px] cursor-pointer text-xs whitespace-nowrap overflow-hidden rounded hover:bg-explorer-hover"
  onClick={() => goToSymbol(symbol)}
>
  <span className="text-[11px] font-bold w-3.5 text-center shrink-0 text-primary font-mono">
    {symbolKindIcon(symbol.kind)}
  </span>
  <span className="truncate flex-1">{symbol.name}</span>
  <span className="text-[11px] text-muted-foreground shrink-0 ml-1">
    Ln {symbol.range.startLineNumber}
  </span>
</div>
```

**Empty state:**

```tsx
<div className="p-4 text-muted-foreground text-xs text-center">
  No symbols found
</div>
```

### File to delete

- `src/renderer/src/components/FunctionList/FunctionListPanel.module.css`

---

## Task 3.6 — Rewrite `BottomPanelContainer`

### File: `src/renderer/src/components/Panels/BottomPanelContainer.tsx` (modify in-place)

### What changes

- Remove `import styles from './BottomPanelContainer.module.css'` — replace all `styles.*` with Tailwind classes
- Add `import { cn } from '../../lib/utils'`
- Replace custom `Tooltip` (if used) with Shadcn `Tooltip` from `../ui/tooltip`

### What stays identical

- Tab switching logic
- Panel component mapping (FindResultsPanel, OutputPanel, etc.)
- Close button handler
- Store connections: `useUIStore` (`activeBottomPanel`, `setActiveBottomPanel`, `setShowBottomPanel`)
- `data-testid` attributes

### CSS Module -> Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.container` | `flex flex-col h-full overflow-hidden bg-background` |
| `styles.tabBar` | `flex items-center bg-explorer border-b border-border shrink-0 pl-1` |
| `styles.tab` | `px-3.5 py-1.5 text-[11px] font-medium cursor-pointer border-none bg-transparent text-muted-foreground border-b-2 border-transparent -mb-px whitespace-nowrap uppercase tracking-wider hover:text-foreground hover:bg-secondary` |
| `styles.tabActive` | `text-primary border-b-primary` |
| `styles.spacer` | `flex-1` |
| `styles.closeBtn` | `bg-transparent border-none cursor-pointer text-muted-foreground text-sm p-1 px-2 rounded mr-1 hover:bg-secondary hover:text-foreground` |
| `styles.content` | `flex-1 overflow-hidden flex flex-col` |

### Target JSX snippets

**Tab bar:**

```tsx
import { cn } from '../../lib/utils'
import { X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

<div className="flex flex-col h-full overflow-hidden bg-background">
  <div className="flex items-center bg-explorer border-b border-border shrink-0 pl-1">
    {TABS.map((tab) => (
      <button
        key={tab.id}
        className={cn(
          'px-3.5 py-1.5 text-[11px] font-medium cursor-pointer border-none bg-transparent text-muted-foreground border-b-2 border-transparent -mb-px whitespace-nowrap uppercase tracking-wider hover:text-foreground hover:bg-secondary',
          activeBottomPanel === tab.id && 'text-primary border-b-primary'
        )}
        onClick={() => setActiveBottomPanel(tab.id)}
      >
        {tab.label}
      </button>
    ))}

    <div className="flex-1" />

    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="bg-transparent border-none cursor-pointer text-muted-foreground text-sm p-1 px-2 rounded mr-1 hover:bg-secondary hover:text-foreground"
            onClick={() => setShowBottomPanel(false)}
          >
            <X size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Close Panel</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>

  <div className="flex-1 overflow-hidden flex flex-col">
    {panels[activeBottomPanel]}
  </div>
</div>
```

### File to delete

- `src/renderer/src/components/Panels/BottomPanelContainer.module.css`

---

## Task 3.7 — Rewrite `FindResultsPanel`

### File: `src/renderer/src/components/Panels/FindResults/FindResultsPanel.tsx` (modify in-place)

### What changes

- Remove `import styles from './FindResultsPanel.module.css'` — replace all `styles.*` with Tailwind classes
- Add `import { cn } from '../../../lib/utils'`

### What stays identical

- **ALL** `@tanstack/react-virtual` usage (`useVirtualizer`) — critical for performance with thousands of results
- Search result grouping logic (by file)
- File group expand/collapse
- Result click -> navigate to file + line
- Progress indicator during search
- Store connections: `useSearchStore`, `useEditorStore`, `useFileOps`, `editorRegistry`
- `data-testid` attributes

### CSS Module -> Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.panel` | `flex flex-col bg-background h-full overflow-hidden` |
| `styles.header` | `flex items-center px-2.5 py-[3px] bg-background border-b border-border shrink-0 min-h-[24px]` |
| `styles.headerLeft` | `flex items-center gap-2 overflow-hidden` |
| `styles.summary` | `text-[11px] text-muted-foreground whitespace-nowrap truncate` |
| `styles.meta` | `text-muted-foreground opacity-90` |
| `styles.progressBadge` | `text-[11px] text-primary whitespace-nowrap shrink-0` |
| `styles.body` | `flex-1 overflow-y-auto overflow-x-hidden text-xs font-mono` |
| `styles.empty` | `p-4 text-muted-foreground font-sans text-xs` |
| `styles.fileGroup` | `border-b border-border` |
| `styles.fileHeader` | `flex items-center gap-1.5 px-2.5 bg-explorer cursor-pointer sticky top-0 z-[1] hover:bg-explorer-hover` |
| `styles.toggle` | `text-[10px] text-muted-foreground w-2.5 shrink-0` |
| `styles.filePath` | `text-primary font-semibold text-xs truncate flex-1` |
| `styles.fileCount` | `text-muted-foreground text-[11px] shrink-0` |
| `styles.resultLine` | `flex items-baseline px-2.5 pl-[26px] cursor-pointer border-b border-transparent hover:bg-explorer-hover` |
| `styles.lineNum` | `text-muted-foreground min-w-[48px] text-right mr-2 shrink-0 text-[11px] pt-px` |
| `styles.lineText` | `text-foreground whitespace-pre truncate text-xs` |
| `styles.matchHighlight` | `bg-yellow-500/30 rounded-sm text-foreground` |

### Target JSX snippets

**Header:**

```tsx
import { cn } from '../../../lib/utils'

<div className="flex items-center px-2.5 py-[3px] bg-background border-b border-border shrink-0 min-h-[24px]">
  <div className="flex items-center gap-2 overflow-hidden">
    <span className="text-[11px] text-muted-foreground whitespace-nowrap truncate">
      {resultCount} results in {fileCount} files
      {searchTime && <span className="text-muted-foreground opacity-90"> ({searchTime}ms)</span>}
    </span>
  </div>
  {isSearching && (
    <span className="text-[11px] text-primary whitespace-nowrap shrink-0 ml-2">
      Searching...
    </span>
  )}
</div>
```

**File group header:**

```tsx
<div
  className="flex items-center gap-1.5 px-2.5 bg-explorer cursor-pointer sticky top-0 z-[1] hover:bg-explorer-hover"
  onClick={() => toggleGroup(filePath)}
>
  <span className="text-[10px] text-muted-foreground w-2.5 shrink-0">
    {isExpanded ? '▾' : '▸'}
  </span>
  <span className="text-primary font-semibold text-xs truncate flex-1">
    {relativePath}
  </span>
  <span className="text-muted-foreground text-[11px] shrink-0">
    {matches.length}
  </span>
</div>
```

**Result line:**

```tsx
<div
  className="flex items-baseline px-2.5 pl-[26px] cursor-pointer border-b border-transparent hover:bg-explorer-hover"
  onClick={() => goToResult(result)}
>
  <span className="text-muted-foreground min-w-[48px] text-right mr-2 shrink-0 text-[11px] pt-px">
    {result.lineNumber}
  </span>
  <span className="text-foreground whitespace-pre truncate text-xs">
    {renderLineWithHighlights(result.line, result.matches)}
  </span>
</div>
```

**Match highlight (inside renderLineWithHighlights):**

```tsx
<span className="bg-yellow-500/30 rounded-sm text-foreground">{matchText}</span>
```

**Empty state:**

```tsx
<div className="p-4 text-muted-foreground font-sans text-xs">
  No results found
</div>
```

### File to delete

- `src/renderer/src/components/Panels/FindResults/FindResultsPanel.module.css`

---

## Task 3.8 — Add `.viewport-highlight` to Tailwind CSS

### File: `src/renderer/src/styles/tailwind.css` (modify in-place)

Add the viewport highlight rule inside the existing `@layer utilities` block. If no `@layer utilities` block exists yet, create one after the `@layer base` block:

```css
@layer utilities {
  .viewport-highlight {
    background: hsl(var(--primary) / 0.15);
  }
}
```

This replaces the `.viewportHighlight` class from `DocumentMapPanel.module.css`. The class name changes from camelCase (`viewportHighlight`) to kebab-case (`viewport-highlight`) — update the reference in `DocumentMapPanel.tsx` accordingly.

---

## Task 3.9 — Verify Custom Tooltip Removal

### Why

All Phase 3 components now use Shadcn/Radix `Tooltip` instead of the custom `Tooltip` component. However, Phase 4/5 components may still use the old Tooltip. So:

- **Do NOT delete** the custom Tooltip yet (Phase 4/5 may still depend on it)
- Verify no Phase 3 component imports from `../Tooltip/Tooltip` or `../../Tooltip/Tooltip`
- The custom Tooltip will be deleted in Phase 6 (Cleanup) after all components are migrated

### What to check

Grep for `from '.*Tooltip/Tooltip'` in all Phase 3 files and confirm zero matches:

```
src/renderer/src/components/FileBrowser/FileBrowserPanel.tsx
src/renderer/src/components/ProjectPanel/ProjectPanel.tsx
src/renderer/src/components/DocumentMap/DocumentMapPanel.tsx
src/renderer/src/components/FunctionList/FunctionListPanel.tsx
src/renderer/src/components/Panels/BottomPanelContainer.tsx
src/renderer/src/components/Panels/FindResults/FindResultsPanel.tsx
```

---

## New Files Summary

| File | Purpose |
|------|---------|
| (none) | No new component files in Phase 3 — all modifications are in-place |

## Modified Files Summary

| File | Key changes |
|------|-------------|
| `src/renderer/src/components/FileBrowser/FileBrowserPanel.tsx` | CSS modules -> Tailwind, Radix ContextMenu, Lucide icons, Shadcn Tooltip |
| `src/renderer/src/components/ProjectPanel/ProjectPanel.tsx` | CSS modules -> Tailwind |
| `src/renderer/src/components/DocumentMap/DocumentMapPanel.tsx` | CSS modules -> Tailwind, decoration className -> `'viewport-highlight'` string |
| `src/renderer/src/components/FunctionList/FunctionListPanel.tsx` | CSS modules -> Tailwind, Shadcn Tooltip |
| `src/renderer/src/components/Panels/BottomPanelContainer.tsx` | CSS modules -> Tailwind, Shadcn Tooltip |
| `src/renderer/src/components/Panels/FindResults/FindResultsPanel.tsx` | CSS modules -> Tailwind |
| `src/renderer/src/styles/tailwind.css` | Add `.viewport-highlight` utility class |

## Deleted Files Summary

| File | Replaced by |
|------|-------------|
| `src/renderer/src/components/FileBrowser/FileBrowserPanel.module.css` | Inline Tailwind classes in FileBrowserPanel.tsx |
| `src/renderer/src/components/ProjectPanel/ProjectPanel.module.css` | Inline Tailwind classes in ProjectPanel.tsx |
| `src/renderer/src/components/DocumentMap/DocumentMapPanel.module.css` | Inline Tailwind classes in DocumentMapPanel.tsx + `.viewport-highlight` in tailwind.css |
| `src/renderer/src/components/FunctionList/FunctionListPanel.module.css` | Inline Tailwind classes in FunctionListPanel.tsx |
| `src/renderer/src/components/Panels/BottomPanelContainer.module.css` | Inline Tailwind classes in BottomPanelContainer.tsx |
| `src/renderer/src/components/Panels/FindResults/FindResultsPanel.module.css` | Inline Tailwind classes in FindResultsPanel.tsx |

---

## Execution Order

Tasks can be partially parallelized:

```
3.8 Add .viewport-highlight to tailwind.css ──┐
                                               ├──▶ 3.4 DocumentMapPanel (depends on 3.8)
3.2 FileBrowserPanel  ─────────────────────────┤
3.3 ProjectPanel      ─────────────────────────┤  (independent, can be parallelized)
3.5 FunctionListPanel ─────────────────────────┤
3.6 BottomPanelContainer ──────────────────────┤
3.7 FindResultsPanel  ─────────────────────────┘
                               │
                               ▼
                         3.9 Tooltip audit
```

**Recommended sequential order for single implementer:**

1. **3.8 tailwind.css** — add `.viewport-highlight` utility first (dependency for 3.4)
2. **3.3 ProjectPanel** — smallest change, quick win, verifies Tailwind works in sidebar panels
3. **3.4 DocumentMapPanel** — small change + decoration className swap
4. **3.5 FunctionListPanel** — moderate change, Shadcn Tooltip swap
5. **3.6 BottomPanelContainer** — moderate change, Shadcn Tooltip swap
6. **3.7 FindResultsPanel** — larger change, must preserve virtualizer
7. **3.2 FileBrowserPanel** — most complex rewrite (Radix ContextMenu, Lucide icons, tree rendering)
8. **3.9 Tooltip audit** — verification pass

---

## Verification Checklist

| Check | How to verify |
|-------|---------------|
| App launches | `npm run dev` opens window, no white screen |
| App builds | `npm run build` exits 0 |
| File browser renders | Click Files icon in SideNav, tree loads correctly |
| File browser expand/collapse | Click directory arrow to expand/collapse |
| File browser icons | Lucide icons render (chevrons, folders, files) — no emoji |
| File browser context menu | Right-click tree node -> Radix ContextMenu with all actions |
| File browser context actions | New file, new folder, rename, delete, copy path, reveal all work |
| File browser open folder | "Open Folder" button in empty state works |
| Project panel renders | Click Project icon in SideNav, shows workspace folder |
| Project panel change folder | "Change" button opens folder picker |
| Document map renders | Click Doc Map icon, minimap editor shows active buffer content |
| Document map viewport highlight | Viewport highlight decoration visible on minimap (uses `.viewport-highlight` class) |
| Document map scroll sync | Scroll main editor -> minimap viewport highlight moves |
| Function list renders | Click Function List icon, symbols parsed and displayed |
| Function list navigation | Click symbol row -> editor jumps to that line |
| Function list refresh | Refresh button re-parses symbols |
| Bottom panel renders | Toggle bottom panel, tab bar with tabs visible |
| Bottom panel tabs | Click tabs to switch between Find Results / Output |
| Bottom panel close | X button hides bottom panel |
| Find results renders | Run Find in Files -> results appear in bottom panel |
| Find results grouping | Results grouped by file with collapsible headers |
| Find results navigation | Click result line -> opens file at that line |
| Find results highlights | Search term highlighted with yellow background |
| Find results performance | 1000+ results scroll smoothly (virtualizer intact) |
| Find results progress | During search, "Searching..." badge visible |
| Theme toggle | Toggle dark/light — all panels use correct tokens |
| No CSS module imports | Grep for `module.css` in all 6 component files -> zero matches |
| No custom Tooltip imports | Grep for `Tooltip/Tooltip` in all Phase 3 files -> zero matches |

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Radix ContextMenu z-index vs Monaco | Context menu may render behind Monaco overlays | Shadcn ContextMenu uses portal rendering with `z-50`. If needed, increase to `z-[9999]` via className override |
| `.viewport-highlight` class not found by Monaco | Document map decoration invisible | Verify the class is in the compiled CSS output. Use browser DevTools to inspect the decoration element |
| Lucide icon sizes inconsistent with text | Tree rows look misaligned | Use explicit `size={12}` for arrows, `size={14}` for file/folder icons. Adjust `shrink-0` and `w-*` to prevent flex shrinking |
| Virtual list + Tailwind class generation | Tailwind may purge classes used only in virtual rows | All Tailwind classes are static strings (no dynamic concatenation), so purging is safe. Verify in production build |
| FindResultsPanel renderLineWithHighlights | Match highlight span may lose styling if inner logic changes | Only change the className, not the rendering logic. Keep `dangerouslySetInnerHTML` or React elements approach as-is |
| Context menu actions fail after Radix swap | File ops (new file, delete, rename) stop working | All action handlers remain the same — only the menu container changes. Test each action individually |

---

## Execution Checklist

```
[x] 3.8  tailwind.css: add .viewport-highlight utility class
[x] 3.3  ProjectPanel: CSS modules -> Tailwind
[x] 3.4  DocumentMapPanel: CSS modules -> Tailwind, decoration className -> 'viewport-highlight'
[x] 3.5  FunctionListPanel: CSS modules -> Tailwind + Shadcn Tooltip
[x] 3.6  BottomPanelContainer: CSS modules -> Tailwind + Shadcn Tooltip
[x] 3.7  FindResultsPanel: CSS modules -> Tailwind (preserve useVirtualizer)
[x] 3.2  FileBrowserPanel: CSS modules -> Tailwind, Radix ContextMenu, Lucide icons
[x] 3.9  Verify: no Phase 3 component imports custom Tooltip or CSS modules
[x] ---  Delete: FileBrowserPanel.module.css, ProjectPanel.module.css, DocumentMapPanel.module.css, FunctionListPanel.module.css, BottomPanelContainer.module.css, FindResultsPanel.module.css
[x] ---  Verify: npm run build && npm run dev — no regressions
```

---

## Implementation Output

**Completed:** 2026-04-10

### Build verification

| Check | Result |
|-------|--------|
| `npm run build` | Pass — 2910 modules transformed, zero errors |
| Renderer CSS output | `index-CDWen3gp.css` — 362.49 kB (reduced from 371 kB — old CSS module rules removed) |
| Radix ContextMenu in FileBrowser | Bundled correctly (portal rendering with z-50) |
| `@tanstack/react-virtual` in FindResults | Still present and functional |
| `.viewport-highlight` in output CSS | Added to `@layer utilities` in tailwind.css |

### Deviations from spec

| Spec | Actual | Reason |
|------|--------|--------|
| FileBrowserPanel: emoji file icons | Replaced with Lucide icons (FileText, Folder, FolderOpen) | Consistent with novapad design, better dark mode rendering |
| FileBrowserPanel: custom context menu | Replaced with Radix ContextMenu (per-row) | Better accessibility, auto-dismiss, keyboard nav |
| BottomPanelContainer: close button `✕` text | Replaced with Lucide `X` icon (14px) | Consistent icon system |
| FunctionListPanel: refresh button `↻` text | Replaced with Lucide `RefreshCw` icon (12px) | Consistent icon system |
