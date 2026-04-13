# App Settings Rework — Overview

## 1. Description

Rework how application settings are accessed and displayed in NovaPad. The legacy `Settings` top-level menu and modal `PreferencesDialog` are replaced by (a) a standard macOS `App → Settings…` entry, (b) a gear icon on the right of the MenuBar that opens a small dropdown (theme toggle, Keyboard Shortcuts, Settings), and (c) a VS Code–style Settings editor tab that lives alongside file tabs. Applies to **macOS and Windows only**.

> 📋 See [Specification](./spec.md) for IPC, buffer-kind contract, and migration details (to be written).

---

## 2. Features

| ID | Feature | Priority | Stories | Description |
|----|---------|----------|---------|-------------|
| F1 | Menu consolidation | Must Have | US-001, US-002 | Drop `Settings` top-level menu; add `Settings…` under macOS App menu. |
| F2 | Gear icon dropdown | Must Have | US-002, US-003 | Right-side gear icon with Theme toggle / Keyboard Shortcuts / Settings menu. |
| F3 | Settings editor tab | Must Have | US-004, US-005, US-007, US-008 | Virtual tab replacing `PreferencesDialog`, auto-saves changes live. |
| F4 | Session persistence for Settings tab | Should Have | US-006 | Settings tab survives app restart when it was open at close. |
| F5 | Keyboard Shortcuts tab (stub) | Could Have | US-009 | Placeholder tab opened from gear menu; full editor deferred. |

---

## 3. User Stories

### Actors

| Actor | Description |
|-------|-------------|
| macOS user | Runs NovaPad on macOS; expects native `App → Settings…` convention. |
| Windows user | Runs NovaPad on Windows; uses custom in-app MenuBar. |

### Stories

#### US-001: Open Settings from macOS App menu
> **As a** macOS user, **I want to** open Settings from `NovaPad → Settings…`, **so that** the app follows standard macOS conventions.

**Acceptance Criteria:**
- [ ] The `Settings` top-level menu does not appear in the macOS menu bar.
- [ ] `NovaPad → Settings…` exists with shortcut `Cmd+,`.
- [ ] Selecting it opens the Settings editor tab (see US-004).

#### US-002: Open Settings from gear icon (both platforms)
> **As a** user on macOS or Windows, **I want to** click a gear icon to access settings-related actions, **so that** I don't need to hunt through menus.

**Acceptance Criteria:**
- [ ] A gear icon is visible on the right side of the MenuBar / title bar area on both macOS and Windows.
- [ ] The old `Search` icon and `Theme Toggle` icon are no longer rendered in that area.
- [ ] Clicking the gear opens a dropdown with: `Toggle Dark/Light Mode`, separator, `Keyboard Shortcuts`, `Settings`.
- [ ] Clicking outside the dropdown dismisses it.

#### US-003: Toggle theme from the gear dropdown
> **As a** user, **I want to** toggle dark/light mode from the gear menu, **so that** theme switching is one click away.

**Acceptance Criteria:**
- [ ] The dropdown label reads `Toggle Dark Mode` when in light theme and `Toggle Light Mode` when in dark theme.
- [ ] Clicking the entry toggles the theme instantly and persists the choice (same behavior as the removed toolbar button).
- [ ] The dropdown closes after the click.

#### US-004: Edit settings in an editor tab, with live save
> **As a** user editing app settings, **I want to** change values and see them apply instantly, **so that** I don't need to click Save.

**Acceptance Criteria:**
- [ ] Selecting `Settings` from the gear dropdown (or the macOS App menu, or pressing `Cmd/Ctrl+,`) opens the Settings editor tab.
- [ ] The tab title is `Settings` and shows a gear icon; no file path is displayed.
- [ ] The tab renders the same categories as the legacy `PreferencesDialog`: General, Editor, Appearance, New Document, Backup/AutoSave, Auto-Completion.
- [ ] Changing any setting persists to the config store immediately (no Save button).
- [ ] The tab never shows a dirty indicator.
- [ ] The legacy `PreferencesDialog` modal is removed and cannot be opened.

#### US-005: Close and reopen the Settings tab
> **As a** user, **I want to** close the Settings tab like a file, and reopen it later, **so that** it behaves like any other tab.

**Acceptance Criteria:**
- [ ] The Settings tab has an `X` close button and closes with `Cmd/Ctrl+W`.
- [ ] After closing, selecting `Settings` from the gear reopens it.
- [ ] Only one Settings tab may exist at any time; clicking `Settings` while it is open focuses the existing tab instead of creating a duplicate.

#### US-006: Session restore
> **As a** user, **I want to** have the Settings tab reopen if it was open when I quit, **so that** my workspace is preserved.

**Acceptance Criteria:**
- [ ] If the Settings tab is open when the app closes, it reopens on next launch.
- [ ] If the Settings tab was the active tab at close, it is active on restore.
- [ ] Restoring does not produce duplicate tabs when restore runs alongside user actions.

#### US-007: Reorder the Settings tab
> **As a** user, **I want to** drag the Settings tab to reorder it among my open tabs, **so that** I control my layout.

**Acceptance Criteria:**
- [ ] The Settings tab can be dragged and reordered in the TabBar like a file tab.
- [ ] Reorder position persists across session restore.

#### US-008: Keyboard shortcut to open Settings
> **As a** user, **I want to** press `Cmd/Ctrl+,` to jump straight to Settings, **so that** it's quick to reach.

**Acceptance Criteria:**
- [ ] `Cmd+,` (macOS) and `Ctrl+,` (Windows) open the Settings tab directly, bypassing the dropdown.
- [ ] If the tab is already open, the shortcut focuses it.

#### US-009: Keyboard Shortcuts entry in gear dropdown (stub)
> **As a** user, **I want to** see a Keyboard Shortcuts option in the gear menu, **so that** I know where it will live when implemented.

**Acceptance Criteria:**
- [ ] The gear dropdown lists `Keyboard Shortcuts` between the theme toggle and `Settings` (separator above it).
- [ ] Clicking it opens a `Keyboard Shortcuts` editor tab with a placeholder / "coming soon" view.
- [ ] The placeholder tab follows the same virtual-tab rules as Settings (singleton, closable, session-restorable).

---

## 4. Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-001 | No Settings top-level menu | The `Settings` top-level menu is removed from both the macOS native menu and the Windows custom MenuBar. |
| BR-002 | Singleton virtual tab | At most one Settings tab (and one Keyboard Shortcuts stub tab) may exist at a time. |
| BR-003 | Live save, no dirty state | Settings tab writes each change to the config store immediately; it never displays a dirty marker. |
| BR-004 | Fixed gear dropdown contents | The gear dropdown contains exactly: theme toggle, separator, Keyboard Shortcuts, Settings — nothing else in v1. |
| BR-005 | macOS placement | On macOS, `Settings…` lives in the App (`NovaPad`) menu; `Cmd+,` maps to it. |
| BR-006 | Removed UI surfaces | `Search` icon, theme toggle icon, `User Defined Languages…`, `Style Configurator…`, and `PreferencesDialog` modal are removed from the UI. |
| BR-007 | Platform scope | Feature targets macOS and Windows only. Linux is not a target. |

---

## 5. Dependencies

### Upstream (required by this feature)

| Dependency | Purpose |
|------------|---------|
| `store/editorStore.ts` Buffer model | Needs a virtual buffer kind (e.g., `kind: 'settings' \| 'shortcuts' \| 'file'`) to represent non-file tabs. |
| `store/uiStore.ts` (theme) | Theme toggle wiring reused from the removed toolbar button. |
| `store/configStore.ts` | Persisted config surface rendered inside the Settings tab. |
| `src/main/menu.ts` | macOS menu rebuild (move `Settings…` into App menu, drop top-level). |
| `src/renderer/src/components/editor/MenuBar.tsx` | Remove three right-side icons, add gear icon + dropdown; drop Settings top-menu. |
| `src/main/sessions/SessionManager.ts` | Serialize virtual tabs so session restore works. |
| `src/renderer/src/components/TabBar/TabBar.tsx` | Render virtual-tab icon/label (no file path). |
| `src/renderer/src/components/EditorPane/EditorPane.tsx` | Route virtual tabs to a settings renderer instead of Monaco. |

### Downstream (features that will depend on this)

| Feature | Impact |
|---------|--------|
| Future Keyboard Shortcuts editor | Will replace the stub tab introduced in F5. |
| Future plugin settings surface | Plugins will need a way to register settings panels in the Settings tab. |

---

## 6. Out of Scope

- **Linux support** — macOS + Windows only in this release.
- **JSON-edit view** for raw `config.json` (VS Code's "Edit in settings.json") — UI form only.
- **Full Keyboard Shortcuts editor** — stub tab only; real editor deferred.
- **Settings search bar** inside the tab.
- **Per-workspace settings** — still global.
- **Keeping `PreferencesDialog` as a fallback** — it is fully removed.
- **Split view of Settings tab** — split is globally disabled; not in scope.
- **Reworking the existing `About`, `Plugin Manager`, or other dialogs** — they remain dialogs.

---

## 7. Assumptions

- The `Cmd/Ctrl+,` accelerator is safe to rebind to the new tab-open action (no existing conflict).
- The current `PreferencesDialog` surface is still the right set of configurable options; no new settings are added in this release.
- `Toggle Sidebar` icon on the right side of the MenuBar stays — only `Search` and theme toggle are removed.
- The TabBar's drag-reorder implementation is buffer-agnostic enough to support virtual tabs with minor adjustments.
- Session restore can safely skip loading file contents for virtual tabs (no disk I/O for them).

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Virtual tab | A tab backed by an in-memory buffer with no file path, identified by a `kind` field (e.g., `settings`, `shortcuts`). |
| Gear dropdown | The small menu anchored to the gear icon on the right of the MenuBar. |
| Live save | Pattern where each user edit is persisted to storage immediately, eliminating a Save action and a dirty indicator. |
| MenuBar | Custom in-app menu component (`src/renderer/src/components/editor/MenuBar.tsx`) shown on Windows only; hidden on macOS in favor of the native menu. |
| App menu | On macOS, the first menu in the menu bar labeled with the application name (`NovaPad`). |
