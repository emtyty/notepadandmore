# Plugin Manager Page — Overview

## 1. Description

Convert the Plugin Manager from a blocking modal dialog to a full virtual tab (page), following the VS Code Extensions panel UX pattern. Users can browse installed plugins in a searchable list view, open individual plugin detail tabs, manage plugin lifecycle (enable/disable/install/uninstall) with granular per-plugin reloading, and configure plugin-contributed settings directly in the Settings page. Phase 1 is local-only with architecture designed for future marketplace expansion.

> 📋 See [Specification](./spec.md) for IPC contracts, data model, and component structure.
> 📝 See [Brainstorm Notes](./raw/notes.md) for design decisions and rationale.

---

## 2. Features

| ID | Feature | Priority | Stories | Description |
|----|---------|----------|---------|-------------|
| F1 | Plugin Manager list tab | Must Have | US-001, US-002, US-003 | Virtual tab showing all installed plugins in a searchable, filterable list with inline actions. |
| F2 | Plugin detail tab | Must Have | US-004, US-005 | Separate virtual tab per plugin showing README, changelog, metadata, and action buttons. |
| F3 | Granular plugin lifecycle | Must Have | US-006, US-007, US-008, US-009 | Per-plugin enable, disable, reload, install, and uninstall — each without affecting other plugins. |
| F4 | Install from folder | Must Have | US-008 | Browse a local folder, copy it into the plugins directory, and auto-load the plugin. |
| F5 | Plugin settings in Settings page | Should Have | US-010 | Plugins contribute settings schemas; a new "Extensions" category in Settings renders them. |
| F6 | Remove legacy dialog | Must Have | US-001 | Remove `PluginManagerDialog` modal and its `showPluginManager` UI store flag. |

---

## 3. User Stories

### Actors

| Actor | Description |
|-------|-------------|
| User | Any NovaPad user who installs or manages plugins. |
| Plugin author | A developer who creates plugins and tests them locally. |

### Stories

#### US-001: Open Plugin Manager as a tab
> **As a** user, **I want to** open Plugin Manager as a tab alongside my files, **so that** managing plugins doesn't block my editor with a modal.

**Acceptance Criteria:**
- [ ] Selecting `Plugins → Plugin Manager` from the menu (or the assigned shortcut) opens a Plugin Manager virtual tab.
- [ ] The tab title is "Extensions" and displays an extensions icon.
- [ ] The legacy `PluginManagerDialog` modal is removed; the menu action opens the tab instead.
- [ ] Only one Plugin Manager list tab can exist at a time; re-triggering the action focuses the existing tab.

#### US-002: Search and filter plugins
> **As a** user, **I want to** search and filter the plugin list, **so that** I can quickly find a specific plugin.

**Acceptance Criteria:**
- [ ] A search bar at the top of the list filters plugins by name, author, or description as the user types.
- [ ] Filter options (All / Enabled / Disabled) allow narrowing the list by status.
- [ ] When no plugins match the search or filter, a clear empty-state message is shown.

#### US-003: View plugin summary in the list
> **As a** user, **I want to** see key information about each plugin at a glance, **so that** I can assess my installed plugins without opening each one.

**Acceptance Criteria:**
- [ ] Each plugin row displays: icon (or placeholder), name, version, author, and a short description.
- [ ] Inline action buttons are visible on hover or always: Enable/Disable toggle, Uninstall.
- [ ] Plugins with load errors show an error badge with the error message accessible via tooltip.

#### US-004: View plugin details in a dedicated tab
> **As a** user, **I want to** click a plugin to see its full details in a new tab, **so that** I can read its documentation and changelog.

**Acceptance Criteria:**
- [ ] Clicking a plugin name/row in the list opens a new virtual tab for that plugin's detail.
- [ ] The detail tab title is the plugin name.
- [ ] The detail tab displays: header (icon, name, version, author), README content (rendered markdown), changelog section, and metadata (homepage URL, license).
- [ ] If the plugin has no README or changelog file, a "No documentation available" placeholder is shown.
- [ ] The detail tab is read-only and never shows a dirty indicator.

#### US-005: Open multiple plugin detail tabs
> **As a** user, **I want to** open multiple plugin detail tabs at the same time, **so that** I can compare plugins side by side.

**Acceptance Criteria:**
- [ ] Each plugin opens its own detail tab; there is no limit on how many can be open simultaneously.
- [ ] If a detail tab for a given plugin is already open, clicking that plugin again focuses the existing tab instead of creating a duplicate.
- [ ] Detail tabs can be closed individually with the close button or `Cmd/Ctrl+W`.

#### US-006: Enable or disable a plugin
> **As a** user, **I want to** enable or disable a plugin without restarting the app, **so that** I can control which plugins are active immediately.

**Acceptance Criteria:**
- [ ] Toggling the enable/disable action on a plugin takes effect immediately — only that plugin is loaded or unloaded.
- [ ] Other active plugins are not affected by the operation.
- [ ] The plugin's status updates in both the list view and any open detail tab.
- [ ] When a plugin is disabled, its `deactivate()` function is called if defined.
- [ ] When a plugin is enabled, its `activate(api)` function is called.

#### US-007: Reload a single plugin
> **As a** user, **I want to** reload a specific plugin, **so that** I can pick up changes without reloading all plugins.

**Acceptance Criteria:**
- [ ] A "Reload" action is available per plugin (in the list and in the detail tab).
- [ ] Reloading a plugin calls `deactivate()` then `activate(api)` for that plugin only.
- [ ] Other plugins remain unaffected during the reload.

#### US-008: Install a plugin from a local folder
> **As a** user, **I want to** install a plugin by selecting a folder on disk, **so that** I don't have to manually copy files.

**Acceptance Criteria:**
- [ ] An "Install from Folder..." button in the Plugin Manager tab opens a native folder picker dialog.
- [ ] After selection, the app copies the folder contents into `~/.config/novapad/plugins/<plugin-name>/`.
- [ ] The newly installed plugin is automatically loaded and appears in the list.
- [ ] If a plugin with the same name already exists, the user is prompted to confirm overwrite.

#### US-009: Uninstall a plugin
> **As a** user, **I want to** uninstall a plugin and have it fully removed, **so that** I can clean up plugins I no longer need.

**Acceptance Criteria:**
- [ ] An "Uninstall" action is available per plugin (in the list and in the detail tab).
- [ ] Uninstalling a plugin calls `deactivate()`, removes the plugin folder from disk, and removes it from the list.
- [ ] Any open detail tab for the uninstalled plugin is closed automatically.
- [ ] A confirmation prompt is shown before uninstalling.

#### US-010: Configure plugin settings in Settings page
> **As a** user, **I want to** configure plugin-specific settings in the main Settings page, **so that** all my settings are in one centralized location.

**Acceptance Criteria:**
- [ ] A new "Extensions" category appears in the Settings tab when at least one enabled plugin contributes settings.
- [ ] Each plugin that contributes settings has its own sub-section under "Extensions", labeled with the plugin name.
- [ ] Plugin settings auto-save like other app settings (debounced, no Save button).
- [ ] When a plugin is disabled, its settings section is hidden from the Settings page (but values are preserved).
- [ ] A link in the plugin detail tab navigates to the plugin's settings section in the Settings page.

#### US-011: Session persistence for Plugin Manager tab
> **As a** user, **I want to** have the Plugin Manager tab reopen if it was open when I quit, **so that** my workspace is preserved.

**Acceptance Criteria:**
- [ ] The Plugin Manager list tab persists across sessions (same as Settings tab).
- [ ] Plugin detail tabs persist across sessions; they reopen showing the correct plugin.
- [ ] If a plugin was uninstalled between sessions, its detail tab opens with a "Plugin not found" message instead of crashing.

---

## 4. Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-001 | Singleton list tab | At most one Plugin Manager list tab may exist at a time. Re-opening focuses the existing tab. |
| BR-002 | Unique detail tabs | At most one detail tab per plugin. Clicking the same plugin focuses the existing detail tab. Multiple different plugin detail tabs can coexist. |
| BR-003 | Immediate lifecycle effect | Enable, disable, reload, install, and uninstall take effect immediately without app restart. Only the targeted plugin is affected. |
| BR-004 | Copy-based install | "Install from Folder" copies the plugin folder into the plugins directory. The original folder is not referenced after install. |
| BR-005 | Plugin manifest required | A plugin must have a `package.json` (with at least `name`) and an `index.js` entry point to be recognized. |
| BR-006 | Settings visibility | Plugin-contributed settings appear in the Settings page only when the plugin is enabled. Disabling a plugin hides its settings but preserves their values. |
| BR-007 | Detail tab read-only | Plugin detail tabs never show a dirty indicator and have no editable content. |
| BR-008 | Overwrite protection | Installing a plugin whose name matches an existing plugin requires user confirmation before overwriting. |
| BR-009 | Uninstall cleanup | Uninstalling a plugin removes its folder from disk, unloads it from memory, removes it from the list, and closes any associated detail tab. |
| BR-010 | Legacy removal | The `PluginManagerDialog` modal and its `showPluginManager` UI store flag are removed. |

---

## 5. Dependencies

### Upstream (required by this feature)

| Dependency | Purpose |
|------------|---------|
| `store/editorStore.ts` — virtual tab system | New buffer kinds `'pluginManager'` and `'pluginDetail'` for the list and detail tabs. Detail tabs need parameterized identity (plugin ID). |
| `store/pluginStore.ts` | Expanded plugin metadata (description, homepage, changelog path, settings schema, enabled state). New actions for per-plugin lifecycle. |
| `store/configStore.ts` + `SettingsTab` | Dynamic "Extensions" category populated from plugin-contributed settings schemas. |
| `PluginLoader` (main process) | Granular `loadPlugin()`, `unloadPlugin()`, `reloadPlugin()` methods. Extended metadata reading (README, changelog). |
| Preload / IPC bridge | New channels: `plugin:enable`, `plugin:disable`, `plugin:install`, `plugin:uninstall`, `plugin:detail`, `plugin:readme`, `plugin:changelog`. |
| `src/main/menu.ts` | Menu action `Plugins → Plugin Manager` rewired to open virtual tab instead of dialog. |
| `SessionManager` | Serialize `pluginManager` and `pluginDetail` virtual tabs, including plugin ID for detail tabs. |
| App config path (`novapad`) | Plugin directory at `~/.config/novapad/plugins/`. Requires config path migration (separate task). |

### Downstream (features that depend on this)

| Feature | Impact |
|---------|--------|
| Future online marketplace | List view and detail view will display remote plugins; install flow will download instead of copy. Architecture should accommodate this. |
| Plugin auto-update | Detail tab will show update availability; lifecycle will support updating. |

---

## 6. Out of Scope

- **Online marketplace / registry** — Phase 1 is local-only. No remote search, download, or update from a registry.
- **Plugin auto-update** — No version checking against a remote source.
- **Plugin dependency resolution** — Dependencies are informational only; not automatically installed.
- **Plugin development tools** — No scaffolding CLI, debug mode, or dev-reload watcher.
- **Plugin ratings, reviews, or download counts** — Marketplace features deferred.
- **Plugin recommendations** — No suggestion engine.
- **Plugin categories/tags** — Beyond enabled/disabled filter, no taxonomy in Phase 1.
- **Config path migration** — Renaming `notepad-and-more` to `novapad` is a prerequisite but a separate task/PR.

---

## 7. Assumptions

- The existing virtual tab pattern (`openVirtualTab`) can be extended to support parameterized tabs (plugin detail with plugin ID) without breaking existing singleton tabs.
- Plugins already provide `package.json` with `name`, `version`, `author`, `description`. No changes to existing plugin format are required for basic list/detail functionality.
- Plugin README and changelog are read from `README.md` and `CHANGELOG.md` files in the plugin folder. No additional manifest field is needed for these.
- Plugin settings contribution (`contributeSettings()`) is a new API method that existing plugins don't use yet; adding it is additive and non-breaking.
- The config path will be `~/.config/novapad/` by the time this feature ships (migration handled separately).
- Plugin icons come from `icon.png` in the plugin folder, with a default placeholder used when absent.
- `deactivate()` is optional — plugins that don't export it are simply unloaded without calling a cleanup function.

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Plugin Manager list tab | The virtual tab showing all installed plugins in a searchable list. Singleton — only one can exist. |
| Plugin detail tab | A virtual tab showing the full information for a specific plugin (README, changelog, metadata, actions). Multiple can coexist. |
| Virtual tab | A tab backed by an in-memory buffer with no file on disk, identified by a `kind` field (e.g., `'settings'`, `'pluginManager'`, `'pluginDetail'`). |
| Granular lifecycle | The ability to load, unload, or reload a single plugin without affecting other plugins. |
| Plugin manifest | The `package.json` file in a plugin's root folder, containing metadata (name, version, author, description). |
| Settings contribution | A plugin declaring a settings schema via `api.contributeSettings()` so its configuration appears in the Settings page under "Extensions". |
| Copy-based install | Installing a plugin by copying its folder into the plugins directory, rather than symlinking or referencing the original location. |
