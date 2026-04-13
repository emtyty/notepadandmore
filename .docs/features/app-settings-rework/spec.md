# Specification: App Settings Rework

## 1. Scope

This feature affects:
- **Main process** (`src/main/`): Updates the native menu (`menu.ts`) to drop the `Settings` top-level and add `Settings…` under the macOS App menu. `SessionManager` gains support for virtual tabs.
- **Preload** (`src/preload/index.ts`): Adds two new allowed renderer IPC channels (`menu:settings-open`, `menu:shortcuts-open`); removes two obsolete channels (`menu:udl-editor`, `menu:style-configurator`).
- **Renderer** (`src/renderer/src/`): Extends the `Buffer` model with a `kind` discriminator; rewrites `MenuBar.tsx` (gear icon + dropdown, drop Settings top-menu and two right icons); adds a `SettingsTab` view rendered by `EditorPane` for virtual tabs; adds a `virtualBuffers` helper on `editorStore`; deletes `PreferencesDialog.tsx`.
- **CLI**: No changes.

> See [PRD](./prd.md) for user stories and business requirements.

---

## 2. Data Shapes

### 2.1. Buffer model — add `kind` discriminator

`src/renderer/src/store/editorStore.ts` — extend `Buffer`:

```typescript
export type BufferKind = 'file' | 'settings' | 'shortcuts'

export interface Buffer {
  id: string
  kind: BufferKind                 // NEW — default 'file'
  filePath: string | null          // always null for 'settings' | 'shortcuts'
  title: string
  content: string
  isDirty: boolean                 // always false for virtual tabs
  encoding: string
  eol: EOLType
  language: string
  mtime: number
  viewState: monaco.editor.ICodeEditorViewState | null
  savedViewState: object | null
  model: monaco.editor.ITextModel | null
  bookmarks: number[]
  loaded: boolean
  missing: boolean
  isLargeFile: boolean
}
```

### 2.2. New editorStore selectors / actions

| Name | Shape | Description |
|------|-------|-------------|
| `openVirtualTab(kind)` | `(kind: 'settings' \| 'shortcuts') => string` | Focuses the existing virtual tab of this kind if present; otherwise creates one and returns its id. |
| `findVirtualBuffer(kind)` | `(kind: BufferKind) => Buffer \| null` | Lookup helper used by UI entry points. |

Implementation notes (informative, not contract):
- Virtual tabs skip Monaco model creation; `model` stays `null`.
- `removeBuffer` is reused for close; no special path needed.

### 2.3. Session schema — bump to v3

`src/main/sessions/SessionManager.ts`:

```typescript
interface SessionVirtualTab {
  kind: 'settings' | 'shortcuts'
}

interface Session {
  version: 3                       // was 2
  files: SessionFile[]             // unchanged — file tabs only
  virtualTabs: SessionVirtualTab[] // NEW — ordered, at most one per kind
  activeIndex: number              // index into the merged [virtualTabs ++ files] order; see 2.4
  workspaceFolder?: string
}
```

Migration:
- v1 → v2 behavior preserved.
- v2 → v3: `virtualTabs = []`, `activeIndex` unchanged (still indexes into `files`).

### 2.4. Session order & `activeIndex` semantics

`activeIndex` refers to the **flat ordered list** as serialized. The renderer must reconstruct the TabBar order as:

```
order = [ ...virtualTabs (in declared order), ...files (in declared order) ]
```

`activeIndex` is an index into `order`. Reorder performed by the user in the TabBar is persisted by re-emitting `session:save` with `virtualTabs` / `files` arranged to match the live tab order (virtual tabs may appear anywhere — see BR in §8).

> **Note on reorder across kinds.** Because v3 still keeps `virtualTabs` and `files` as separate arrays, to round-trip a user-chosen interleaving the renderer must serialize tabs in a single ordered list at save time. Option: introduce `Session.tabs: Array<{ kind: 'file', ... } | { kind: 'settings' | 'shortcuts' }>` instead of two arrays. **Decision deferred to implementation** — see [Open Questions](#9-open-questions).

---

## 3. IPC Channels (Main ↔ Renderer)

### 3.1. New channels (main → renderer)

| Direction | Channel | Payload | Description |
|-----------|---------|---------|-------------|
| Main → Renderer | `menu:settings-open` | *(none)* | Fired by native macOS `App → Settings…` menu and by `Cmd+,` accelerator. Renderer opens / focuses the Settings virtual tab. |
| Main → Renderer | `menu:shortcuts-open` | *(none)* | Reserved for future; fired by a Keyboard Shortcuts native menu entry if one is added. Not wired from menu in v1 — the gear dropdown dispatches this directly in-renderer as a local event. |

### 3.2. Removed channels

| Channel | Reason |
|---------|--------|
| `menu:preferences` | Replaced by `menu:settings-open`. Remove from preload allowlist and main-side emitters. |
| `menu:udl-editor` | UI surface removed (BR-006). |
| `menu:style-configurator` | UI surface removed (BR-006). |
| `menu:shortcut-mapper` | Renamed semantically; no native menu trigger in v1. Remove from allowlist. |

### 3.3. Updated preload allowlist

`src/preload/index.ts` `allowedChannels` (both `on` and `off` arrays):
- **Add**: `'menu:settings-open'`, `'menu:shortcuts-open'`.
- **Remove**: `'menu:preferences'`, `'menu:shortcut-mapper'`, `'menu:udl-editor'`, `'menu:style-configurator'`.

No additions to `send` allowlist.

### 3.4. `window.api` surface

No additions to `window.api` — the feature reuses the existing generic `window.api.on(channel, cb)` / `off(channel)` pattern.

---

## 4. Native Menu Contract

`src/main/menu.ts`:

### 4.1. macOS App menu

The App menu gains `Settings…` inserted after `About`, before the first separator:

| Position | Item | Accelerator | Action |
|----------|------|-------------|--------|
| 1 | About | — | `role: 'about'` |
| 2 | **Settings…** *(new)* | `Cmd+,` | `win.webContents.send('menu:settings-open')` |
| 3 | separator | — | — |
| 4+ | Services, Hide, HideOthers, Unhide, separator, Quit | — | roles |

### 4.2. Removed

- The entire top-level `Settings` menu (currently lines 304–335) is deleted from the template on **all platforms**.
- No replacement `Settings` top-level is added anywhere.

### 4.3. Windows menu

Windows has no native menu (custom MenuBar renders the menu). `menu.ts` is still built with `Menu.setApplicationMenu` for accelerators; the `Settings` top-level is removed there too. No `Settings…` entry is added elsewhere — Windows users reach Settings via the gear icon or `Ctrl+,`.

### 4.4. Global accelerator behavior

`Cmd/Ctrl+,`:
- **macOS**: accelerator on the `Settings…` menu item fires `menu:settings-open`.
- **Windows**: since there's no menu entry, the accelerator must be registered differently. Use a hidden `MenuItem` with `visible: false, accelerator: 'Ctrl+,'` inside a non-displayed menu section, OR handle via a `before-input-event` listener on the `BrowserWindow`. **Implementation choice** — either is acceptable; the contract is only that `Ctrl+,` fires `menu:settings-open`.

---

## 5. Renderer UI Contract

### 5.1. MenuBar changes (`src/renderer/src/components/editor/MenuBar.tsx`)

**Remove:**
- The `Settings` entry from `topMenus` and from `menuItems`.
- The right-side `Search` icon button.
- The right-side theme toggle icon button.

**Keep:** `Toggle Sidebar` icon (unchanged).

**Add:** A gear icon button (right-side, placed where the old theme toggle lived). Clicking toggles an in-renderer dropdown. The dropdown is a local React state popover, not a native menu.

Dropdown content — fixed order:

| Position | Label | Icon | Action |
|----------|-------|------|--------|
| 1 | `Toggle Dark Mode` / `Toggle Light Mode` (label flips by theme) | Sun/Moon | Calls `uiStore.toggleTheme()` + persists to `configStore`. |
| 2 | *(separator)* | — | — |
| 3 | `Keyboard Shortcuts` | Keyboard | Calls `editorStore.openVirtualTab('shortcuts')`. |
| 4 | `Settings` | Gear (settings) | Calls `editorStore.openVirtualTab('settings')`. |

### 5.2. macOS gear placement

macOS currently early-returns `null` from `MenuBar` (line 49). Choice:
- **(a)** Lift the right-side icon strip out of `MenuBar` into a persistent header so macOS also shows the gear.
- **(b)** Render only the gear strip on macOS and keep the full MenuBar for Windows.

**Contract:** the gear icon and its dropdown **must be visible and functional on both macOS and Windows**. Implementation is free to pick (a) or (b) as long as the gear appears in the title-bar/menubar area on both platforms.

### 5.3. Settings tab view

New component: `src/renderer/src/components/SettingsTab/SettingsTab.tsx` (or similar).

Contract:
- Rendered by `EditorPane` when the active buffer has `kind === 'settings'` (instead of mounting Monaco).
- Renders the same six categories as the current `PreferencesDialog`: General, Editor, Appearance, New Document, Backup/AutoSave, Auto-Completion.
- Every field writes through `useConfigStore.getState().setProp(...)` on change (live save). No local form state that could diverge.
- Never sets `buffer.isDirty = true`.

### 5.4. Keyboard Shortcuts tab view (stub)

New component: `src/renderer/src/components/ShortcutsTab/ShortcutsTab.tsx`.

Contract:
- Rendered by `EditorPane` when `kind === 'shortcuts'`.
- Renders a "Keyboard Shortcuts editor — coming soon" placeholder with a brief description. No interactive controls.
- Follows the same virtual-tab lifecycle rules (singleton, closable, session-restorable).

### 5.5. TabBar contract for virtual tabs

`src/renderer/src/components/TabBar/TabBar.tsx` must handle tabs with `kind !== 'file'`:
- Render the tab's custom icon (gear for `settings`, keyboard for `shortcuts`) in place of the file-type icon.
- Do **not** render a file path tooltip — tooltip shows the tab title only.
- Dirty dot is hidden (buffer will always report `isDirty === false`).
- Drag-reorder works identically to file tabs.
- Right-click context menu: show `Close`, `Close Others`, `Close All` — hide file-specific items (`Reveal in Explorer`, `Copy Path`, etc.).

### 5.6. Removal of `PreferencesDialog`

- Delete `src/renderer/src/components/Dialogs/Preferences/PreferencesDialog.tsx` and its dedicated folder.
- Remove its import and mount-site from `App.tsx`.
- Remove `showPreferences` / `setShowPreferences` from `uiStore` (no replacement needed — tab visibility is driven by buffer presence).
- Any in-renderer callers of `uiStore.getState().setShowPreferences(true)` are retargeted to `editorStore.getState().openVirtualTab('settings')`.

---

## 6. Session Restore Contract

### 6.1. Save path (renderer → main)

`App.tsx` session save payload becomes:

```typescript
window.api.send('session:save', {
  version: 3,
  files: /* same as today, filtered to kind === 'file' with filePath */,
  virtualTabs: /* buffers.filter(b => b.kind !== 'file').map(b => ({ kind: b.kind })) */,
  activeIndex: /* flat index into the serialized order — see §2.4 */,
  workspaceFolder
})
```

### 6.2. Restore path (main → renderer)

`SessionManager.restore` continues to emit `session:restore` with the full `Session` object. Renderer's `restoreSession` hook:
1. Creates virtual buffers via `openVirtualTab(kind)` for each `virtualTabs` entry, in declared order.
2. Loads file ghost-buffers as today.
3. Sets `activeId` to the buffer at `activeIndex` in the merged order.

### 6.3. Backward compatibility

- Loading a v2 session yields `virtualTabs = []` — no virtual tabs restored, existing file restore behavior unchanged.
- Writing always uses v3 going forward.

---

## 7. Business Rules (Technical Enforcement)

| ID | Rule | Enforced By |
|----|------|-------------|
| BR-001 | No Settings top-level menu anywhere | `src/main/menu.ts` template (entry removed); `MenuBar.tsx` `topMenus` (entry removed) |
| BR-002 | At most one virtual tab per kind | `editorStore.openVirtualTab` checks `findVirtualBuffer(kind)` before creating |
| BR-003 | Virtual tabs never dirty | Settings/Shortcuts components never call `updateBuffer({ isDirty: true })`; TabBar hides the dirty dot for `kind !== 'file'` |
| BR-004 | Fixed gear dropdown contents | Dropdown component hard-codes the 4-entry structure (theme · sep · Shortcuts · Settings) |
| BR-005 | macOS `Settings…` under App menu with `Cmd+,` | `menu.ts` adds the item only when `process.platform === 'darwin'` |
| BR-006 | Removed UI surfaces deleted | `MenuBar.tsx` no longer imports `Search` icon; `PreferencesDialog` folder deleted; UDL/Style menu entries removed from `menu.ts` and `MenuBar.tsx` |
| BR-007 | Platform scope (macOS + Windows) | No Linux-specific code paths are added; existing Linux branches of `menu.ts` retain the same removals (Settings top-level still dropped on Linux since the menu template is platform-shared), but the gear icon and its wiring are only QA-validated on macOS and Windows |

---

## 8. Validation & Error Handling

| Rule | Behavior |
|------|----------|
| `openVirtualTab('settings')` called while tab exists | No-op creation; `setActive(existingId)` is called instead. Returns existing id. |
| Session contains unknown virtual-tab `kind` | Skip that entry silently during restore; log a warning in dev mode. |
| Session v3 with malformed `virtualTabs` (non-array) | Treat as empty array; continue restore with file tabs only. |
| Renderer receives `menu:settings-open` before React has mounted | `App.tsx`'s `session:restore` listener is already attached on `did-finish-load`; attach `menu:settings-open` in the same effect so the first-click-on-menu race is covered. |

---

## 9. Open Questions

1. **Session tab-order representation.** Keep `virtualTabs` + `files` as separate arrays (simpler migration, forces virtual tabs to be grouped), or introduce a unified `Session.tabs` array (preserves arbitrary interleaving after user reorder)? Current draft keeps them separate; flag for implementation review if drag-reorder across kinds must round-trip.
2. **`Ctrl+,` on Windows** — via hidden menu item with accelerator, or `before-input-event`? Either satisfies the contract; pick during implementation.
3. **macOS gear placement** — lift the right-icon strip into a persistent header, or render a mini-strip above the TabBar when the full MenuBar is hidden? Contract requires gear visible on macOS; shape of the host component is implementation-defined.
