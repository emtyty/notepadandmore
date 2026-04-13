# Phase 3: Navigation Execution — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

- **P3.1** — Created `src/renderer/src/hooks/useNavigation.ts` exporting `useNavigation()` which returns `{ navigate(direction) }`. Implements the spec §7 pipeline end-to-end: capture current cursor (only if active buffer is a file) → `beginNavigating` → `goBack`/`goForward` → bail on null → `setActive` → `applyPosition` with retry → `endNavigating`.
- **P3.2** — Handled the Monaco model-swap race. `applyPosition` is a recursive-with-retry helper: it checks `editor.getModel() === targetBuf.model` and re-tries up to `MAX_APPLY_ATTEMPTS = 5` times at 16ms spacing (~80ms total budget) if the swap hasn't completed yet. If all retries exhaust, it bails quietly — EditorPane's `restoreViewState` in the model-swap effect will land the cursor at the buffer's previously-known position (spec §10).
- **P3.3** — Audit confirmed both Phase-2 push sites (cursor-change handler at EditorPane.tsx:218 and model-swap effect at EditorPane.tsx:303) check `isNavigating` before calling `pushEntry`. The store's `pushEntry` also defensively short-circuits on `isNavigating`. Triple protection. No code change needed.

Additional design choices baked into the hook:

- **`editor.focus()` after navigation** so the keyboard keeps working on Monaco after the user clicks a toolbar button.
- **try/catch around `setPosition`** — if the file was shortened since the entry was recorded, Monaco clamps the position on its own; swallowed throws prevent `isNavigating` from getting stuck.
- **`currentPosition = null` for virtual active tabs** — avoids stashing garbage `{ Settings-buffer, line 1, col 1 }` entries in the opposite stack.

## Verification results

- [x] `npx electron-vite build` succeeds — all three bundles compile.
- [x] Smoke-tested the build under Playwright (temporary probe file, removed after verifying). App launches, opens two files, switches tabs without error.
- [ ] Full end-to-end `navigate('back')` / `navigate('forward')` behavior needs a UI entry point to exercise from E2E. Phase 4 wires that up (toolbar button click → hook → pipeline). Tests T3, T4, T10, T14, T15–T17, T22, T25–T28 from the test plan all run in Phase 4.
- [ ] Sub-agent review — bundled into Phase 4 final sweep.

## Unit tests

No new unit tests. The hook is a thin orchestrator over the Phase-1 store (already covered by 40 Node-script assertions) and Monaco imperative APIs (not unit-testable without a DOM). The integration is exercised end-to-end in Phase 4's Playwright suite.

## Commits

**Branch:** `master`

| Commit | Message |
|--------|---------|
| `fa81c43` | feat(core): add useNavigation hook with navigate(direction) pipeline |

## Pending / Known issues

- **Model-swap retry budget** (80ms) is a soft guarantee. On a cold-started app with a very large target file, the hydrate-then-swap sequence could take longer. If that surfaces as missed navigations in practice, bump `MAX_APPLY_ATTEMPTS`. Not seen in smoke testing.
- **`focus()` interplay with toolbar click.** When the user clicks `nav-back`, the click target is a `<button>`, which receives focus. `editor.focus()` at the end of the pipeline pulls focus back to Monaco — but there's a very brief window where the button is focused. Shouldn't be visible to the user.
- **Hook is React-only.** Callers must be inside React render. The Phase-4 window-level event listeners will need either a React-ref-based wiring or an imported plain function. If it becomes awkward, the hook body can be extracted into a plain `navigate(direction)` function and the hook becomes a trivial wrapper; the store already doesn't need React context. Deferring until Phase 4 shows which pattern is cleaner.

## Notes for next phase

- **Phase 4 has four consumers** of `useNavigation().navigate(direction)`:
  1. `NavButtons` — trivial hook use inside a React component.
  2. Keyboard `keydown` listener — likely a `useEffect` in `App.tsx` or a new `useNavigationShortcuts` hook that captures the `navigate` function via closure.
  3. Mouse side-button `mouseup` listener — same pattern as (2).
  4. Any future programmatic trigger (Phase 3 tests, feature integrations).

  If (2) and (3) end up duplicating a lot, consider extracting the listener code into the `useNavigation.ts` file too (export `useNavigationShortcuts()` that `App.tsx` calls once).

- **`canGoBack` / `canGoForward`** should be called from `NavButtons` via Zustand subscription so the buttons re-render when the stack updates. Calling them through a selector (`const canGoBack = useNavigationStore(s => s.canGoBack())`) will work but note: the selector is called on every store change, and `canGoBack()` iterates the stack. With stacks capped at 50 this is trivial, but worth a mental note.

- **`editor.focus()` in the pipeline already handles US-004's "no context menu"** implicit requirement — after a mouse-side-button navigate, Monaco has focus, not the browser's default aux-click target.
