# Phase 2: Core Layout Rewrite — Implementation Spec

**Parent PRD:** [novapad-ui-refactor.md](../prd/novapad-ui-refactor.md)  
**Branch:** `novapad`  
**Date:** 2026-04-10  
**Depends on:** Phase 1 (Infrastructure Setup) — completed

---

## Objective

Rewrite the 7 core layout components from CSS Modules to Tailwind utility classes, adopting the novapad visual design while preserving all existing IPC wiring, Zustand store connections, and business logic. At the end of Phase 2 the app renders the new VS Code-inspired layout with all existing features working identically.

---

## Pre-conditions

- Phase 1 completed: Tailwind CSS compiles, Shadcn/ui components available, `cn()` utility exists
- Both `global.css` (old) and `tailwind.css` (new) are loaded — co-existence mode
- `npm run dev` launches the app with Phase 1 infrastructure in place

## Post-conditions

- All 7 core layout components use Tailwind classes instead of CSS Modules
- New `MenuBar` component renders a Radix-based menubar with File/Edit/Search/View dropdowns
- `TopAppBar` is replaced by the new Toolbar (icon-button bar)
- `TabBar` uses novapad design with scroll arrows and blue active indicator
- `StatusBar` is compact (24px) with novapad style
- `SideNav` and `Sidebar` container use Tailwind classes
- All IPC wiring, store subscriptions, drag-reorder, context menus, and session management work identically
- `npm run dev` and `npm run build` pass with zero regressions

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Keep all IPC wiring in `App.tsx` | The IPC `useEffect` block is the backbone of main↔renderer communication. Touching it risks breaking file ops, session restore, theme toggle, etc. Port only the JSX/CSS, not the logic |
| Split TopAppBar into MenuBar + Toolbar | Novapad has a menu bar (text dropdowns) AND a toolbar (icon buttons) as separate rows. Our current `TopAppBar` combines both. Split into two components for finer control |
| MenuBar uses custom dropdown, not Radix Menubar | Novapad's `MenuBar.tsx` implements its own dropdown state (click-to-open, hover-to-switch). This is simpler than wiring Radix `Menubar` to our IPC actions. Port novapad's approach, adapt callbacks to our IPC. Switch to Radix Menubar is optional (Phase 5 polish) |
| TabBar context menu → Radix ContextMenu | Replace the hand-built context menu (fixed position div) with Shadcn `ContextMenu`. Better accessibility, keyboard nav, auto-dismiss |
| Custom Tooltip → Shadcn Tooltip | Replace our custom `Tooltip` component with Shadcn/Radix `Tooltip` throughout all Phase 2 components |
| Preserve `-webkit-app-region: drag` | Electron window dragging requires this on the title bar area. Use Tailwind `[app-region:drag]` arbitrary property or inline style |
| Preserve `data-testid` attributes | E2E tests depend on these. Keep all existing `data-testid` values |
| Keep `data-theme` + `.dark` dual strategy | Old CSS module components still read `data-theme`. New Tailwind components read `.dark` class. Both are applied in `App.tsx`'s theme effect. Full cutover happens in Phase 6 cleanup |

---

## Task 2.1 — Rewrite `App.tsx`

### What changes

- Remove `import styles from './App.module.css'` — replace all `styles.*` with Tailwind classes
- Add `import { cn } from '@/lib/utils'`
- Add new component imports: `MenuBar`, `Toolbar` (replacing `TopAppBar`)
- Adapt `document.documentElement.classList` in theme effect to toggle `.dark` class
- Replace `<ToastContainer>` with Sonner (or keep inline ToastContainer, swap in Phase 5)

### What stays identical

- All IPC `useEffect` wiring (the big ~190-line block) — **do not touch**
- All store imports and subscriptions
- `useFileOps` hook usage
- `PanelGroup` / `Panel` / `PanelResizeHandle` layout structure
- Hidden file input for open dialog
- AutoSave interval logic
- All dialog component rendering

### Target JSX structure

```tsx
import { cn } from '@/lib/utils'
import { MenuBar } from './components/editor/MenuBar'
import { Toolbar } from './components/editor/Toolbar'
// ... keep all other imports ...

export default function App() {
  // ... all existing hooks and logic unchanged ...

  // Theme effect — update both strategies
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground" data-testid="app">
      {/* Menu Bar — always visible, handles its own drag region */}
      <MenuBar
        onNew={newFile}
        onOpen={() => openFileInput.current?.click()}
        onSave={() => { const id = useEditorStore.getState().activeId; if (id) saveBuffer(id) }}
        onSaveAs={() => saveActiveAs()}
        onSaveAll={() => useEditorStore.getState().buffers.forEach((b) => { if (b.isDirty) saveBuffer(b.id) })}
        onClose={() => { const id = useEditorStore.getState().activeId; if (id) closeBuffer(id) }}
        onCloseAll={() => useEditorStore.getState().buffers.forEach((b) => closeBuffer(b.id))}
        onFind={() => openFind('find')}
        onReplace={() => openFind('replace')}
        onFindInFiles={() => openFind('findInFiles')}
        onReload={() => { const id = useEditorStore.getState().activeId; if (id) reloadBuffer(id) }}
      />

      {/* Toolbar — conditional on showToolbar */}
      {showToolbar && (
        <Toolbar
          onNew={newFile}
          onOpen={() => openFileInput.current?.click()}
          onSave={() => { const id = useEditorStore.getState().activeId; if (id) saveBuffer(id) }}
          onSaveAll={() => useEditorStore.getState().buffers.forEach((b) => { if (b.isDirty) saveBuffer(b.id) })}
          onFind={() => openFind('find')}
          onReplace={() => openFind('replace')}
          onClose={() => { const id = useEditorStore.getState().activeId; if (id) closeBuffer(id) }}
        />
      )}

      {/* Hidden file input — unchanged */}
      <input ref={openFileInput} type="file" multiple style={{ display: 'none' }} onChange={...} />

      {/* Body: SideNav + Editor Area */}
      <div className="flex flex-row flex-1 overflow-hidden">
        <SideNav />
        <PanelGroup direction="vertical" className="flex-1 overflow-hidden">
          <Panel minSize={15}>
            <PanelGroup direction="horizontal">
              {showSidebar && (
                <>
                  <Panel defaultSize={18} minSize={12} maxSize={40} className="overflow-hidden">
                    <Sidebar />
                  </Panel>
                  <PanelResizeHandle className="w-1 bg-border cursor-col-resize shrink-0 transition-colors hover:bg-primary data-[resize-handle-active]:bg-primary" />
                </>
              )}
              <Panel defaultSize={showSidebar ? 82 : 100} minSize={20}>
                <div className="flex flex-col h-full overflow-hidden">
                  <TabBar onClose={closeBuffer} onNewFile={newFile} />
                  <div className="flex flex-1 overflow-hidden">
                    {buffers.length === 0 ? (
                      <WelcomeScreen onNewFile={newFile} onOpenFile={...} onOpenRecent={openFiles} />
                    ) : (
                      <EditorPane activeId={activeId} />
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          {showBottomPanel && (
            <>
              <PanelResizeHandle className="h-1 bg-border cursor-row-resize shrink-0 transition-colors hover:bg-primary data-[resize-handle-active]:bg-primary" />
              <Panel defaultSize={25} minSize={8} maxSize={70}>
                <BottomPanelContainer />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {showStatusBar && buffers.length > 0 && <StatusBar />}

      {/* Dialogs — unchanged */}
      <FindReplaceDialog />
      <PluginManagerDialog />
      <AboutDialog />
      <PreferencesDialog />
      <ShortcutMapperDialog />
      <StyleConfiguratorDialog />
      <UDLEditorDialog />
      <ToastContainer />
    </div>
  )
}
```

### CSS Module → Tailwind class mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.app` | `h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground` |
| `styles.bodyArea` | `flex flex-row flex-1 overflow-hidden` |
| `styles.mainPanelGroup` | `flex-1 overflow-hidden` (on PanelGroup className) |
| `styles.vResizeHandle` | `h-1 bg-border cursor-row-resize shrink-0 transition-colors hover:bg-primary data-[resize-handle-active]:bg-primary` |
| `styles.hResizeHandle` | `w-1 bg-border cursor-col-resize shrink-0 transition-colors hover:bg-primary data-[resize-handle-active]:bg-primary` |
| `styles.sidebarPanel` | `overflow-hidden` (on Panel className) |
| `styles.editorColumn` | `flex flex-col h-full overflow-hidden` |
| `styles.editorArea` | `flex flex-1 overflow-hidden` |

### File to delete after rewrite

- `src/renderer/src/App.module.css` — no longer imported

---

## Task 2.2 — Create `MenuBar` Component (NEW)

### File: `src/renderer/src/components/editor/MenuBar.tsx`

This is a **new component** ported from novapad's `MenuBar.tsx`. It replaces the window-draggable title bar role of the old `TopAppBar` and adds text-based menu dropdowns (File, Edit, Search, View).

### Props interface

```typescript
interface MenuBarProps {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onSaveAll: () => void
  onClose: () => void
  onCloseAll: () => void
  onFind: () => void
  onReplace: () => void
  onFindInFiles: () => void
  onReload: () => void
}
```

### Store connections

- `useUIStore`: `theme`, `toggleTheme`, `showSidebar`, `setShowSidebar`, `showToolbar`, `setShowToolbar`, `showStatusBar`, `setShowStatusBar`
- `useConfigStore`: `setProp` (for persisting theme)

### Key behaviors

1. **Window dragging**: The entire menu bar is draggable via `-webkit-app-region: drag`. Interactive elements (buttons, dropdowns) must set `-webkit-app-region: no-drag`
2. **macOS traffic light spacer**: When `window.api.platform === 'darwin'`, render a 78px spacer on the left for the traffic light buttons
3. **Dropdown menus**: Click-to-open state machine (click button opens menu, click same button or outside closes, hovering another menu button while one is open switches to that menu). Port novapad's `useState` + `useRef` + `useEffect` approach
4. **Menu items**: Each item has label, optional icon, optional keyboard shortcut display, and action callback. Separator items render an `<hr />`

### Menu structure

```
File:
  New File           Ctrl+N       → onNew
  Open File...       Ctrl+O       → onOpen
  Save               Ctrl+S       → onSave
  Save As...         Ctrl+Shift+S → onSaveAs
  Save All           Ctrl+Alt+S   → onSaveAll
  ─────────────
  Reload from Disk                → onReload
  ─────────────
  Close File         Ctrl+W       → onClose
  Close All Files                 → onCloseAll

Edit:
  Undo               Ctrl+Z       → window.dispatchEvent('editor:undo')
  Redo               Ctrl+Y       → window.dispatchEvent('editor:redo')
  ─────────────
  Cut                Ctrl+X       → document.execCommand('cut')
  Copy               Ctrl+C       → document.execCommand('copy')
  Paste              Ctrl+V       → document.execCommand('paste')

Search:
  Find...            Ctrl+F       → onFind
  Replace...         Ctrl+H       → onReplace
  Find in Files...   Ctrl+Shift+F → onFindInFiles

View:
  Toggle Toolbar                  → setShowToolbar(!showToolbar)
  Toggle Status Bar               → setShowStatusBar(!showStatusBar)
  Toggle Sidebar                  → setShowSidebar(!showSidebar)
  ─────────────
  Toggle Theme                    → toggleTheme() + configStore.setProp('theme', ...)
```

### Tailwind classes (from novapad)

```
Container:  h-8 bg-toolbar border-b border-toolbar-border flex items-center px-1 select-none shrink-0
            style={{ WebkitAppRegion: 'drag' }}

Mac spacer: w-[78px] h-full shrink-0

App icon:   flex items-center gap-1.5 px-2 mr-1 [app-region:no-drag]
            Logo box: w-4 h-4 rounded-sm bg-primary flex items-center justify-center
            Logo text: text-xs font-semibold text-toolbar-foreground tracking-tight

Menu btn:   px-2.5 py-1 text-[11px] text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors
            [app-region:no-drag]

Dropdown:   absolute top-full left-0 mt-0.5 min-w-[220px] bg-popover border border-border rounded-md shadow-lg py-1 z-50

Menu item:  w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-popover-foreground hover:bg-secondary transition-colors

Separator:  border-t border-border my-1 mx-2

Shortcut:   ml-auto text-[10px] text-muted-foreground

Right icons: flex items-center gap-0.5 ml-auto mr-1 [app-region:no-drag]
Icon btn:   p-1.5 text-toolbar-foreground hover:bg-secondary rounded-sm transition-colors
```

### Click-outside dismiss

```typescript
// Close dropdown when clicking outside
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpenMenu(null)
    }
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [])
```

### Keyboard shortcut display note

The shortcut labels in the menu are **display-only** (e.g., "Ctrl+N"). The actual keyboard shortcuts are handled by the native Electron menu in the main process. The renderer menu is purely visual.

---

## Task 2.3 — Rewrite `Toolbar` Component

### File: `src/renderer/src/components/editor/Toolbar.tsx` (NEW file in new location)

The old `TopAppBar` is replaced by this component. Port from novapad's `Toolbar.tsx` design — a compact icon-button bar with grouped actions separated by vertical dividers.

### Props interface

```typescript
interface ToolbarProps {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAll: () => void
  onFind: () => void
  onReplace: () => void
  onClose: () => void
}
```

### Store connections

None — stateless component, all callbacks passed from `App.tsx`.

### Button groups (from novapad)

```
Group 1 — File:    New (FilePlus), Open (FolderOpen), Save (Save), Save All (SaveAll), Close (FileX)
  |  divider
Group 2 — Edit:    Undo (Undo2), Redo (Redo2)
  |  divider
Group 3 — Clipboard: Cut (Scissors), Copy (Copy), Paste (Clipboard)
  |  divider
Group 4 — Search:  Find (Search), Replace (Replace)
  |  divider
Group 5 — Zoom:    Zoom In (ZoomIn), Zoom Out (ZoomOut), Reset Zoom (RotateCcw)
  |  divider
Group 6 — Format:  Indent (IndentIncrease), Outdent (IndentDecrease), Comment (MessageSquare)
  |  divider
Group 7 — Actions: Sort Lines (ArrowUpDown), Trim Whitespace (Eraser)
```

### Action mapping

| Button | Action |
|--------|--------|
| New | `onNew()` |
| Open | `onOpen()` |
| Save | `onSave()` |
| Save All | `onSaveAll()` |
| Close | `onClose()` |
| Undo | `window.dispatchEvent(new CustomEvent('editor:undo'))` |
| Redo | `window.dispatchEvent(new CustomEvent('editor:redo'))` |
| Cut | `document.execCommand('cut')` |
| Copy | `document.execCommand('copy')` |
| Paste | `document.execCommand('paste')` |
| Find | `onFind()` |
| Replace | `onReplace()` |
| Zoom In | `window.api.send('editor:command', 'zoomIn')` |
| Zoom Out | `window.api.send('editor:command', 'zoomOut')` |
| Reset Zoom | `window.api.send('editor:command', 'zoomReset')` |
| Indent | `window.api.send('editor:command', 'indentLines')` |
| Outdent | `window.api.send('editor:command', 'outdentLines')` |
| Comment | `window.api.send('editor:command', 'toggleComment')` |
| Sort Lines | `window.api.send('editor:command', 'sortLinesAsc')` |
| Trim | `window.api.send('editor:command', 'trimTrailingWhitespace')` |

**Note on editor commands**: Toolbar buttons that trigger editor commands (Zoom, Indent, Comment, Sort, Trim) must dispatch through the same channel the menu uses. The `EditorPane` listens on `editor:command` IPC. For toolbar buttons, dispatch via `window.dispatchEvent(new CustomEvent('editor:command', { detail: 'commandName' }))` or directly call `editorRegistry.get()?.trigger('source', 'actionId')`. Check how the existing `TopAppBar` dispatches undo/redo (it uses custom events) and follow the same pattern.

### Tailwind classes (from novapad)

```
Container:  h-[30px] bg-toolbar border-b border-toolbar-border flex items-center px-1.5 gap-0.5 select-none shrink-0 overflow-x-auto

Group:      flex items-center

Divider:    w-px h-4 bg-toolbar-border mx-1 shrink-0

Button:     w-[26px] h-[22px] flex items-center justify-center text-toolbar-foreground
            hover:bg-secondary active:bg-muted rounded-sm transition-colors shrink-0

Icon size:  14px (size={14} on all Lucide icons)
```

### Tooltip

Use Shadcn Tooltip for button hover hints:

```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger asChild>
      <button className="..." onClick={action}>
        <Icon size={14} />
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="text-xs">
      {title}
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Files to delete

- `src/renderer/src/components/TopAppBar/TopAppBar.tsx`
- `src/renderer/src/components/TopAppBar/TopAppBar.module.css`
- `src/renderer/src/components/ToolBar/ToolBar.tsx` (legacy, not currently rendered)
- `src/renderer/src/components/ToolBar/ToolBar.module.css`

---

## Task 2.4 — Rewrite `TabBar`

### File: `src/renderer/src/components/TabBar/TabBar.tsx` (modify in-place)

### What changes

- Remove `import styles from './TabBar.module.css'` — replace with Tailwind classes
- Replace custom context menu div with Radix `ContextMenu`
- Replace custom `Tooltip` with Shadcn `Tooltip`
- Add scroll arrow buttons (left/right chevrons) from novapad design
- Add active tab indicator (blue top line via `bg-primary`) from novapad
- Add file type icons from Lucide (optional — can defer to Phase 3)
- Add mousewheel horizontal scroll support
- Add middle-click to close

### What stays identical

- `useEditorStore` connection (buffers, activeId, setActive, removeBuffer)
- Drag-reorder logic (dragRef, dragOverRef, handleDrop with splice)
- Context menu actions (Close, Close Others, Close All, Copy Path, Reveal in Explorer)
- `data-testid` attributes
- `data-tab-title`, `data-tab-dirty` attributes

### Store connections (unchanged)

- `useEditorStore`: `buffers`, `activeId`, `setActive`, `removeBuffer`

### New local state

```typescript
const [canScrollLeft, setCanScrollLeft] = useState(false)
const [canScrollRight, setCanScrollRight] = useState(false)
const scrollRef = useRef<HTMLDivElement>(null)
```

### Scroll logic (from novapad)

```typescript
const checkScroll = useCallback(() => {
  const el = scrollRef.current
  if (!el) return
  setCanScrollLeft(el.scrollLeft > 0)
  setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
}, [])

useEffect(() => {
  checkScroll()
  const el = scrollRef.current
  if (!el) return
  el.addEventListener('scroll', checkScroll)
  const ro = new ResizeObserver(checkScroll)
  ro.observe(el)
  return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
}, [buffers.length, checkScroll])

// Mouse wheel → horizontal scroll
const handleWheel = (e: React.WheelEvent) => {
  if (scrollRef.current) scrollRef.current.scrollLeft += e.deltaY
}

// Scroll active tab into view
useEffect(() => {
  if (!activeId || !scrollRef.current) return
  const tab = scrollRef.current.querySelector(`[data-tab-id="${activeId}"]`) as HTMLElement
  tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
}, [activeId])
```

### Target JSX structure

```tsx
import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'

// ...

if (buffers.length === 0) return null

return (
  <div className="h-[34px] bg-tab-inactive border-b border-border flex items-stretch select-none shrink-0 relative" data-testid="tabbar">
    {/* Left scroll arrow */}
    {canScrollLeft && (
      <button
        className="absolute left-0 z-10 h-full px-1 bg-tab-inactive/90 backdrop-blur-sm border-r border-border text-tab-muted hover:text-tab-foreground"
        onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
      >
        <ChevronLeft size={14} />
      </button>
    )}

    {/* Scrollable tab container */}
    <div
      ref={scrollRef}
      className="flex-1 flex items-stretch overflow-x-hidden"
      onWheel={handleWheel}
    >
      {buffers.map((buf) => (
        <ContextMenu key={buf.id}>
          <ContextMenuTrigger asChild>
            <div
              data-tab-id={buf.id}
              data-tab-title={buf.title}
              data-tab-dirty={buf.isDirty ? 'true' : 'false'}
              className={cn(
                'group relative flex items-center gap-1.5 pl-3 pr-2 cursor-pointer text-[11px] min-w-0 shrink-0 transition-colors border-r border-border',
                buf.id === activeId
                  ? 'bg-tab-active text-tab-foreground'
                  : 'bg-tab-inactive text-tab-muted hover:bg-tab-hover',
                !buf.loaded && 'opacity-55',
                buf.missing && 'line-through opacity-50'
              )}
              onClick={() => setActive(buf.id)}
              onAuxClick={(e) => { if (e.button === 1) onClose?.(buf.id) }}
              draggable
              onDragStart={() => handleDragStart(buf.id)}
              onDragOver={(e) => handleDragOver(e, buf.id)}
              onDrop={handleDrop}
              title={buf.filePath ?? buf.title}
            >
              {/* Active indicator — blue top line */}
              {buf.id === activeId && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
              )}

              {/* Tab title */}
              <span className="truncate">{buf.title}</span>

              {/* Modified dot / Close button */}
              <span className="ml-1 w-4 h-4 flex items-center justify-center shrink-0">
                {buf.isDirty && buf.id !== activeId ? (
                  <span className="w-2 h-2 rounded-full bg-tab-muted" />
                ) : (
                  <button
                    className="opacity-0 group-hover:opacity-100 hover:bg-secondary rounded-sm transition-opacity"
                    onClick={(e) => { e.stopPropagation(); onClose?.(buf.id) }}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={() => onClose?.(buf.id)}>Close</ContextMenuItem>
            <ContextMenuItem onClick={() => closeOthers(buf.id)}>Close Others</ContextMenuItem>
            <ContextMenuItem onClick={() => closeAll()}>Close All</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => copyPath(buf.id)}>Copy File Path</ContextMenuItem>
            <ContextMenuItem onClick={() => revealInExplorer(buf.id)}>Reveal in Explorer</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ))}
    </div>

    {/* Right scroll arrow */}
    {canScrollRight && (
      <button
        className="absolute right-[34px] z-10 h-full px-1 bg-tab-inactive/90 backdrop-blur-sm border-l border-border text-tab-muted hover:text-tab-foreground"
        onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
      >
        <ChevronRight size={14} />
      </button>
    )}

    {/* New file button */}
    <button
      className="w-[34px] flex items-center justify-center text-tab-muted hover:text-tab-foreground hover:bg-tab-hover transition-colors shrink-0 border-l border-border"
      onClick={() => onNewFile?.()}
      title="New file"
      data-testid="tabbar-new-btn"
    >
      <Plus size={14} />
    </button>
  </div>
)
```

### CSS Module → Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.tabBar` | `h-[34px] bg-tab-inactive border-b border-border flex items-stretch select-none shrink-0 relative` |
| `styles.tab` | `group relative flex items-center gap-1.5 pl-3 pr-2 cursor-pointer text-[11px] min-w-0 shrink-0 transition-colors border-r border-border` |
| `styles.tab.active` | `bg-tab-active text-tab-foreground` + absolute `h-[2px] bg-primary` top indicator |
| `styles.tab:hover` | `hover:bg-tab-hover` |
| `styles.ghost` | `opacity-55` |
| `styles.missing .title` | `line-through opacity-50` |
| `styles.dirtyDot` | `w-2 h-2 rounded-full bg-tab-muted` |
| `styles.title` | `truncate` |
| `styles.closeBtn` | `opacity-0 group-hover:opacity-100 hover:bg-secondary rounded-sm transition-opacity` |
| `styles.tabFiller` | Replaced by explicit `<Plus>` button |
| `styles.contextMenu` | Replaced by Radix `ContextMenu` |

### File to delete

- `src/renderer/src/components/TabBar/TabBar.module.css`

---

## Task 2.5 — Restyle `EditorPane`

### File: `src/renderer/src/components/EditorPane/EditorPane.tsx` (modify in-place)

### What changes — minimal

- Remove `import styles from './EditorPane.module.css'`
- Replace `styles.container`, `styles.editor`, `styles.overlay` with Tailwind classes

### What stays identical — everything else

- All Monaco editor creation, configuration, and lifecycle
- All IPC handlers (`editor:command`, `editor:set-eol`, `editor:set-encoding`, etc.)
- Ghost/lazy buffer handling
- Large file mode
- Bookmark and macro recording hooks
- `editorRegistry` usage

### Tailwind replacements

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.container` | `flex flex-col flex-1 h-full overflow-hidden relative` |
| `styles.editor` | `flex-1 h-full w-full` |
| `styles.overlay` | `absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-background pointer-events-none z-[1]` |

### File to delete

- `src/renderer/src/components/EditorPane/EditorPane.module.css`

---

## Task 2.6 — Rewrite `StatusBar`

### File: `src/renderer/src/components/StatusBar/StatusBar.tsx` (modify in-place)

### What changes

- Remove `import styles from './StatusBar.module.css'`
- Replace all CSS module classes with Tailwind
- Adopt novapad's compact 24px height (`h-6`) and colored background
- Remove custom `statusDot` — novapad doesn't have this (or keep it as a subtle accent marker)

### What stays identical

- `useEditorStore.getActive()` connection
- `useUIStore.isRecording` connection
- Cursor position tracking via `editor:cursor` custom event
- `cycleEOL()` and `cycleEncoding()` callbacks
- EOL and encoding cycle arrays

### Target JSX

```tsx
import { cn } from '@/lib/utils'

return (
  <div className="h-6 bg-statusbar text-statusbar-foreground flex items-center px-2 text-[11px] select-none shrink-0" data-testid="statusbar">
    {/* Left section */}
    <div className="flex items-center gap-3">
      <span data-testid="cursor-position" className="flex items-center gap-1">
        Ln {cursor.line}, Col {cursor.col}
      </span>
    </div>

    {/* Spacer */}
    <div className="flex-1" />

    {/* Right section */}
    <div className="flex items-center gap-4">
      {isRecording && (
        <span className="text-destructive font-semibold tracking-wider animate-pulse">
          REC
        </span>
      )}

      <span
        className="cursor-pointer hover:underline decoration-dotted"
        onClick={cycleEOL}
        title="Click to cycle EOL type"
      >
        {buf?.eol ?? 'LF'}
      </span>

      <span
        className="cursor-pointer hover:underline decoration-dotted"
        onClick={cycleEncoding}
        title="Click to cycle encoding"
      >
        {buf?.encoding ?? 'UTF-8'}
      </span>

      <span>{buf?.language ?? 'Plain Text'}</span>

      <span className="opacity-70">
        {buf?.isDirty ? 'Modified' : buf?.filePath ? 'Saved' : 'New File'}
      </span>
    </div>
  </div>
)
```

### CSS Module → Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.statusBar` | `h-6 bg-statusbar text-statusbar-foreground flex items-center px-2 text-[11px] select-none shrink-0` |
| `styles.statusDot` | Removed (novapad doesn't use it) |
| `styles.section` | Inline on each span |
| `styles.divider` | Removed — use `gap-4` between items instead |
| `styles.spacer` | `flex-1` |
| `styles.clickable` | `cursor-pointer hover:underline decoration-dotted` |
| `styles.recording` + `@keyframes blink` | `text-destructive font-semibold tracking-wider animate-pulse` |

### File to delete

- `src/renderer/src/components/StatusBar/StatusBar.module.css`

---

## Task 2.7 — Restyle `SideNav`

### File: `src/renderer/src/components/SideNav/SideNav.tsx` (modify in-place)

### What changes

- Remove `import styles from './SideNav.module.css'`
- Replace custom `Tooltip` with Shadcn `Tooltip`
- Replace all CSS module classes with Tailwind

### What stays identical

- `useUIStore` connections (sidebarPanel, showSidebar, setSidebarPanel, setShowSidebar, openFind, setShowPreferences, setShowPluginManager)
- `handleNav()` logic (sidebar panel switching, search/preferences/plugins routing)
- `isActive()` check
- NAV_ITEMS and PANEL_IDS definitions

### Target JSX

```tsx
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ... keep NAV_ITEMS, PANEL_IDS, handleNav, isActive ...

return (
  <nav className="flex flex-col w-12 h-full bg-sidebar border-r border-sidebar-border shrink-0 select-none overflow-hidden" data-testid="sidenav">
    <div className="flex flex-col flex-1 gap-0.5 py-1 min-h-0">
      <TooltipProvider delayDuration={300}>
        {NAV_ITEMS.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex flex-col items-center justify-center w-full min-h-[44px] py-2',
                  'border-l-2 border-transparent',
                  'text-muted-foreground transition-colors',
                  'hover:text-foreground hover:bg-sidebar-accent',
                  isActive(item.id) && 'text-primary bg-sidebar-accent border-l-primary'
                )}
                onClick={() => handleNav(item.id)}
              >
                {item.icon}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{item.tip}</TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>

    <div className="shrink-0 flex flex-col mt-auto pb-2 gap-0.5">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center justify-center w-full min-h-[44px] py-2 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              onClick={() => handleNav('preferences')}
            >
              <Settings size={20} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Preferences</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </nav>
)
```

### CSS Module → Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.sidenav` | `flex flex-col w-12 h-full bg-sidebar border-r border-sidebar-border shrink-0 select-none overflow-hidden` |
| `styles.navList` | `flex flex-col flex-1 gap-0.5 py-1 min-h-0` |
| `styles.navFooter` | `shrink-0 flex flex-col mt-auto pb-2 gap-0.5` |
| `styles.navBtn` | `flex flex-col items-center justify-center w-full min-h-[44px] py-2 border-l-2 border-transparent text-muted-foreground transition-colors` |
| `styles.navBtn:hover` | `hover:text-foreground hover:bg-sidebar-accent` |
| `styles.navBtn.active` | `text-primary bg-sidebar-accent border-l-primary` |

### File to delete

- `src/renderer/src/components/SideNav/SideNav.module.css`

---

## Task 2.8 — Restyle `Sidebar` Container

### File: `src/renderer/src/components/Sidebar/Sidebar.tsx` (modify in-place)

### What changes

- Remove `import styles from './Sidebar.module.css'`
- Replace custom `Tooltip` with Shadcn `Tooltip`
- Replace all CSS module classes with Tailwind

### What stays identical

- `useUIStore` connection (sidebarPanel, setShowSidebar)
- Panel component mapping (FileBrowserPanel, ProjectPanel, DocumentMapPanel, FunctionListPanel)
- PANEL_TITLES definition

### Target JSX

```tsx
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

return (
  <div className="flex flex-col h-full bg-explorer overflow-hidden" data-testid="sidebar">
    <div className="flex items-center h-9 px-3 border-b border-border shrink-0">
      <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {PANEL_TITLES[sidebarPanel]}
      </span>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="w-[22px] h-[22px] flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              onClick={() => setShowSidebar(false)}
            >
              <X size={12} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close Sidebar</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
    <div className="flex-1 overflow-hidden flex flex-col">
      {panels[sidebarPanel]}
    </div>
  </div>
)
```

### CSS Module → Tailwind mapping

| CSS Module class | Tailwind replacement |
|------------------|---------------------|
| `styles.sidebar` | `flex flex-col h-full bg-explorer overflow-hidden` |
| `styles.header` | `flex items-center h-9 px-3 border-b border-border shrink-0` |
| `styles.headerTitle` | `flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground` |
| `styles.closeBtn` | `w-[22px] h-[22px] flex items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors` |
| `styles.panelContent` | `flex-1 overflow-hidden flex flex-col` |

### File to delete

- `src/renderer/src/components/Sidebar/Sidebar.module.css`

---

## Task 2.9 — Remove Custom `Tooltip` Component

### Why

All Phase 2 components now use Shadcn/Radix `Tooltip` instead of the custom `Tooltip` component. However, Phase 3/4 components still use the old Tooltip. So:

- **Do NOT delete** the custom Tooltip yet (Phase 3/4 still depend on it)
- Verify no Phase 2 component imports from `../Tooltip/Tooltip`
- The custom Tooltip will be deleted in Phase 6 (Cleanup) after all components are migrated

### What to check

Grep for `from '../Tooltip/Tooltip'` or `from '../../Tooltip/Tooltip'` in all Phase 2 files and confirm zero matches.

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/renderer/src/components/editor/MenuBar.tsx` | New Radix-style menubar with File/Edit/Search/View dropdowns |
| `src/renderer/src/components/editor/Toolbar.tsx` | New icon toolbar replacing TopAppBar |

## Modified Files Summary

| File | Key changes |
|------|-------------|
| `src/renderer/src/App.tsx` | CSS modules → Tailwind, import MenuBar+Toolbar instead of TopAppBar, theme effect toggle `.dark` class |
| `src/renderer/src/components/TabBar/TabBar.tsx` | CSS modules → Tailwind, Radix ContextMenu, scroll arrows, blue active indicator |
| `src/renderer/src/components/EditorPane/EditorPane.tsx` | CSS modules → Tailwind (3 classes only) |
| `src/renderer/src/components/StatusBar/StatusBar.tsx` | CSS modules → Tailwind, compact 24px height |
| `src/renderer/src/components/SideNav/SideNav.tsx` | CSS modules → Tailwind, Shadcn Tooltip |
| `src/renderer/src/components/Sidebar/Sidebar.tsx` | CSS modules → Tailwind, Shadcn Tooltip |

## Deleted Files Summary

| File | Replaced by |
|------|-------------|
| `src/renderer/src/App.module.css` | Inline Tailwind classes in App.tsx |
| `src/renderer/src/components/TopAppBar/TopAppBar.tsx` | `components/editor/MenuBar.tsx` + `components/editor/Toolbar.tsx` |
| `src/renderer/src/components/TopAppBar/TopAppBar.module.css` | Tailwind classes |
| `src/renderer/src/components/ToolBar/ToolBar.tsx` | `components/editor/Toolbar.tsx` |
| `src/renderer/src/components/ToolBar/ToolBar.module.css` | Tailwind classes |
| `src/renderer/src/components/TabBar/TabBar.module.css` | Tailwind classes |
| `src/renderer/src/components/EditorPane/EditorPane.module.css` | Tailwind classes |
| `src/renderer/src/components/StatusBar/StatusBar.module.css` | Tailwind classes |
| `src/renderer/src/components/SideNav/SideNav.module.css` | Tailwind classes |
| `src/renderer/src/components/Sidebar/Sidebar.module.css` | Tailwind classes |

---

## Execution Order

Tasks can be partially parallelized:

```
2.2 MenuBar (new)  ──┐
2.3 Toolbar (new)  ──┤
                      ├──▶  2.1 App.tsx (depends on MenuBar + Toolbar existing)
2.5 EditorPane     ──┘         │
2.4 TabBar         ────────────┤  (can be done in parallel with App.tsx)
2.6 StatusBar      ────────────┤
2.7 SideNav        ────────────┤
2.8 Sidebar        ────────────┘
                      │
                      ▼
                   2.9 Tooltip audit
```

**Recommended sequential order for single implementer:**

1. **2.5 EditorPane** — smallest change, quick win, verifies Tailwind co-existence works on the most critical component
2. **2.2 MenuBar** — new component, no risk of breaking existing code
3. **2.3 Toolbar** — new component, no risk of breaking existing code
4. **2.1 App.tsx** — swap TopAppBar for MenuBar + Toolbar, convert layout classes
5. **2.7 SideNav** — simple restyle
6. **2.8 Sidebar** — simple restyle
7. **2.4 TabBar** — most complex rewrite (scroll logic, context menu, drag-reorder)
8. **2.6 StatusBar** — simple restyle
9. **2.9 Tooltip audit** — verification pass

---

## Verification Checklist

| Check | How to verify |
|-------|---------------|
| App launches | `npm run dev` opens window, no white screen |
| App builds | `npm run build` exits 0 |
| Menu bar renders | File/Edit/Search/View menus open and close |
| Menu actions work | File > New creates tab, File > Open opens dialog, etc. |
| Toolbar renders | Icon buttons visible in compact bar below menu |
| Toolbar actions | Undo/Redo/Find buttons trigger correct actions |
| Tabs work | Click to switch, drag to reorder, X to close |
| Tab scroll | When many tabs, scroll arrows appear, mouse wheel scrolls |
| Tab context menu | Right-click shows Close/Close Others/Close All/Copy Path/Reveal |
| Active tab indicator | Blue 2px line on top of active tab |
| Ghost tabs | Unloaded tabs show at reduced opacity |
| Editor renders | Monaco editor loads content correctly |
| Status bar | Shows Ln/Col, EOL, Encoding, Language, Modified state |
| Status bar clicks | EOL and encoding cycle on click |
| Recording indicator | Start macro recording → "REC" shows in status bar |
| SideNav works | Click Files icon opens sidebar, click again closes |
| SideNav active state | Active panel shows blue left border + accent bg |
| Sidebar header | Shows panel title, close button works |
| Resize handles | Horizontal (sidebar) and vertical (bottom panel) resize handles work, turn blue on hover/drag |
| Theme toggle | View > Toggle Theme switches light/dark correctly |
| Window dragging | Drag on menu bar area moves window (macOS/Windows) |
| Traffic lights | macOS: window buttons don't overlap menu bar |
| Session restore | Close and reopen app — tabs restored correctly |
| File watching | Edit file externally → toast notification appears |
| Dialogs still work | Preferences, About, Plugin Manager, etc. still open correctly |
| E2E tests | `npm run test:e2e` — expect some selector failures (documented for Phase 6) |

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| `-webkit-app-region: drag` in Tailwind | Window not draggable | Use inline `style={{ WebkitAppRegion: 'drag' }}` — Tailwind arbitrary properties don't work reliably for webkit prefixes |
| Radix ContextMenu portal z-index | Context menu behind Monaco | Shadcn ContextMenu renders in a portal with `z-50`. If Monaco overlay is higher, increase to `z-[9999]` |
| Scroll arrows flicker | Poor UX | Debounce the scroll check with `requestAnimationFrame` |
| Drag-reorder + Radix ContextMenu conflict | Drag triggers context menu | Radix ContextMenu only triggers on `contextmenu` event (right-click), not on drag. Should be fine. Test thoroughly |
| Monaco editor theme mismatch | Editor is light, chrome is dark | Keep existing `monaco.editor.setTheme('vs-dark' | 'vs')` logic in EditorPane. It reads from `uiStore.theme` |
| Old Tooltip imports in non-Phase-2 components | Build error if deleted | Do NOT delete custom Tooltip in Phase 2. It's used by Phase 3/4 components. Remove in Phase 6 |

---

## Execution Checklist

```
[x] 2.5  EditorPane: replace 3 CSS module classes with Tailwind
[x] 2.2  Create MenuBar component (new file)
[x] 2.3  Create Toolbar component (new file)
[x] 2.1  App.tsx: swap TopAppBar → MenuBar+Toolbar, Tailwind layout, theme effect
[x] 2.7  SideNav: CSS modules → Tailwind + Shadcn Tooltip
[x] 2.8  Sidebar: CSS modules → Tailwind + Shadcn Tooltip
[x] 2.4  TabBar: CSS modules → Tailwind, scroll arrows, Radix ContextMenu
[x] 2.6  StatusBar: CSS modules → Tailwind, compact 24px
[x] 2.9  Verify: no Phase 2 component imports custom Tooltip
[x] ---  Delete: App.module.css, TopAppBar/*, ToolBar/*, TabBar.module.css, EditorPane.module.css, StatusBar.module.css, SideNav.module.css, Sidebar.module.css
[x] ---  Verify: npm run build && npm run dev — no regressions
```

---

## Implementation Output

**Completed:** 2026-04-10

### Deviations from spec

| Spec | Actual | Reason |
|------|--------|--------|
| `@/` import paths for Shadcn components | Relative imports (`../../lib/utils`, `../ui/tooltip`) | electron-vite 3.x does not resolve the `@/` alias at build time despite it being configured in `electron-vite.config.ts`. The `@/` alias worked for TypeScript intellisense (via `tsconfig.web.json` paths) but Vite/Rollup could not resolve it. Converted all 48 files to relative imports |
| `electron-vite.config.ts` alias: `'@': resolve('src/renderer/src')` | Removed `@` alias, kept only `@renderer` | Since all imports now use relative paths, the `@` alias is unnecessary. Avoids confusion with `@`-scoped npm packages |

### Build verification

| Check | Result |
|-------|--------|
| `npm run build` | Pass — 2918 modules transformed, zero errors |
| Renderer CSS output | `index-BMLQ94UJ.css` — 371.27 kB (Tailwind classes now actively used) |
| Radix UI bundled | `@radix-ui/react-tooltip` and `@radix-ui/react-context-menu` included (benign "use client" notices) |
| Old CSS module co-existence | Remaining `.module.css` files (Phase 3/4 components) still compile correctly |
