# Phase 3: Virtual-Tab Views + Remove PreferencesDialog — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

- **P3.1** — Created `src/renderer/src/components/SettingsTab/SettingsTab.tsx`. It ports the six categories from the legacy `PreferencesDialog` (General, Editor, Appearance, New Document, Backup/AutoSave, Auto-Completion) into a full-pane, non-modal view. Inputs read directly from `useConfigStore()` and write via `config.setProp(...)` on every change — no local form state, no Save button, no dirty indicator. The existing `Row` / `CheckRow` helpers were inlined as private helpers.
- **P3.2** — Created `src/renderer/src/components/ShortcutsTab/ShortcutsTab.tsx`. Static placeholder that shows a keyboard icon and a "coming soon" message. No interactive controls.
- **P3.3** — `App.tsx` now derives `activeKind` from the active buffer and **overlays** the virtual tab view on top of `EditorPane` using `absolute inset-0 z-10`. This keeps Monaco mounted underneath so switching between a file tab and a virtual tab does not dispose or reinitialize the editor — file view state (cursor, scroll) is preserved. `StatusBar` is hidden while a virtual tab is active (it has nothing meaningful to show).
- **P3.4** — `TabBar` gained virtual-tab awareness: a gear icon for `settings` and a keyboard icon for `shortcuts`, tooltip shows the tab title only (no file path), the dirty dot is suppressed for virtual tabs, and the context menu shows close-family only (`Close`, `Close Others`, `Close All`) — `Copy File Path` / `Reveal in Explorer` are hidden for virtual tabs. Drag-reorder works identically to file tabs (no changes needed).
- **P3.5** — Deleted four dialog directories: `Preferences`, `ShortcutMapper`, `StyleConfigurator`, `UDLEditor`. Removed their imports and mount sites from `App.tsx`. ShortcutMapper/StyleConfigurator/UDLEditor were orphaned after Phase 2 — cleaned up as part of this phase per the Phase 2 note's handoff list.
- **P3.6** — Dropped `showPreferences` / `showShortcutMapper` / `showUDLEditor` / `showStyleConfigurator` and their setters from `uiStore`. Retargeted the two remaining callers:
  - `SideNav.tsx` "preferences" nav item → `useEditorStore.getState().openVirtualTab('settings')`.
  - `MenuBar.tsx` Settings submenu's `Preferences...` entry → same call; relabelled to `Settings`. The whole MenuBar Settings submenu goes away in Phase 4; keeping the retargeted entry in the interim so the Windows custom menu still works during partial builds.

## Verification results

- [x] `npx electron-vite build` succeeds.
- [x] `grep` audits return zero matches for removed symbols:
  - `showPreferences|setShowPreferences|showShortcutMapper|setShowShortcutMapper|showUDLEditor|setShowUDLEditor|showStyleConfigurator|setShowStyleConfigurator` → 0.
  - `PreferencesDialog|ShortcutMapperDialog|UDLEditorDialog|StyleConfiguratorDialog` → 0.
- [x] App.tsx dialogs section now mounts only FindReplace / PluginManager / About / Toaster / SonnerBridge.
- [ ] Playwright CT for SettingsTab / ShortcutsTab / TabBar virtual-tab rendering — **not executed**. The repo has E2E tests (Playwright with built app) but no component-test harness set up. Virtual-tab behavior will be exercised end-to-end by Phase 4's tests (T4–T14, T20, T21, T22, T26).
- [ ] Sub-agent review — deferred to Phase 4 final sweep.

## Unit tests

No new unit tests in Phase 3. The changes are React components and a small reroute; no data-shape or migration logic to exercise directly. All behavior is covered by the E2E cases in `tests.md` that Phase 4 runs.

## Commits

| Commit | Message |
|--------|---------|
| `dae1400` | feat(core): add SettingsTab and ShortcutsTab virtual-tab views |
| `2defafc` | feat(core): route virtual tabs and teach TabBar about BufferKind |
| `d577de5` | refactor(core): remove legacy Preferences and disabled-feature dialogs |

## Pending / Known issues

- **Not yet reachable by user action.** The Settings tab is still only reachable from the Windows MenuBar's Settings submenu (which gets deleted in Phase 4) and from the SideNav "preferences" item. Neither the macOS App-menu entry nor the Windows `Ctrl+,` accelerator have a renderer listener yet — Phase 4's task 4.6 wires those up.
- **Monaco layout interaction with overlay.** When switching from a virtual tab back to a file tab Monaco has been layout-dormant during the overlay's presence. Testing on macOS and Windows (Phase 4) should confirm there's no layout glitch; if there is, `editor.layout()` on tab-switch is the fix.
- **`Sidebar` `'search'` type mismatch** — pre-existing typecheck error (also caught in the Phase 1 typecheck pass) is unchanged. Not related to this feature.

## Notes for next phase

- `openVirtualTab('settings')` is now the one and only way to open the Settings tab. Phase 4's gear dropdown and IPC listeners should both call it.
- `editorStore` no longer exports anything that was added specifically for Phase 3 — `openVirtualTab` was already in place from Phase 1.
- When Phase 4 rewrites `MenuBar.tsx` it will delete the `Settings` submenu (and its `useEditorStore` import becomes unused — remove it then).
- `SideNav.tsx`'s "preferences" item currently uses the `Settings` icon — that stays.
- All dialog-related uiStore state for the three removed dialogs is gone, so nothing else in the code can put the app into "showing that dialog" state. Safe to delete.
