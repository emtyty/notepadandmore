# Implementation Plan: Plugin Manager Page

**Feature:** plugin-manager-page
**Date:** 2026-04-15
**Prerequisites:** PRD, Spec are finalized.

> References:
> - [PRD](./prd.md) — features, user stories, business rules
> - [Spec](./spec.md) — data shapes, IPC channels, PluginLoader API, renderer UI contracts

---

## Phase Overview

| # | Phase | Description | Depends On | Deliverable | Verification |
|---|-------|-------------|------------|-------------|--------------|
| 1 | Foundation | Extend Buffer model (`pluginId`), new editorStore actions, session support for new virtual tab kinds | — | `openPluginManagerTab()` and `openPluginDetailTab()` work programmatically; session round-trips new kinds |  Typecheck + manual store call |
| 2 | Main process — granular lifecycle | PluginLoader gains per-plugin enable/disable/reload/install/uninstall + extended metadata + settings API | — | IPC handlers respond correctly; plugins can be individually managed | Typecheck + manual IPC probe |
| 3 | Preload + IPC bridge | Expose new `window.api.plugin.*` methods; update allowlists | P2 | Renderer can call all new plugin IPC channels | Typecheck |
| 4 | Plugin store expansion | Extend `pluginStore` with lifecycle actions, detail fetching, settings schemas, plugin configs | P3 | Store actions work end-to-end through IPC | Typecheck + manual store call |
| 5 | Plugin Manager list tab | `PluginManagerTab` component with search, filter, inline actions | P1, P4 | Opening Plugin Manager shows functional list view | Visual + Playwright |
| 6 | Plugin detail tab | `PluginDetailTab` component with README, changelog, metadata, actions | P1, P4 | Clicking a plugin opens detail tab with rendered content | Visual + Playwright |
| 7 | Settings page — Extensions category | Dynamic "Extensions" category in `SettingsTab` driven by plugin-contributed schemas | P4 | Plugin settings render and auto-save in Settings page | Visual + Playwright |
| 8 | Wire-up + legacy removal | Rewire `menu:plugin-manager` to open tab; remove `PluginManagerDialog`; session save/restore; cleanup | P5, P6, P7 | Full end-to-end flow; all PRD acceptance criteria met | Full E2E |

> **P1 and P2 have no code overlap — they can be executed in parallel.**
> P3 depends on P2. P4 depends on P3.
> P5, P6, P7 can be executed in parallel after P1 + P4 are done.
> P8 is the final integration phase.

---

## Phase 1: Foundation — Buffer Model + Session Extensions

**Goal:** Extend the Buffer model to support `pluginManager` and `pluginDetail` virtual tab kinds. Add `pluginId` field. Create `openPluginManagerTab` and `openPluginDetailTab` actions. Update session serialization.

**Input:** Spec §2.1, §2.4, §2.7, §6.
**Output:** Store actions can create/focus plugin-related virtual tabs; SessionManager accepts and round-trips the new kinds.

### Tasks

| # | Task | File(s) | Description | Verification |
|---|------|---------|-------------|--------------|
| 1.1 | Extend `BufferKind` | `src/renderer/src/store/editorStore.ts` | Add `'pluginManager' \| 'pluginDetail'` to `BufferKind` union. Add `pluginId: string \| null` field to `Buffer` interface with default `null`. Update `addBuffer` and `addGhostBuffer` to include `pluginId: null`. | Typecheck |
| 1.2 | Add `openPluginManagerTab` action | `src/renderer/src/store/editorStore.ts` | Singleton behavior: find existing `kind === 'pluginManager'`, focus if found, otherwise create. Title: `'Extensions'`. Per spec §2.4. | Manual: call twice from DevTools → one buffer, second call focuses. |
| 1.3 | Add `openPluginDetailTab` action | `src/renderer/src/store/editorStore.ts` | Parameterized by `pluginId` + `pluginName`. Find existing buffer with matching `kind === 'pluginDetail'` AND `pluginId`, focus if found, otherwise create. Title = `pluginName`. Per spec §2.4. | Manual: open same plugin twice → focuses; open different plugin → new tab. |
| 1.4 | Add `closePluginDetailTab` action | `src/renderer/src/store/editorStore.ts` | Find buffer with `kind === 'pluginDetail'` AND matching `pluginId`, call `removeBuffer()` if found. Used by uninstall cleanup. | Manual: open detail, call close → tab removed. |
| 1.5 | Update `SessionManager` | `src/main/sessions/SessionManager.ts` | Add `'pluginManager'` and `'pluginDetail'` to `KNOWN_VIRTUAL_KINDS`. Handle `pluginId` field in `SessionVirtualTab` interface. Validate `pluginId` as string for `pluginDetail` entries during normalize. | Typecheck + manual: save session with plugin tabs, reload, verify restore. |
| 1.6 | Update session save in `App.tsx` | `src/renderer/src/App.tsx` | Extend `virtualBuffers` filter to include `'pluginManager'` and `'pluginDetail'`. Serialize `pluginId` for `pluginDetail` entries in `virtualTabs` array. | Typecheck |

### Phase Exit Criteria

- [ ] `npm run build` passes (typecheck all bundles).
- [ ] `openPluginManagerTab()` is idempotent (singleton).
- [ ] `openPluginDetailTab(id, name)` creates unique tabs per plugin and focuses existing.
- [ ] Session save includes new virtual tab kinds; restore recreates them.

---

## Phase 2: Main Process — Granular Plugin Lifecycle

**Goal:** Extend `PluginLoader` with per-plugin lifecycle methods, extended metadata reading, settings contribution API, and plugin config persistence.

**Input:** Spec §4.1–§4.3.
**Output:** `PluginLoader` exposes `enablePlugin`, `disablePlugin`, `reloadPlugin`, `installPlugin`, `uninstallPlugin`, `getPluginDetail`, `getSettingsSchemas`. IPC handlers are registered.

### Tasks

| # | Task | File(s) | Description | Verification |
|---|------|---------|-------------|--------------|
| 2.1 | Add `disablePlugin` method | `src/main/plugins/PluginLoader.ts` | Call `deactivate()` if defined (catch errors silently). Clear `require.cache` for the plugin's entry path. Set `enabled = false`. Remove settings schema. Per spec §4.1. | Manual: disable a loaded plugin → status changes, module unloaded. |
| 2.2 | Add `enablePlugin` method | `src/main/plugins/PluginLoader.ts` | If already enabled, return. Call existing `loadPlugin(dirPath)`. Per spec §4.1. | Manual: enable a disabled plugin → `activate()` called. |
| 2.3 | Add `reloadPlugin` method | `src/main/plugins/PluginLoader.ts` | Call `disablePlugin` then `enablePlugin`. Per spec §4.1. | Manual: reload → deactivate + activate sequence. |
| 2.4 | Add `installPlugin` method | `src/main/plugins/PluginLoader.ts` | Accept `sourcePath`. Use `fs.cpSync(src, dest, { recursive: true })` to copy into `pluginsDir`. Call `loadPlugin(dest)`. Per spec §4.1. | Manual: install from test folder → plugin appears in list. |
| 2.5 | Add `uninstallPlugin` method | `src/main/plugins/PluginLoader.ts` | Call `disablePlugin`. `fs.rmSync(dirPath, { recursive: true, force: true })`. Remove from `plugins` map. Per spec §4.1. | Manual: uninstall → folder gone, plugin gone from list. |
| 2.6 | Add `getPluginDetail` method | `src/main/plugins/PluginLoader.ts` | Read `README.md`, `CHANGELOG.md`, icon file from plugin dir. Return `PluginDetail` object per spec §4.1. Lazy — only reads on demand. | Manual: call for an installed plugin → returns content. |
| 2.7 | Extend `PluginInfo` with metadata flags | `src/main/plugins/PluginLoader.ts` | Add `homepage`, `license`, `hasReadme`, `hasChangelog`, `hasIcon`, `hasSettings` to `PluginInfo`. Populate during `loadPlugin`. Per spec §2.2. | Typecheck + manual: list plugins → see metadata flags. |
| 2.8 | Add settings contribution to Plugin API | `src/main/plugins/PluginLoader.ts` | Add `pluginSettingsSchemas: Map<string, PluginSettingsSchema>` to PluginLoader. Extend `buildAPI` with `settings.contributeSettings(schema)`, `settings.get(key)`, `settings.set(key, value)`. Per spec §2.5, §4.2. | Manual: test plugin calls `contributeSettings` → schema stored. |
| 2.9 | Add `getSettingsSchemas` method | `src/main/plugins/PluginLoader.ts` | Returns `Object.fromEntries(this.pluginSettingsSchemas)`. Per spec §4.1. | Typecheck |
| 2.10 | Add plugin config persistence | `src/main/plugins/PluginLoader.ts` | `getPluginConfigValue(name, key)` and `setPluginConfigValue(name, key, value)` read/write JSON files at `userData/config/plugin-settings/<name>.json`. Per spec §2.6. | Manual: set a value → file written; get → value returned. |
| 2.11 | Expand IPC handlers | `src/main/ipc/pluginHandlers.ts` | Register `plugin:detail`, `plugin:enable`, `plugin:disable`, `plugin:reload-one`, `plugin:install` (with folder picker + overwrite confirmation), `plugin:uninstall`, `plugin:settings-schemas`. Per spec §4.3. | Typecheck + manual IPC probe from renderer DevTools. |
| 2.12 | Make `pluginsDir` accessible | `src/main/plugins/PluginLoader.ts` | Change `pluginsDir` getter from `private` to `public` (needed by `plugin:install` IPC handler for overwrite check). | Typecheck |

### Phase Exit Criteria

- [ ] `npm run build` passes.
- [ ] Each lifecycle method works in isolation (manual test with a sample plugin).
- [ ] `plugin:install` shows folder picker + overwrite dialog when applicable.
- [ ] `getPluginDetail` returns README/changelog content.
- [ ] Settings schema contribution works for a test plugin.

---

## Phase 3: Preload + IPC Bridge

**Goal:** Expose all new plugin IPC channels to the renderer via `window.api.plugin`.

**Input:** Spec §3.4, §3.5.
**Output:** Renderer can call all new plugin methods. New IPC channels in allowlists.

### Tasks

| # | Task | File(s) | Description | Verification |
|---|------|---------|-------------|--------------|
| 3.1 | Extend `window.api.plugin` | `src/preload/index.ts` | Add `detail`, `enable`, `disable`, `reloadOne`, `install`, `uninstall`, `settingsSchemas` methods per spec §3.4. | Typecheck |
| 3.2 | Update `on`/`off` allowlists | `src/preload/index.ts` | Add `'plugin:state-changed'` to both `on` and `off` allowlists. Per spec §3.5. | Typecheck |
| 3.3 | Update `ElectronAPI` type | `src/preload/index.ts` | Type export automatically reflects the new methods (inferred from `api` object). Verify downstream `window.api` typings are correct. | Typecheck |

### Phase Exit Criteria

- [ ] `npm run build` passes.
- [ ] `window.api.plugin.detail('test')` callable from renderer DevTools.

---

## Phase 4: Plugin Store Expansion

**Goal:** Extend `pluginStore` with full lifecycle actions, detail fetching, settings schemas, and plugin config management.

**Input:** Spec §2.3.
**Output:** All store actions work end-to-end through IPC.

### Tasks

| # | Task | File(s) | Description | Verification |
|---|------|---------|-------------|--------------|
| 4.1 | Extend `PluginInfo` interface | `src/renderer/src/store/pluginStore.ts` | Add `homepage`, `license`, `hasReadme`, `hasChangelog`, `hasIcon`, `hasSettings` fields per spec §2.3. | Typecheck |
| 4.2 | Add `PluginDetail` interface | `src/renderer/src/store/pluginStore.ts` | Per spec §2.3: `readme`, `changelog`, `iconDataUrl` fields. | Typecheck |
| 4.3 | Add `PluginSettingsSchema` + `PluginSettingField` interfaces | `src/renderer/src/store/pluginStore.ts` | Per spec §2.3. | Typecheck |
| 4.4 | Add lifecycle actions | `src/renderer/src/store/pluginStore.ts` | `enablePlugin(name)`, `disablePlugin(name)`, `reloadPlugin(name)`, `installPlugin()`, `uninstallPlugin(name)`. Each calls the corresponding `window.api.plugin.*` method, then calls `fetchPlugins()` to refresh the list. `uninstallPlugin` also calls `editorStore.closePluginDetailTab(name)`. Per spec §2.3. | Manual: call from DevTools → plugin state changes. |
| 4.5 | Add `fetchDetail` action | `src/renderer/src/store/pluginStore.ts` | Calls `window.api.plugin.detail(name)`, returns `PluginDetail`. | Manual: call → returns README content. |
| 4.6 | Add settings state + actions | `src/renderer/src/store/pluginStore.ts` | `pluginSettings: Record<string, PluginSettingsSchema>`, `pluginConfigs: Record<string, Record<string, unknown>>`. `fetchPluginSettings()` calls `window.api.plugin.settingsSchemas()`. `setPluginConfig(name, key, value)` debounce-saves to `plugin-settings/<name>.json` via `window.api.config.writeRaw()`. | Manual: change a setting → persisted to file. |

### Phase Exit Criteria

- [ ] `npm run build` passes.
- [ ] All store actions complete IPC round-trip successfully.
- [ ] `uninstallPlugin` closes associated detail tab.

---

## Phase 5: Plugin Manager List Tab

**Goal:** Build the `PluginManagerTab` component — the list view with search, filter, inline actions.

**Input:** Spec §5.1.
**Output:** Opening Plugin Manager shows a functional, styled list view.

### Tasks

| # | Task | File(s) | Description | Verification |
|---|------|---------|-------------|--------------|
| 5.1 | Create `PluginManagerTab` component | `src/renderer/src/components/PluginManagerTab/PluginManagerTab.tsx` (new) | Full list view per spec §5.1. Header with title "Extensions" + "Install from Folder..." button. Search bar. Filter tabs (All/Enabled/Disabled). Plugin rows with icon, name, version, author, description, inline actions. Empty state. | Visual |
| 5.2 | Implement search filtering | same file | Client-side case-insensitive substring match on `name`, `author`, `description`. | Manual: type in search → list filters. |
| 5.3 | Implement status filtering | same file | All / Enabled / Disabled tabs. Filter `plugins` by `enabled` state. | Manual: click Disabled → only disabled shown. |
| 5.4 | Wire inline actions | same file | Enable/Disable toggle → `pluginStore.enablePlugin/disablePlugin`. Reload → `pluginStore.reloadPlugin`. Uninstall → confirmation dialog + `pluginStore.uninstallPlugin`. Disabled plugin rows: Reload disabled, Enable shown instead of Disable. | Manual: toggle → plugin state changes; uninstall → confirmation → removed. |
| 5.5 | Wire "Install from Folder" | same file | Calls `pluginStore.installPlugin()` → folder picker → plugin appears in list. | Manual: install a test plugin. |
| 5.6 | Wire plugin row click to detail | same file | Click plugin name → `editorStore.openPluginDetailTab(plugin.name, plugin.name)`. | Manual: click → detail tab opens. |
| 5.7 | Error badge | same file | Plugins with `error` show warning icon + tooltip with error message. | Visual |
| 5.8 | Add rendering in `App.tsx` | `src/renderer/src/App.tsx` | Add `{activeKind === 'pluginManager' && <div className="absolute inset-0 bg-background z-10"><PluginManagerTab /></div>}` block alongside existing virtual tab renderers. | Visual |
| 5.9 | TabBar icon for `pluginManager` | `src/renderer/src/components/TabBar/TabBar.tsx` | Render extensions icon for `kind === 'pluginManager'`. No dirty dot. | Visual |

### Phase Exit Criteria

- [ ] `npm run build` passes.
- [ ] `openPluginManagerTab()` from DevTools renders the list view.
- [ ] Search, filter, and all inline actions work.
- [ ] Install from folder works.
- [ ] Click opens detail tab (if Phase 6 is done; otherwise just verify the tab is created).

---

## Phase 6: Plugin Detail Tab

**Goal:** Build the `PluginDetailTab` component — README, changelog, metadata, actions.

**Input:** Spec §5.2.
**Output:** Clicking a plugin opens a rich detail view.

### Tasks

| # | Task | File(s) | Description | Verification |
|---|------|---------|-------------|--------------|
| 6.1 | Create `PluginDetailTab` component | `src/renderer/src/components/PluginDetailTab/PluginDetailTab.tsx` (new) | Takes `pluginId` prop. On mount calls `pluginStore.fetchDetail(pluginId)`. Renders header, action buttons, tab switcher (Details/Changelog), rendered markdown, metadata footer. Per spec §5.2. | Visual |
| 6.2 | Markdown rendering | same file | Use simple HTML rendering with `dangerouslySetInnerHTML` + DOMPurify sanitizer, or add `react-markdown` dependency. Scope CSS to prevent leaking. **Decision: prefer lightweight approach — convert in main process and send sanitized HTML to avoid new dependency. Record choice in commit.** | Visual: README renders with formatting. |
| 6.3 | Header with actions | same file | Icon (or placeholder), name, version, author. Enable/Disable, Reload, Uninstall buttons. Uninstall closes this tab. | Manual: toggle → state changes; uninstall → tab closes. |
| 6.4 | "Extension Settings" link | same file | Visible only when `plugin.hasSettings`. Calls `editorStore.openVirtualTab('settings')`. | Manual: click → navigates to Settings tab. |
| 6.5 | "Plugin not found" state | same file | If `fetchDetail` returns null (uninstalled plugin), render placeholder with message + close button. Per spec §6.3. | Manual: restore session with stale plugin detail → graceful placeholder. |
| 6.6 | Add rendering in `App.tsx` | `src/renderer/src/App.tsx` | Add `{activeKind === 'pluginDetail' && activeBuffer?.pluginId && <PluginDetailTab pluginId={activeBuffer.pluginId} />}` block. | Visual |
| 6.7 | TabBar icon for `pluginDetail` | `src/renderer/src/components/TabBar/TabBar.tsx` | Render extensions icon for `kind === 'pluginDetail'`. Title = plugin name. No dirty dot. | Visual |

### Phase Exit Criteria

- [ ] `npm run build` passes.
- [ ] Detail tab renders README, changelog, metadata for a test plugin.
- [ ] All action buttons work.
- [ ] "Plugin not found" state works for missing plugins.

---

## Phase 7: Settings Page — Extensions Category

**Goal:** Add a dynamic "Extensions" category to `SettingsTab` that renders plugin-contributed settings.

**Input:** Spec §5.3.
**Output:** Plugins that call `contributeSettings()` have their settings appear in the Settings page.

### Tasks

| # | Task | File(s) | Description | Verification |
|---|------|---------|-------------|--------------|
| 7.1 | Extend `PrefTab` type | `src/renderer/src/components/SettingsTab/SettingsTab.tsx` | Add `'extensions'` to the `PrefTab` union. | Typecheck |
| 7.2 | Dynamic tab list | same file | Read `pluginStore.pluginSettings`. If any schemas exist, append `{ id: 'extensions', label: 'Extensions' }` to tabs. Per spec §5.3. | Manual: enable plugin with settings → "Extensions" appears. |
| 7.3 | Extensions panel content | same file | Render sub-sections per plugin. Each section: plugin name header, then fields rendered by type (`string` → text input, `number` → number input, `boolean` → checkbox, `select` → dropdown). Per spec §5.3. | Visual |
| 7.4 | Read/write plugin config | same file | Values from `pluginStore.pluginConfigs[pluginName][key]`. Changes call `pluginStore.setPluginConfig(name, key, value)`. Auto-save via debounce (same pattern as app config). Per spec §5.3. | Manual: change value → persisted to file. |
| 7.5 | Fetch settings schemas on mount | same file | Call `pluginStore.fetchPluginSettings()` on SettingsTab mount (or in a top-level effect). Only show Extensions for enabled plugins. Per BR-006. | Manual: disable plugin → section disappears; enable → reappears. |

### Phase Exit Criteria

- [ ] `npm run build` passes.
- [ ] "Extensions" category appears only when plugins contribute settings.
- [ ] Settings auto-save correctly per plugin.
- [ ] Disabling a plugin hides its settings section.

---

## Phase 8: Wire-Up + Legacy Removal

**Goal:** Rewire the `menu:plugin-manager` handler, remove `PluginManagerDialog`, update session save/restore, final integration.

**Input:** Spec §5.5, §5.6, §6.
**Output:** Full end-to-end feature working. All PRD acceptance criteria met.

### Tasks

| # | Task | File(s) | Description | Verification |
|---|------|---------|-------------|--------------|
| 8.1 | Rewire `menu:plugin-manager` | `src/renderer/src/App.tsx` | Change `window.api.on('menu:plugin-manager', ...)` from `useUIStore.getState().setShowPluginManager(true)` to `useEditorStore.getState().openPluginManagerTab()`. Per spec §5.5. | Manual: menu click → tab opens. |
| 8.2 | Add `plugin:state-changed` listener | `src/renderer/src/App.tsx` | Listen for `plugin:state-changed` → call `pluginStore.fetchPlugins()` to refresh list. Per spec §3.2. | Manual: enable/disable plugin → list auto-refreshes. |
| 8.3 | Delete `PluginManagerDialog` | `src/renderer/src/components/Dialogs/PluginManager/PluginManagerDialog.tsx` | Delete the file. Remove import + `<PluginManagerDialog />` from `App.tsx`. Per spec §5.6. | grep audit: no references remain. |
| 8.4 | Remove `showPluginManager` from `uiStore` | `src/renderer/src/store/uiStore.ts` | Remove `showPluginManager` property and `setShowPluginManager` action. Per spec §5.6. | Typecheck + grep audit. |
| 8.5 | Update session restore for plugin tabs | `src/renderer/src/hooks/useFileOps.ts` | In `restoreSession`, handle `pluginManager` and `pluginDetail` virtual tab kinds. Call `openPluginManagerTab()` or `openPluginDetailTab(pluginId, pluginId)`. Per spec §6.2. | Manual: open plugin tabs, quit, relaunch → tabs restored. |
| 8.6 | Update session save in `App.tsx` | `src/renderer/src/App.tsx` | Already partially done in P1 (task 1.6). Verify `virtualBuffers` filter includes new kinds. Verify `pluginId` is serialized. Run full round-trip test. | Manual session save/restore cycle. |
| 8.7 | Update `off` cleanup | `src/renderer/src/App.tsx` | Add `window.api.off('plugin:state-changed')` in the cleanup return. | Code review |
| 8.8 | Regression sweep | All | Build + run full Playwright E2E suite. Fix any failures. Test all US acceptance criteria manually. | `npm run test:e2e` |

### Phase Exit Criteria

- [ ] `npm run build` passes.
- [ ] `grep -r "PluginManagerDialog\|showPluginManager" src/` returns zero hits.
- [ ] Menu → Plugin Manager opens tab (not dialog).
- [ ] Session restore works for `pluginManager` and `pluginDetail` tabs.
- [ ] All PRD user stories (US-001 through US-011) verified manually.
- [ ] `npm run test:e2e` passes (existing tests don't regress).

---

## Verification Strategy

### Automated Checks

| Method | When | Command |
|--------|------|---------|
| Typecheck | Every task | `npm run build` |
| E2E tests | Phase 8 | `npm run test:e2e` |

### Manual Checks (per phase)

| Phase | What to verify |
|-------|---------------|
| P1 | DevTools: `useEditorStore.getState().openPluginManagerTab()` → creates tab; call again → focuses. Same for `openPluginDetailTab`. |
| P2 | DevTools: `window.api.plugin.enable('test')` / `disable` / `reloadOne` / `detail` → correct responses. |
| P3 | DevTools: `window.api.plugin.detail('test')` callable from renderer. |
| P4 | DevTools: `usePluginStore.getState().enablePlugin('test')` → round-trips through IPC. |
| P5 | Visual: Plugin Manager tab renders list, search works, actions work. |
| P6 | Visual: Detail tab shows README, changelog, metadata, actions. |
| P7 | Visual: Settings page shows Extensions category with plugin settings. |
| P8 | Full flow: Menu → Extensions tab → click plugin → detail → enable/disable → settings → session restore. |

---

## Execution Notes

- **Parallelism:** P1 and P2 can be done in parallel (no code overlap). P5, P6, P7 can also be done in parallel after P4 is complete.
- **Commit hygiene:** One task (or a closely related group of sub-tasks) = one commit.
- **Decision points to record in commit messages:**
  - Phase 6.2: markdown rendering approach (react-markdown vs main-process HTML conversion vs DOMPurify).
  - Phase 2.10: plugin config file structure (one file per plugin vs single aggregated file).
- **Build before E2E:** `npm run build` before running `test:e2e`.
- **Test plugin:** Create a minimal test plugin in a temp folder for manual testing during P2–P8. Should include: `package.json` (name, version, author, description, homepage, license), `index.js` (exports `activate` + `deactivate`), `README.md`, `CHANGELOG.md`, `icon.png`.
- **No new dependencies unless needed:** Prefer built-in or lightweight approaches for markdown rendering. Only add `react-markdown` if the lightweight approach proves insufficient.

---

## Dependency Graph

```
P1 (Buffer model + session)  ──┐
                                ├──→ P5 (List tab)   ──┐
P2 (PluginLoader lifecycle) ──┐│                        │
                              ├┤──→ P6 (Detail tab)  ──┼──→ P8 (Wire-up + cleanup)
P3 (Preload bridge)     ←── P2││                        │
                              ││──→ P7 (Settings ext) ──┘
P4 (Plugin store)    ←── P3 ──┘│
                                │
                                └ (P1 + P4 must both be done before P5/P6/P7)
```
