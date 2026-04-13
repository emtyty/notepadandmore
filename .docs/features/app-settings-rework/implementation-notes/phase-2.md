# Phase 2: IPC + Native Menu Rework — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

- **P2.1** — Deleted the entire top-level `&Settings` menu block from `src/main/menu.ts` (previously lines ~304–335). Same removal applies to macOS, Windows, and Linux builds because the template is shared.
- **P2.2** — Added `Settings…` to the macOS App menu, sitting between `About` and the first `services` separator. Accelerator is `CmdOrCtrl+,`; click dispatches `menu:settings-open`.
- **P2.3** — On non-macOS (Windows + Linux), registered a **hidden** menu item (`visible: false`) inside the Help menu labeled `Open Settings` with accelerator `CmdOrCtrl+,`. Electron still fires accelerators for hidden items, so `Ctrl+,` works without a visible entry. Chose this over `before-input-event` because it's declarative, automatically appears in any "show accelerators" dialog if we add one later, and matches the shape of other accelerators in this file.
- **P2.4** — Updated `src/preload/index.ts` allowlist (both `on` and `off` arrays):
  - **Added**: `menu:settings-open`, `menu:shortcuts-open`.
  - **Removed**: `menu:preferences`, `menu:shortcut-mapper`, `menu:udl-editor`, `menu:style-configurator`.
- **P2.5** — Grep-audited `src/` for orphan references to the removed channels. Found four stale listeners (and their matching `.off()` cleanups) in `App.tsx` and deleted them. Zero remaining references after cleanup.

## Verification results

- [x] `npx electron-vite build` succeeds (all three bundles).
- [x] `grep -rE "menu:preferences|menu:shortcut-mapper|menu:udl-editor|menu:style-configurator" src/` returns zero matches.
- [x] No new pre-existing typecheck errors introduced.
- [ ] Manual verification on macOS/Windows — **deferred**: the feature is not user-visible yet (no renderer listener for `menu:settings-open` in Phase 2). Phase 4 wires up the listener and will verify `Cmd+,` / `Ctrl+,` round-trip end-to-end (tests T1, T8, T29, T30).
- [ ] Sub-agent review — deferred to Phase 4 final sweep.

## Unit tests

No new tests in Phase 2. The changes are declarative menu configuration and an allowlist update — `grep` audits and the build verify them. Test T23 (allowlist rejection of removed channels) and T24 (allowlist acceptance of new channels) run in Phase 4 when the renderer listener exists to observe them.

## Commits

| Commit | Message |
|--------|---------|
| `fc68f09` | refactor(core): drop Settings top-level menu; add macOS Settings… + Windows Ctrl+, accel |
| `c62009c` | refactor(core): update IPC allowlist for settings rework |

## Pending / Known issues

- **`menu:settings-open` currently has no renderer listener.** Clicking `App → Settings…` on macOS or pressing `Cmd+,` / `Ctrl+,` will dispatch the IPC event, but nothing happens in the UI until Phase 4 wires up `App.tsx`. This is expected per the phase boundary and recorded in the plan.
- **`showPreferences` / `setShowShortcutMapper` / `setShowUDLEditor` / `setShowStyleConfigurator` still exist on `uiStore`.** The IPC triggers that would call them are removed, so they are effectively dead code now. Phase 3 deletes the store flags alongside the dialog components per BR-006.
- **Dialog components still on disk.** `PreferencesDialog.tsx`, `ShortcutMapperDialog.tsx`, `UDLEditorDialog.tsx`, `StyleConfiguratorDialog.tsx` are still mounted from `App.tsx` (via `showXxx` booleans that can no longer flip to true) — they render nothing. Deleted in Phase 3.

## Notes for next phase

- The `menu:settings-open` and `menu:shortcuts-open` channels are ready to be consumed. In Phase 4's `App.tsx` effect, register `window.api.on('menu:settings-open', () => editorStore.getState().openVirtualTab('settings'))` and the `'menu:shortcuts-open'` equivalent.
- The `openVirtualTab` helper from Phase 1 already handles the singleton-focus semantics (US-007, US-009), so the listeners don't need their own de-duping logic.
- When Phase 3 removes `PreferencesDialog.tsx` it should also audit `uiStore` for `showPreferences`, `showShortcutMapper`, `showUDLEditor`, `showStyleConfigurator` and their setters — all of those are now orphaned after Phase 2.
