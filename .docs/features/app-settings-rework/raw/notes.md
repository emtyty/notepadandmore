# App Settings Rework — Brainstorm Notes

## Core idea
Rework how Settings is surfaced in the app:
1. Drop the `Settings` top-level menu everywhere (native macOS menu + custom MenuBar).
2. On macOS, expose `Settings…` inside the App menu (standard macOS convention).
3. On all platforms (macOS + Windows), add a gear icon on the right side of the MenuBar / title area. Click → dropdown: `Toggle Dark/Light Mode` · separator · `Keyboard Shortcuts` · `Settings`.
4. Replace the `PreferencesDialog` modal with a VS Code–style Settings editor tab.

Platform support: **macOS and Windows only** (Linux explicitly out of scope).

---

## Decisions (confirmed with user)

### Menu surface
- **Native macOS menu**: remove the entire `Settings` top-level menu. Add a `Settings…` item in the `App` (NovaPad) menu after `About` — standard macOS placement.
- **Custom MenuBar (Windows)**: remove the entire `Settings` top-level menu. Settings is only reachable via the new gear icon.
- **Right-side icons (MenuBar)**: remove `Search` icon and `Theme Toggle` icon. Add `Settings` (gear) icon. Toggle Sidebar icon decision → see open questions.
- **Gear icon behavior**: click opens a small dropdown with:
  - `Toggle Dark Mode` / `Toggle Light Mode` (label flips based on current theme)
  - *(separator)*
  - `Keyboard Shortcuts`
  - `Settings`
- Removed from UI entirely: `User Defined Languages…`, `Style Configurator…`.

### Settings as an editor tab (VS Code style)
- Real editor tab — shows in TabBar, can be closed, reopened, survives session restore.
- Clicking Settings again when the tab exists → **focus** the existing tab (no duplicate).
- Tab shows "Settings" label + gear icon, no file path.
- **No dirty indicator** — changes auto-save live on every change (matches existing `PreferencesDialog` behavior and VS Code).
- **Replaces `PreferencesDialog.tsx` entirely** — the modal is deleted, not kept as a fallback.

---

## Default decisions for round-2 questions (user chose to skip → reasonable defaults applied, flagged in PRD)

1. **Settings tab contents** — same config surface as current `PreferencesDialog` (General / Editor / Appearance / New Document / Backup / Auto-Completion). No JSON edit view in v1. Rationale: scope control; matches current surface.
2. **Keyboard Shortcuts menu item** — opens a separate editor tab (its own gear icon variant). In v1 the tab renders a **placeholder / coming-soon** view since the current menu item is disabled. Rationale: preserves navigation surface without building the full editor yet. *If user prefers "keep disabled", flip the item to disabled in the gear dropdown.*
3. **Toggle Sidebar icon** — **keep it**. It's unrelated to Settings and still useful as a quick toggle.
4. **Gear interaction** — click opens dropdown (not direct open). Confirmed by user wording.
5. **`Cmd/Ctrl+,`** — keeps working, opens Settings tab directly (skips the dropdown).
6. **Session restore** — Settings tab persists across restarts (VS Code behavior). Stored as a virtual buffer with `kind: 'settings'` / no file path.
7. **Tab positioning** — opens at the end of tab list; user can drag-reorder alongside file tabs.
8. **Split view** — currently disabled globally, so moot.

---

## Classified requirements

### Features
- F1: Menu consolidation (drop Settings top-level, add App-menu entry on macOS)
- F2: Right-side gear icon + dropdown in MenuBar
- F3: Settings editor tab (replaces PreferencesDialog)
- F4: Keyboard Shortcuts tab stub
- F5: Session persistence of Settings tab

### User stories
- US-1: As a macOS user, I open Settings via the standard `NovaPad → Settings…` menu.
- US-2: As a Windows user, I click the gear icon in the menu bar and pick `Settings`.
- US-3: As a user, I toggle dark/light mode from the gear dropdown.
- US-4: As a user editing settings, I see changes apply instantly without clicking Save.
- US-5: As a user, I close the Settings tab like any other file tab, and reopen it via the gear.
- US-6: As a user, when I restart the app, the Settings tab reopens if it was open.
- US-7: As a user, clicking Settings when the tab is already open focuses it instead of opening a duplicate.
- US-8: As a user, pressing `Cmd/Ctrl+,` opens the Settings tab directly.

### Business rules
- BR-1: At most one Settings tab may exist at a time.
- BR-2: Settings tab is a virtual buffer with `kind: 'settings'`, no file path, no dirty state.
- BR-3: Changes in Settings tab write through to the app config store immediately (live save).
- BR-4: Settings icon dropdown contains exactly: theme toggle, separator, Keyboard Shortcuts, Settings.
- BR-5: macOS `Settings…` menu item lives under the App menu; the `Settings` top-level menu does not exist on any platform.
- BR-6: Linux is not supported in this release.

### Dependencies
- Existing Zustand stores: `uiStore` (theme, `showPreferences`), `configStore` (persisted app config).
- TabBar + EditorPane buffer model (`store/editorStore.ts`) — needs a virtual buffer kind.
- SessionManager (`src/main/sessions/SessionManager.ts`) — must serialize/restore virtual tab.
- Native menu (`src/main/menu.ts`) + custom MenuBar (`src/renderer/src/components/editor/MenuBar.tsx`).

### Out of scope
- Linux menu support.
- JSON-editing view for settings (VS Code's "Edit in settings.json").
- Full Keyboard Shortcuts editor UI (only a stub tab in v1).
- Keeping old `PreferencesDialog.tsx` as a fallback.
- Settings search bar inside the tab (can add later).
- Per-workspace settings.

---

## Open questions (to revisit)
- Should `Keyboard Shortcuts` menu item be **stub tab** (default) or **disabled** (alternative)? PRD assumes stub tab.
- Should the gear dropdown also surface `About NovaPad` on Windows (since we're relocating things)? Not in current scope.
