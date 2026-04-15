# Specification: Plugin Manager Page

## 1. Scope

This feature affects:

- **Main process** (`src/main/`): `PluginLoader` gains granular per-plugin lifecycle methods (load/unload/reload) and extended metadata reading (README, changelog). New IPC handlers for enable, disable, install, uninstall, and detail queries. `SessionManager` gains support for `pluginManager` and `pluginDetail` virtual tab kinds.
- **Preload** (`src/preload/index.ts`): New `window.api.plugin.*` methods for granular lifecycle and metadata. New IPC channels added to allowlists.
- **Renderer** (`src/renderer/src/`): New `PluginManagerTab` and `PluginDetailTab` components. Extends `BufferKind` with `'pluginManager'` and `'pluginDetail'`. Extends `Buffer` with optional `pluginId` field. Extends `pluginStore` with full metadata, lifecycle actions, and settings schemas. Extends `SettingsTab` with dynamic "Extensions" category. Deletes `PluginManagerDialog`. Removes `showPluginManager` from `uiStore`.
- **Plugin API**: New `contributeSettings(schema)` method on the API object passed to `plugin.activate(api)`.

> See [PRD](./prd.md) for user stories and business requirements.

---

## 2. Data Shapes

### 2.1. Buffer model — extend `BufferKind` and add `pluginId`

`src/renderer/src/store/editorStore.ts`:

```typescript
export type BufferKind = 'file' | 'settings' | 'shortcuts' | 'whatsNew' | 'pluginManager' | 'pluginDetail'

export interface Buffer {
  // ... existing fields ...
  kind: BufferKind
  pluginId: string | null   // NEW — set only when kind === 'pluginDetail'; the plugin's unique name
}
```

`pluginId` defaults to `null` for all buffer kinds except `'pluginDetail'`.

### 2.2. Extended `PluginInfo` — main process

`src/main/plugins/PluginLoader.ts`:

```typescript
export interface PluginManifest {
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  icon?: string                    // relative path to icon file within plugin dir
  settingsSchema?: PluginSettingsSchema  // see §2.5
}

export interface PluginInfo {
  // Identity
  name: string                     // unique identifier (from package.json name)
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  dirPath: string
  entryPath: string

  // State
  enabled: boolean
  error?: string

  // Extended metadata (loaded on demand for detail view)
  hasReadme: boolean               // true if README.md exists in plugin dir
  hasChangelog: boolean             // true if CHANGELOG.md exists in plugin dir
  hasIcon: boolean                 // true if icon file exists
  hasSettings: boolean             // true if plugin called contributeSettings()
}
```

### 2.3. Extended `PluginInfo` — renderer store

`src/renderer/src/store/pluginStore.ts`:

```typescript
export interface PluginInfo {
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  dirPath: string
  entryPath: string
  enabled: boolean
  error?: string
  hasReadme: boolean
  hasChangelog: boolean
  hasIcon: boolean
  hasSettings: boolean
}

export interface PluginDetail {
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  readme: string | null            // raw markdown content or null
  changelog: string | null         // raw markdown content or null
  iconDataUrl: string | null       // base64 data URL or null
}

export interface PluginSettingsSchema {
  fields: PluginSettingField[]
}

export interface PluginSettingField {
  key: string                      // unique within plugin, e.g. "apiKey"
  label: string                    // display label
  type: 'string' | 'number' | 'boolean' | 'select'
  default: unknown
  description?: string
  options?: Array<{ label: string; value: string | number }>  // for type 'select'
  min?: number                     // for type 'number'
  max?: number                     // for type 'number'
}

interface PluginState {
  plugins: PluginInfo[]
  pluginSettings: Record<string, PluginSettingsSchema>  // keyed by plugin name
  pluginConfigs: Record<string, Record<string, unknown>>  // persisted values keyed by plugin name

  // Actions
  fetchPlugins: () => Promise<void>
  fetchDetail: (pluginName: string) => Promise<PluginDetail>
  enablePlugin: (pluginName: string) => Promise<void>
  disablePlugin: (pluginName: string) => Promise<void>
  reloadPlugin: (pluginName: string) => Promise<void>
  installPlugin: () => Promise<PluginInfo | null>          // opens folder picker, returns installed plugin info
  uninstallPlugin: (pluginName: string) => Promise<void>
  fetchPluginSettings: () => Promise<void>                 // fetches all contributed settings schemas
  setPluginConfig: (pluginName: string, key: string, value: unknown) => void

  // Legacy (to be removed)
  dynamicMenuItems: Array<{ pluginName: string; label: string }>
  addDynamicMenuItem: (item: { pluginName: string; label: string }) => void
}
```

### 2.4. `editorStore` — new actions

| Name | Shape | Description |
|------|-------|-------------|
| `openPluginManagerTab()` | `() => string` | Opens/focuses the singleton Plugin Manager list tab. Returns buffer id. |
| `openPluginDetailTab(pluginId, pluginName)` | `(pluginId: string, pluginName: string) => string` | Opens a detail tab for the given plugin. If one already exists for this `pluginId`, focuses it. Otherwise creates a new buffer with `kind: 'pluginDetail'` and `pluginId` set. Returns buffer id. |
| `closePluginDetailTab(pluginId)` | `(pluginId: string) => void` | Closes the detail tab for the given plugin if it exists. Used by uninstall to clean up. |

Implementation:

```typescript
openPluginManagerTab: () => {
  const existing = get().buffers.find((b) => b.kind === 'pluginManager')
  if (existing) {
    set({ activeId: existing.id })
    return existing.id
  }
  const id = newId()
  set((s) => ({
    buffers: [...s.buffers, {
      id,
      kind: 'pluginManager',
      pluginId: null,
      filePath: null,
      title: 'Extensions',
      content: '',
      isDirty: false,
      encoding: 'UTF-8',
      eol: 'LF',
      language: 'plaintext',
      mtime: 0,
      viewState: null,
      savedViewState: null,
      model: null,
      bookmarks: [],
      loaded: true,
      missing: false,
      isLargeFile: false
    }],
    activeId: id
  }))
  return id
},

openPluginDetailTab: (pluginId, pluginName) => {
  const existing = get().buffers.find((b) => b.kind === 'pluginDetail' && b.pluginId === pluginId)
  if (existing) {
    set({ activeId: existing.id })
    return existing.id
  }
  const id = newId()
  set((s) => ({
    buffers: [...s.buffers, {
      id,
      kind: 'pluginDetail',
      pluginId,
      filePath: null,
      title: pluginName,
      content: '',
      isDirty: false,
      encoding: 'UTF-8',
      eol: 'LF',
      language: 'plaintext',
      mtime: 0,
      viewState: null,
      savedViewState: null,
      model: null,
      bookmarks: [],
      loaded: true,
      missing: false,
      isLargeFile: false
    }],
    activeId: id
  }))
  return id
},

closePluginDetailTab: (pluginId) => {
  const buf = get().buffers.find((b) => b.kind === 'pluginDetail' && b.pluginId === pluginId)
  if (buf) get().removeBuffer(buf.id)
}
```

### 2.5. Plugin settings schema (Plugin API side)

Contributed by plugins via `api.contributeSettings()` in the main process:

```typescript
// Inside PluginLoader.buildAPI():
settings: {
  contributeSettings: (schema: PluginSettingsSchema) => {
    this.pluginSettingsSchemas.set(pluginName, schema)
  }
}
```

`PluginSettingsSchema` is defined in §2.3. The schema is collected at `activate()` time and served to the renderer via IPC.

### 2.6. Plugin config persistence

Plugin configuration values are stored in a separate config file per plugin:

```
~/.config/novapad/config/plugin-settings/<pluginName>.json
```

Read/write via existing `config:read-raw` / `config:write-raw` IPC channels, using path `plugin-settings/<pluginName>.json`.

### 2.7. Session schema — extend virtual tab kinds

`src/main/sessions/SessionManager.ts`:

```typescript
export type SessionVirtualKind = 'settings' | 'shortcuts' | 'whatsNew' | 'pluginManager' | 'pluginDetail'

interface SessionVirtualTab {
  kind: SessionVirtualKind
  pluginId?: string           // set only for 'pluginDetail'
}
```

`KNOWN_VIRTUAL_KINDS` set gains `'pluginManager'` and `'pluginDetail'`.

Migration: no version bump needed — v3 already supports `virtualTabs` array. New kinds are simply added to the allowlist. Old sessions without these kinds restore normally.

Restore behavior for `pluginDetail`: if the saved `pluginId` doesn't match any installed plugin, render a "Plugin not found" placeholder instead of crashing.

---

## 3. IPC Channels (Main ↔ Renderer)

### 3.1. New invoke channels (renderer → main, returns Promise)

| Channel | Params | Returns | Description |
|---------|--------|---------|-------------|
| `plugin:list` | *(none)* | `PluginInfo[]` | **Existing** — now returns extended `PluginInfo` with metadata flags. |
| `plugin:detail` | `pluginName: string` | `PluginDetail` | Returns full detail (README content, changelog content, icon data URL) for one plugin. |
| `plugin:enable` | `pluginName: string` | `PluginInfo` | Enables and loads a single plugin. Returns updated info. |
| `plugin:disable` | `pluginName: string` | `PluginInfo` | Disables and unloads a single plugin. Returns updated info. |
| `plugin:reload-one` | `pluginName: string` | `PluginInfo` | Deactivates then reactivates a single plugin. Returns updated info. |
| `plugin:install` | *(none)* | `PluginInfo \| null` | Opens native folder picker, copies folder to plugins dir, loads the plugin, returns info. `null` if user cancelled. |
| `plugin:uninstall` | `pluginName: string` | `void` | Deactivates plugin, removes folder from disk. |
| `plugin:settings-schemas` | *(none)* | `Record<string, PluginSettingsSchema>` | Returns all contributed settings schemas keyed by plugin name. |
| `plugin:reload` | *(none)* | `PluginInfo[]` | **Existing** — kept for backward compat. Reloads all. |

### 3.2. New send channels (main → renderer, fire-and-forget)

| Channel | Payload | Description |
|---------|---------|-------------|
| `plugin:state-changed` | `PluginInfo` | Fired after any single-plugin lifecycle change (enable/disable/reload/install/uninstall). Renderer updates pluginStore. |

### 3.3. Updated menu channel

| Channel | Old behavior | New behavior |
|---------|-------------|--------------|
| `menu:plugin-manager` | `useUIStore.getState().setShowPluginManager(true)` | `useEditorStore.getState().openPluginManagerTab()` |

### 3.4. Updated preload `window.api.plugin`

```typescript
plugin: {
  list: () => ipcRenderer.invoke('plugin:list'),
  detail: (name: string) => ipcRenderer.invoke('plugin:detail', name),
  enable: (name: string) => ipcRenderer.invoke('plugin:enable', name),
  disable: (name: string) => ipcRenderer.invoke('plugin:disable', name),
  reloadOne: (name: string) => ipcRenderer.invoke('plugin:reload-one', name),
  install: () => ipcRenderer.invoke('plugin:install'),
  uninstall: (name: string) => ipcRenderer.invoke('plugin:uninstall', name),
  settingsSchemas: () => ipcRenderer.invoke('plugin:settings-schemas'),
  reload: () => ipcRenderer.invoke('plugin:reload')      // existing — kept
}
```

### 3.5. Updated preload allowlists

`on` / `off` arrays — **add**: `'plugin:state-changed'`

No changes to `send` allowlist.

---

## 4. Main Process — PluginLoader Changes

### 4.1. Granular lifecycle methods

```typescript
class PluginLoader {
  // Existing
  loadAll(win: BrowserWindow): void
  reloadAll(): PluginInfo[]
  getPluginList(): PluginInfo[]

  // New
  enablePlugin(pluginName: string): PluginInfo
  disablePlugin(pluginName: string): PluginInfo
  reloadPlugin(pluginName: string): PluginInfo
  installPlugin(sourcePath: string): PluginInfo
  uninstallPlugin(pluginName: string): void
  getPluginDetail(pluginName: string): PluginDetail
  getSettingsSchemas(): Record<string, PluginSettingsSchema>
}
```

#### `enablePlugin(pluginName)`

1. Find the plugin in `this.plugins` by name.
2. If already enabled, return current info.
3. Call `this.loadPlugin(plugin.dirPath)` (existing private method).
4. Notify renderer via `plugin:state-changed`.
5. Return updated `PluginInfo`.

#### `disablePlugin(pluginName)`

1. Find the plugin in `this.plugins`.
2. If already disabled, return current info.
3. If the loaded module has a `deactivate()` export, call it.
4. Clear the module from Node's `require.cache` (to allow fresh reload later).
5. Set `plugin.enabled = false`.
6. Remove any contributed settings schema for this plugin.
7. Notify renderer via `plugin:state-changed`.
8. Return updated `PluginInfo`.

#### `reloadPlugin(pluginName)`

1. Call `disablePlugin(pluginName)`.
2. Call `enablePlugin(pluginName)`.
3. Return updated `PluginInfo`.

#### `installPlugin(sourcePath)`

1. Read `package.json` from `sourcePath` to get the plugin name.
2. Determine target: `path.join(this.pluginsDir, pluginName)`.
3. If target exists, the renderer must have already confirmed overwrite (IPC handler checks).
4. Recursively copy `sourcePath` → target directory.
5. Call `this.loadPlugin(target)`.
6. Notify renderer via `plugin:state-changed`.
7. Return the new `PluginInfo`.

#### `uninstallPlugin(pluginName)`

1. Call `disablePlugin(pluginName)` (handles deactivate + cache clear).
2. `fs.rmSync(plugin.dirPath, { recursive: true, force: true })`.
3. Remove from `this.plugins` map.
4. Notify renderer via `plugin:state-changed`.

#### `getPluginDetail(pluginName)`

1. Find the plugin in `this.plugins`.
2. Read `README.md` from `plugin.dirPath` if it exists → `readme` string or `null`.
3. Read `CHANGELOG.md` from `plugin.dirPath` if it exists → `changelog` string or `null`.
4. Read icon file (from `package.json` `icon` field, or default `icon.png`) → convert to base64 data URL or `null`.
5. Return `PluginDetail` object.

#### `getSettingsSchemas()`

Returns the `this.pluginSettingsSchemas` map — a `Map<string, PluginSettingsSchema>` populated by plugins calling `api.settings.contributeSettings()`.

### 4.2. Extended `buildAPI`

The Plugin API object passed to `plugin.activate(api)` gains a `settings` namespace:

```typescript
private buildAPI(pluginName: string) {
  return {
    // ... existing: name, editor, ui, events, fs ...

    settings: {
      contributeSettings: (schema: PluginSettingsSchema) => {
        this.pluginSettingsSchemas.set(pluginName, schema)
      },
      get: (key: string): unknown => {
        return this.getPluginConfigValue(pluginName, key)
      },
      set: (key: string, value: unknown): void => {
        this.setPluginConfigValue(pluginName, key, value)
      }
    }
  }
}
```

### 4.3. IPC handler registration

`src/main/ipc/pluginHandlers.ts` — expanded:

```typescript
export function registerPluginHandlers(): void {
  const loader = PluginLoader.getInstance()

  ipcMain.handle('plugin:list', async () => loader.getPluginList())
  ipcMain.handle('plugin:reload', async () => loader.reloadAll())
  ipcMain.handle('plugin:detail', async (_e, name: string) => loader.getPluginDetail(name))
  ipcMain.handle('plugin:enable', async (_e, name: string) => loader.enablePlugin(name))
  ipcMain.handle('plugin:disable', async (_e, name: string) => loader.disablePlugin(name))
  ipcMain.handle('plugin:reload-one', async (_e, name: string) => loader.reloadPlugin(name))
  ipcMain.handle('plugin:uninstall', async (_e, name: string) => loader.uninstallPlugin(name))
  ipcMain.handle('plugin:settings-schemas', async () => {
    const map = loader.getSettingsSchemas()
    return Object.fromEntries(map)
  })

  ipcMain.handle('plugin:install', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Plugin Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const sourcePath = result.filePaths[0]
    // Check for overwrite
    const pkgPath = path.join(sourcePath, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      throw new Error('Selected folder does not contain a package.json')
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const pluginName = pkg.name || path.basename(sourcePath)
    const targetPath = path.join(loader.pluginsDir, pluginName)

    if (fs.existsSync(targetPath)) {
      const confirm = await dialog.showMessageBox(win, {
        type: 'question',
        buttons: ['Overwrite', 'Cancel'],
        defaultId: 1,
        title: 'Plugin Already Exists',
        message: `Plugin "${pluginName}" is already installed. Overwrite?`
      })
      if (confirm.response !== 0) return null
      // Disable existing plugin before overwrite
      try { loader.disablePlugin(pluginName) } catch { /* may not be loaded */ }
    }

    return loader.installPlugin(sourcePath)
  })

  // Legacy: plugin API calls forwarded from plugin context
  ipcMain.on('plugin:api-call', (_e, pluginName: string, method: string, args: unknown[]) => {
    loader.dispatchAPICall(pluginName, method, args)
  })
}
```

---

## 5. Renderer UI Contract

### 5.1. Plugin Manager list tab — `PluginManagerTab`

New component: `src/renderer/src/components/PluginManagerTab/PluginManagerTab.tsx`

Rendered by `App.tsx` when `activeKind === 'pluginManager'` (same pattern as `SettingsTab`):

```tsx
{activeKind === 'pluginManager' && (
  <div className="absolute inset-0 bg-background z-10"><PluginManagerTab /></div>
)}
```

#### Layout

```
┌─────────────────────────────────────────────────┐
│  Extensions                    [Install from Folder...] │
│  ┌─────────────────────────────────────────────┐│
│  │ 🔍 Search extensions...                     ││
│  ├─────────────────────────────────────────────┤│
│  │ [All] [Enabled] [Disabled]                  ││
│  ├─────────────────────────────────────────────┤│
│  │ ┌─────────────────────────────────────────┐ ││
│  │ │ 🧩 Plugin Name          v1.0.0         │ ││
│  │ │    Author · Short description           │ ││
│  │ │    [Disable] [Reload] [Uninstall]       │ ││
│  │ └─────────────────────────────────────────┘ ││
│  │ ┌─────────────────────────────────────────┐ ││
│  │ │ 🧩 Another Plugin       v2.1.0  ⚠ Error│ ││
│  │ │    Author · Description                 │ ││
│  │ │    [Enable] [Reload] [Uninstall]        │ ││
│  │ └─────────────────────────────────────────┘ ││
│  │  ...                                        ││
│  └─────────────────────────────────────────────┘│
│  (empty state: "No plugins installed. Click     │
│   'Install from Folder' to add one.")           │
└─────────────────────────────────────────────────┘
```

#### Behavior

- On mount: calls `pluginStore.fetchPlugins()`.
- **Search**: filters `plugins` array client-side by `name`, `author`, `description` (case-insensitive substring match).
- **Filter tabs**: All / Enabled / Disabled — filters by `plugin.enabled` state.
- **Plugin row click** (on name/icon area): calls `editorStore.openPluginDetailTab(plugin.name, plugin.name)`.
- **Inline actions** (visible on hover or always, depending on space):
  - Enable/Disable toggle → calls `pluginStore.enablePlugin(name)` or `pluginStore.disablePlugin(name)`.
  - Reload → calls `pluginStore.reloadPlugin(name)`. Disabled when plugin is disabled.
  - Uninstall → shows confirmation dialog, then calls `pluginStore.uninstallPlugin(name)`.
- **Install from Folder** button → calls `pluginStore.installPlugin()`.
- **Error badge**: plugins with `error` show a warning icon with tooltip containing the error message.
- **Empty state**: when no plugins match (due to search/filter or no plugins installed), show helpful message.

### 5.2. Plugin detail tab — `PluginDetailTab`

New component: `src/renderer/src/components/PluginDetailTab/PluginDetailTab.tsx`

Rendered by `App.tsx` when `activeKind === 'pluginDetail'`:

```tsx
{activeKind === 'pluginDetail' && (
  <div className="absolute inset-0 bg-background z-10">
    <PluginDetailTab pluginId={activeBuffer.pluginId!} />
  </div>
)}
```

#### Layout

```
┌──────────────────────────────────────────────────┐
│  ┌──────┐                                        │
│  │ icon │  Plugin Name                           │
│  │      │  v1.0.0 · Author Name                 │
│  └──────┘  [Disable] [Reload] [Uninstall]        │
│            [Extension Settings]                   │
├──────────────────────────────────────────────────┤
│  [Details] [Changelog]                           │
├──────────────────────────────────────────────────┤
│                                                  │
│  (rendered markdown README or changelog)         │
│                                                  │
│  Homepage: https://...                           │
│  License: MIT                                    │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### Behavior

- On mount: calls `pluginStore.fetchDetail(pluginId)` to get README, changelog, icon.
- **Header**: icon (or default placeholder), name, version, author.
- **Action buttons**: same as list view (Enable/Disable, Reload, Uninstall). Uninstall closes this tab after completion.
- **"Extension Settings" link**: visible only when `plugin.hasSettings === true`. Navigates to Settings tab, scrolled to the Extensions > [plugin name] section. Implementation: calls `editorStore.openVirtualTab('settings')` then emits a store event to scroll SettingsTab to the Extensions category.
- **Tab switcher**: "Details" (renders README markdown) / "Changelog" (renders CHANGELOG markdown). Default: Details.
- **Markdown rendering**: use a lightweight markdown renderer (e.g., `react-markdown` or a simple `dangerouslySetInnerHTML` with a sanitizer). Scope CSS to avoid leaking into the app.
- **"Plugin not found" state**: if `fetchDetail` returns null (plugin uninstalled between sessions), show a placeholder message with a close button.
- **Metadata footer**: homepage (as clickable link opening external browser), license.

### 5.3. Settings tab — "Extensions" category

`src/renderer/src/components/SettingsTab/SettingsTab.tsx`:

Extend the `TABS` array dynamically:

```typescript
// Static tabs
const STATIC_TABS: { id: PrefTab; label: string }[] = [
  { id: 'general',    label: 'General' },
  { id: 'editor',     label: 'Editor' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'newDoc',     label: 'New Document' },
  { id: 'backup',     label: 'Backup / AutoSave' },
  { id: 'completion', label: 'Auto-Completion' },
]

// In component:
const { pluginSettings } = usePluginStore()
const hasExtensions = Object.keys(pluginSettings).length > 0
const tabs = hasExtensions
  ? [...STATIC_TABS, { id: 'extensions' as PrefTab, label: 'Extensions' }]
  : STATIC_TABS
```

The "Extensions" panel renders sub-sections per plugin:

```
Extensions
├── Plugin A
│   ├── Setting 1: [input]
│   ├── Setting 2: [checkbox]
│   └── Setting 3: [select]
├── Plugin B
│   └── Setting 1: [input]
```

Each setting field is rendered based on `PluginSettingField.type`:
- `'string'` → text input
- `'number'` → number input (with min/max)
- `'boolean'` → checkbox
- `'select'` → dropdown with provided options

Values are read from `pluginStore.pluginConfigs[pluginName][key]` and written via `pluginStore.setPluginConfig(pluginName, key, value)`, which debounce-saves to `plugin-settings/<pluginName>.json`.

### 5.4. TabBar contract for new virtual tab kinds

`src/renderer/src/components/TabBar/TabBar.tsx`:

- `kind === 'pluginManager'`: show extensions icon, title "Extensions". No dirty dot. Singleton behavior.
- `kind === 'pluginDetail'`: show plugin icon (or extensions icon), title = plugin name. No dirty dot. Right-click context menu: show `Close`, `Close Others`, `Close All` — hide file-specific items.

### 5.5. App.tsx wiring changes

```typescript
// Replace:
window.api.on('menu:plugin-manager', () => useUIStore.getState().setShowPluginManager(true))
// With:
window.api.on('menu:plugin-manager', () => useEditorStore.getState().openPluginManagerTab())

// Add listener for plugin state changes:
window.api.on('plugin:state-changed', (...args) => {
  usePluginStore.getState().fetchPlugins()  // refresh the full list
})

// Add rendering for new virtual tab kinds:
{activeKind === 'pluginManager' && (
  <div className="absolute inset-0 bg-background z-10"><PluginManagerTab /></div>
)}
{activeKind === 'pluginDetail' && activeBuffer?.pluginId && (
  <div className="absolute inset-0 bg-background z-10">
    <PluginDetailTab pluginId={activeBuffer.pluginId} />
  </div>
)}
```

### 5.6. Removal of legacy dialog

- Delete `src/renderer/src/components/Dialogs/PluginManager/PluginManagerDialog.tsx`.
- Remove its import and `<PluginManagerDialog />` from `App.tsx`.
- Remove `showPluginManager` and `setShowPluginManager` from `uiStore.ts`.
- Remove `window.api.off('menu:plugin-manager')` cleanup (rewired to editorStore, no off needed for virtual tab approach — but keep the `off` call in cleanup for the new handler).

---

## 6. Session Restore Contract

### 6.1. Save path — virtual tabs serialization

`App.tsx` session save — extend the virtualBuffers filter:

```typescript
const virtualBuffers = freshState.buffers.filter((b) =>
  b.kind === 'settings' || b.kind === 'shortcuts' || b.kind === 'whatsNew' ||
  b.kind === 'pluginManager' || b.kind === 'pluginDetail'
)

// Serialize virtualTabs:
virtualTabs: virtualBuffers.map((b) => ({
  kind: b.kind,
  ...(b.kind === 'pluginDetail' ? { pluginId: b.pluginId } : {})
}))
```

### 6.2. Restore path

`SessionManager.normalize` — add `'pluginManager'` and `'pluginDetail'` to `KNOWN_VIRTUAL_KINDS`.

For `pluginDetail` entries, validate and preserve the `pluginId` field:

```typescript
virtualTabs = rawVirtual
  .filter(/* existing validation */)
  .map((v) => ({
    kind: v.kind as SessionVirtualKind,
    ...(v.kind === 'pluginDetail' && typeof v.pluginId === 'string' ? { pluginId: v.pluginId } : {})
  }))
```

Renderer restore:

```typescript
for (const vt of session.virtualTabs) {
  if (vt.kind === 'pluginManager') {
    editorStore.openPluginManagerTab()
  } else if (vt.kind === 'pluginDetail' && vt.pluginId) {
    editorStore.openPluginDetailTab(vt.pluginId, vt.pluginId)  // title will be updated on fetch
  } else {
    editorStore.openVirtualTab(vt.kind)
  }
}
```

### 6.3. Stale plugin detail tabs

If a `pluginDetail` tab is restored for a plugin that is no longer installed:
- `PluginDetailTab` calls `fetchDetail(pluginId)` → returns `null`.
- Component renders a "Plugin not found" placeholder with the plugin name and a suggestion to close the tab.
- No crash, no error thrown.

---

## 7. Business Rules (Technical Enforcement)

| ID | Rule | Enforced By |
|----|------|-------------|
| BR-001 | Singleton Plugin Manager list tab | `editorStore.openPluginManagerTab()` checks for existing `kind === 'pluginManager'` buffer before creating |
| BR-002 | Unique detail tabs per plugin | `editorStore.openPluginDetailTab()` checks for existing buffer with matching `pluginId` |
| BR-003 | Immediate lifecycle effect | `PluginLoader.enablePlugin/disablePlugin` execute synchronously in the main process; renderer receives `plugin:state-changed` notification |
| BR-004 | Copy-based install | `PluginLoader.installPlugin()` uses `fs.cpSync(src, dest, { recursive: true })` — no symlinks |
| BR-005 | Plugin manifest required | `PluginLoader.loadPlugin()` — existing check for `package.json` + `index.js` is preserved |
| BR-006 | Settings visible only when enabled | `SettingsTab` Extensions category filters `pluginSettings` to only show entries where the plugin is in the enabled `plugins` list |
| BR-007 | Detail tab read-only | `PluginDetailTab` never calls `updateBuffer({ isDirty: true })` |
| BR-008 | Overwrite confirmation | `plugin:install` IPC handler shows `dialog.showMessageBox` before overwriting |
| BR-009 | Uninstall cleanup | `pluginStore.uninstallPlugin()` calls `editorStore.closePluginDetailTab(name)` after IPC completes |
| BR-010 | Legacy dialog removed | `PluginManagerDialog.tsx` deleted; `showPluginManager` removed from `uiStore` |

---

## 8. Validation & Error Handling

| Scenario | Behavior |
|----------|----------|
| `plugin:enable` for non-existent plugin | IPC handler throws; renderer shows toast error. |
| `plugin:install` with folder missing `package.json` | IPC handler throws `"Selected folder does not contain a package.json"`; renderer shows toast error. |
| `plugin:install` with folder missing `index.js` | Plugin is installed (copied) but `loadPlugin` marks it with error `"Missing entry point"`; shown in list with error badge. |
| `plugin:detail` for uninstalled plugin | Returns `null`; `PluginDetailTab` shows "Plugin not found" placeholder. |
| Plugin `activate()` throws | `PluginLoader.loadPlugin` catches, sets `info.error = err.message`, `info.enabled = false`. Shown in list with error badge. |
| Plugin `deactivate()` throws | `PluginLoader.disablePlugin` catches silently, continues with unload. Logs warning. |
| `plugin:install` user cancels folder picker | Returns `null`; no action taken. |
| Session restores `pluginDetail` for missing plugin | Component renders graceful "not found" state (see §6.3). |
| `require.cache` clear fails on disable | Catch silently; plugin may not hot-reload cleanly but app doesn't crash. |

---

## 9. File Structure (New & Modified)

### New files

```
src/renderer/src/components/PluginManagerTab/
  └── PluginManagerTab.tsx          # List view component

src/renderer/src/components/PluginDetailTab/
  └── PluginDetailTab.tsx           # Detail view component
```

### Modified files

```
src/main/plugins/PluginLoader.ts    # Granular lifecycle, extended metadata, settings API
src/main/ipc/pluginHandlers.ts      # New IPC handlers
src/main/sessions/SessionManager.ts # New virtual tab kinds
src/preload/index.ts                # Extended plugin API, new allowlist entries
src/renderer/src/store/editorStore.ts   # New BufferKind values, pluginId field, new actions
src/renderer/src/store/pluginStore.ts   # Extended state, lifecycle actions, settings
src/renderer/src/store/uiStore.ts       # Remove showPluginManager
src/renderer/src/components/SettingsTab/SettingsTab.tsx  # Dynamic Extensions category
src/renderer/src/components/TabBar/TabBar.tsx            # Handle new virtual tab kinds
src/renderer/src/App.tsx                                 # Rewire menu handler, add rendering, session save
```

### Deleted files

```
src/renderer/src/components/Dialogs/PluginManager/PluginManagerDialog.tsx
```

---

## 10. Open Questions

1. **Markdown renderer choice** — Use `react-markdown` (adds a dependency) or a lighter approach (convert to HTML server-side in main process and send sanitized HTML)? `react-markdown` is more standard but adds bundle size.
2. **Plugin icon format** — Support only PNG, or also SVG/ICO? PNG is simplest; SVG allows better scaling.
3. **Plugin config change notification** — When user changes a plugin setting in the Settings page, should the main process notify the plugin in real-time (e.g., call a `onConfigChanged(key, value)` callback)? Or does the plugin just read config on startup?
4. **Sidebar plugins panel** — `uiStore` has `sidebarPanel: 'plugins'`. Should this be removed, repurposed, or kept as a quick-access shortcut to the Plugin Manager tab?
