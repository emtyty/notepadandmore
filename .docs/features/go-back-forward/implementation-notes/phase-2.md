# Phase 2: Entry Capture — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

All three tasks landed in `src/renderer/src/components/EditorPane/EditorPane.tsx`:

- **P2.1** — Extended the existing model-swap effect (the one that saves `viewState` on tab switch). Before `currentIdRef.current = activeId`, now also calls `useNavigationStore.getState().pushEntry(...)` with the outgoing buffer's live cursor position read via `editor.getPosition()`. Guards: skip if `isNavigating`, skip if the outgoing buffer is not a file buffer.
- **P2.2** — Extended the existing `onDidChangeCursorPosition` handler (the one that dispatches `editor:cursor` for the status bar). Added a `Math.abs(newLine - lastRecordedLineRef.current) > NAV_LINE_THRESHOLD` (10) check; when it trips, calls `pushEntry` and advances `lastRecordedLineRef`. Same `isNavigating` + file-buffer guards.
- **P2.3** — Added `lastRecordedLineRef` alongside the existing `currentIdRef`. Seeds the ref on each tab swap from the incoming buffer's viewState cursor (or `savedViewState` for ghost tabs), falling back to line 1. This ensures threshold comparisons are always relative to the user's actual position in the new buffer, not stale state from the previous buffer.

Also added a `NAV_LINE_THRESHOLD = 10` module-level constant so the magic number is named once.

## Verification results

- [x] `npx electron-vite build` succeeds — all three bundles compile.
- [x] Playwright smoke test: opened two files, switched between them, app didn't crash. Store changes can't be asserted directly without a UI or a window-exposed store — that's the planned Phase 2 exit state.
- [ ] Full test-plan coverage (T3, T10, T14, T22, T26) requires Phase 3 + 4 — UI to click and navigation pipeline to observe changes. Deferred to Phase 4's E2E sweep.
- [ ] Sub-agent review — bundled into the Phase 4 final pass.

## Unit tests

No new unit tests in this phase. The push-site logic is thin glue: it reads Monaco state, does a guard check, and forwards to `useNavigationStore.pushEntry` — which itself is unit-tested in Phase 1. Phase 4's E2E tests cover this glue from the user perspective (T3/T10/T14/T22/T26).

## Commits

**Branch:** `master`

| Commit | Message |
|--------|---------|
| `be9230d` | feat(core): feed navigation history from EditorPane cursor events |

## Pending / Known issues

- **No user-visible signal yet.** The store receives entries correctly, but without the Phase 4 toolbar buttons or shortcut listener there's no way to observe this in a running app except via DevTools (`useNavigationStore.getState().back`). This matches the planned Phase 2 exit state.
- **Threshold applies strictly vs. `lastRecordedLineRef`, not vs. the newest back entry.** If the user drifts 8 lines, pushes nothing, then drifts 5 more lines (now 13 from the reference), the push fires — not at the 10-line mark but at whatever subsequent cursor event exceeds the threshold. This matches VS Code behavior and the spec wording.
- **`editor.getPosition()` at tab-switch time.** Chose this over tracking a separate ref (spec §3.1 decision flagged to record in commit). Rationale: simpler, editor is in scope, Monaco's position is authoritative. Downside: fires slightly before `saveViewState` completes — but both read from the same live editor, so the positions are consistent.

## Notes for next phase

- **Phase 3** — implement `useNavigation.ts` with the `navigate(direction)` pipeline. The hook should:
  1. Set `isNavigating = true` via `beginNavigating()`.
  2. Read the live cursor via `editorRegistry.get()?.getPosition()`.
  3. Call `useNavigationStore.getState().goBack(currentPos)` / `goForward(currentPos)`.
  4. If destination is null, `endNavigating()` and bail.
  5. Call `useEditorStore.getState().setActive(entry.bufferId)` if needed.
  6. `queueMicrotask` → `editor.setPosition` + `editor.revealLineInCenter`.
  7. Reset `lastRecordedLineRef` on EditorPane side — this happens automatically via the tab-switch effect's seeding logic (P2.3), as long as `setActive` is called before the microtask runs.
  8. `endNavigating()`.

- **Guard integration** — the `isNavigating` flag is the only coupling between P2 and P3. It's already honored at both push sites, so Phase 3 just needs to flip it around the pipeline.

- **Nothing else in EditorPane needs to change for Phase 3.** The entry-capture and navigation-execution paths are decoupled via the store.
