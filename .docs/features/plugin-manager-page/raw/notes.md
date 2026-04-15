# Plugin Manager — Dialog to Page Conversion

## Raw Brainstorm Notes

### Core Idea

Convert the Plugin Manager from a modal dialog (`PluginManagerDialog.tsx`) to a full virtual tab/page, following the same pattern as Settings (`SettingsTab`). Additionally, redesign the UI/UX to match VS Code's Extensions panel.

---

### Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout pattern | VS Code Extensions style | User preference; proven UX pattern for extension management |
| Plugin source (Phase 1) | Local-only (`~/.config/novapad/plugins/`) | Keep scope manageable; design for marketplace expansion later |
| Plugin settings | Contribute to Settings page (new "Extensions" category) | Matches VS Code pattern; keeps settings centralized |
| Detail view | Opens as separate virtual tab per plugin | Can open multiple plugin details simultaneously, like VS Code |
| Enable/Disable effect | Granular per-plugin reload (not reload-all) | Better UX; avoid disrupting other loaded plugins |
| Install mechanism | "Install from Folder" — app copies files into plugins dir, then auto-loads | Simple for end users; plugin developers can re-install after changes |
| Config path | `~/.config/novapad/plugins/` (rename from `notepad-and-more`) | App rebranding to "novapad" — separate concern but affects plugin path |
| Multiple detail tabs | Yes, each plugin detail is its own virtual tab | Consistent with VS Code; allows comparing plugins side-by-side |

---

### Features (Phase 1)

#### 1. Plugin Manager Page (virtual tab)

- **List View** (main page, like VS Code extensions sidebar)
  - Search bar at top (filter by name, author, description)
  - Each plugin item shows: icon (or placeholder), name, author, short description, version
  - Quick action buttons inline: Enable/Disable toggle, Uninstall
  - Filter tabs or dropdown: All, Enabled, Disabled
  - "Install from Folder..." button to browse and install local plugins
  - "Reload Plugin" per-plugin action

- **Detail View** (separate virtual tab per plugin)
  - Opened by clicking a plugin in the list
  - Virtual tab kind: `'pluginDetail'` (parameterized with plugin ID)
  - Tab title: plugin name
  - Content:
    - Header: icon, name, version, author, enable/disable button, uninstall button
    - README / description (rendered markdown if available)
    - Changelog section
    - Plugin metadata: version, author, homepage URL, license
    - Dependencies (informational, no resolution in Phase 1)
  - If plugin provides settings → link/button to jump to Settings page Extensions section

#### 2. Plugin Settings in Settings Page

- New category "Extensions" in SettingsTab
  - Sub-sections per plugin that contributes settings
  - Plugin defines its settings schema via `activate(api)` — api exposes `contributeSettings(schema)`
  - Settings auto-save like other config (debounced 500ms via configStore)

#### 3. Granular Plugin Lifecycle

- Enable plugin → load only that plugin, call `activate(api)`
- Disable plugin → call `deactivate()` if defined, unload that plugin only
- Reload plugin → deactivate + re-activate single plugin
- Install → copy folder to plugins dir → auto-load → show in list
- Uninstall → deactivate → remove from plugins dir → remove from list

---

### User Stories

1. **As a user**, I want to see all installed plugins in a dedicated page so I can manage them without a blocking modal.
2. **As a user**, I want to click a plugin to see its full details (description, changelog) in a new tab so I can evaluate it.
3. **As a user**, I want to enable/disable a plugin without restarting the app or affecting other plugins.
4. **As a user**, I want to install a plugin by selecting a folder so I don't need to manually copy files.
5. **As a user**, I want to search/filter plugins by name so I can quickly find what I need.
6. **As a user**, I want to configure plugin-specific settings in the Settings page so all settings are in one place.
7. **As a user**, I want to uninstall a plugin and have it fully removed.

---

### Business Rules

- Only one Plugin Manager list tab can be open at a time (same as Settings)
- Multiple plugin detail tabs can be open simultaneously
- Plugin detail tabs show the plugin name as tab title
- Enable/Disable takes effect immediately (granular reload, no app restart)
- "Install from Folder" copies the plugin folder into `~/.config/novapad/plugins/` then auto-loads it
- Plugin settings appear in Settings page only when the plugin is enabled
- Virtual tabs for plugin details should not show dirty indicator (read-only view)

---

### Dependencies

- **editorStore** — needs new virtual tab kinds: `'pluginManager'` and `'pluginDetail'`
- **pluginStore** — needs expansion: per-plugin enable/disable state, plugin metadata (description, homepage, changelog), settings schema
- **PluginLoader (main process)** — needs granular load/unload/reload per plugin (currently only `reloadPlugins()` for all)
- **Plugin API** — needs `contributeSettings(schema)` method for plugins to declare their settings
- **configStore / SettingsTab** — needs dynamic "Extensions" category populated from plugin-contributed settings
- **Preload** — needs new IPC channels: `plugin:enable`, `plugin:disable`, `plugin:install`, `plugin:uninstall`, `plugin:detail`
- **App rebranding** — config path change from `notepad-and-more` to `novapad` (separate task, but blocking for plugin path)

---

### Out of Scope (Phase 1)

- Online marketplace / registry
- Plugin auto-update checking
- Plugin dependency resolution (install deps automatically)
- Plugin development tools (scaffolding, debugging)
- Plugin ratings / reviews / download counts
- Plugin recommendations
- Plugin grouping / categories (beyond enabled/disabled filter)

---

### Open Questions

1. **App rebranding scope** — Is `notepad-and-more` → `novapad` a full rebrand (app name, window title, package.json, etc.) or just config path? Should this be a separate feature/PR?
2. **Plugin manifest format** — What metadata should a plugin's `package.json` (or manifest) include? (name, version, author, description, homepage, changelog, icon, settingsSchema?)
3. **Plugin icon** — Where does the icon come from? Plugin folder? Or just use a default placeholder?
4. **README/Changelog source** — Read `README.md` and `CHANGELOG.md` from the plugin folder? Or from manifest metadata?
5. **Migration** — If user has plugins in old `~/.config/notepad-and-more/plugins/`, auto-migrate to `~/.config/novapad/plugins/`?

---

### Technical Notes

- Follow existing virtual tab pattern: `editorStore.openVirtualTab('pluginManager')` for list, parameterized version for details
- Plugin detail tabs need a way to encode plugin ID in the buffer (extend Buffer type or use a map)
- SettingsTab currently has hardcoded categories — need to make it extensible for plugin-contributed sections
- PluginLoader currently returns basic `PluginInfo` (name, version, author, status) — needs to return full metadata
- Consider lazy-loading plugin README/changelog content (read from disk on demand, not at startup)
