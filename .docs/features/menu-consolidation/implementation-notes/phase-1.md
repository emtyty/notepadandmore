# Phase 1: Foundation — Completion Note

**Status:** Completed
**Date:** 2026-04-12

## What was done
- 1.1: Added `ui:state-changed` to preload `api.send` allowlist
- 1.2: Added stable `id` to 7 native menu checkbox items (toggle-toolbar, toggle-statusbar, toggle-sidebar, toggle-word-wrap, toggle-whitespace, toggle-indent-guides, toggle-split-view)
- 1.3: Set `enabled: false` on stubbed items: Bookmarks (4 items), Split View, Shortcut Mapper, UDL Editor, Style Configurator, Macro Start/Playback (Stop was already disabled), Plugin Manager
- 1.4: Changed `autoHideMenuBar` to `process.platform !== 'darwin'`
- 1.5: Added 5 new toggle fields to uiStore: `wordWrap`, `renderWhitespace`, `indentationGuides`, `columnSelectMode`, `splitView`
- 1.6: Added `fromMain?: boolean` parameter to all 8 toggle setters
- 1.7: Added `syncToggleToMain(key, value)` action that sends `ui:state-changed` IPC
- 1.8: Registered `ui:state-changed` IPC listener in main process with key→menuId lookup map

## Verification results
- [x] `npm run build` compiles with no errors
- [x] No behavioral changes — app runs identically

## Commits
**Branch:** `novapad`
| File | Commit | Message |
|------|--------|---------|
| 4 files | `28f4c6c` | feat(core): add menu consolidation foundation — IPC, store, native menu IDs |

## Pending / Known issues
None.

## Notes for next phase
- Phase 2 (Bidirectional Sync): The `syncToggleToMain` calls are already wired into setters. Task 2.2 is effectively done. Phase 2 mainly needs to wire `fromMain: true` in App.tsx IPC handlers and handle `editor:set-option` toggles.
- Phase 3 (QuickStrip): uiStore fields ready. Just need the platform guard and new component.
- Phase 4 (MenuBar): MenuItem interface extension and new menus are the bulk of work.
- Phase 5 (Context Menu): Independent, can proceed.
