# Phase 2: Bidirectional State Sync — Completion Note

**Status:** Completed
**Date:** 2026-04-12

## What was done
- 2.1: Wired `fromMain: true` on IPC toggle handlers in App.tsx (ui:toggle-toolbar, ui:toggle-statusbar, ui:toggle-sidebar). Also synced editor:set-option IPC (wordWrap, renderWhitespace, indentation guides) to uiStore with fromMain flag.
- 2.2: Already done in Phase 1 — setters call syncToggleToMain when fromMain is falsy.
- 2.3: Main process IPC listener (from Phase 1) maps UIToggleKey → native menu ID and sets checkbox state. Also synced toggleColumnSelect command to uiStore.

## Verification results
- [x] `npm run build` compiles with no errors

## Commits
| Commit | Message |
|--------|---------|
| `be00172` | feat(core): wire bidirectional state sync for menu toggles |

## Pending / Known issues
None.
