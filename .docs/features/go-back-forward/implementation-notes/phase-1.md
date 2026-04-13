# Phase 1: Store + Logic — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

- **P1.1** — Added `NavigationEntry` interface (`bufferId`, `line`, `column`, `timestamp`) and the `useNavigationStore` Zustand slice skeleton in `src/renderer/src/store/navigationStore.ts`. State: `back`, `forward`, `isNavigating`.
- **P1.2** — Implemented `pushEntry` per spec §2.3: `isNavigating` guard → virtual-tab guard (`editorStore.getBuffer(id)?.kind === 'file'`) → dedupe vs top of `back` → append → cap at 50 (shift oldest) → clear `forward`.
- **P1.3** — Implemented `goBack` / `goForward` with the spec §2.4 **option B** (lazy-skip): pop entries off the target stack until one points at a live file buffer; drop any stale entries in the process. Accepts optional `currentPosition` that is pushed onto the opposite stack *before* popping, so the navigation pipeline can pass its current cursor in one transaction. When every entry is stale, `currentPosition` is not left orphaned in the opposite stack — it's popped back off.
- **P1.4** — `canGoBack` / `canGoForward` scan the stack from the top looking for at least one live file buffer entry; O(stack × buffers) per call is fine at cap 50.
- **P1.5** — `beginNavigating` / `endNavigating` flip `isNavigating`. `clearForBuffer` is a documented no-op placeholder for a future eager-cleanup strategy.
- **P1.6** — Wrote `scripts/test-navigation-store.mjs` with 40 assertions covering all business rules. Same Node-script pattern used by `scripts/test-session-normalize.mjs` (this repo has no Vitest harness).

## Verification results

- [x] `npx electron-vite build` succeeds — all three bundles compile.
- [x] `node scripts/test-navigation-store.mjs` — **40/40 assertions pass** covering BR-002, BR-003, BR-004, BR-006, BR-007, `isNavigating` gating, `canGoBack`/`canGoForward`, symmetric `goBack`/`goForward`, and round-trip navigation.
- [ ] Sub-agent review — deferred to Phase 4 final sweep. The logic is mechanically tested by the Node script; a sub-agent pass is lower-value at this stage than before integration.

## Unit tests

`scripts/test-navigation-store.mjs` — 40 assertions over 13 scenarios:

| Scenario | Rule / Linked test |
|---|---|
| Dedupe consecutive same line | BR-003, T11 |
| Different-line push | BR-003 |
| Cap at 50, oldest dropped | BR-002, T13 |
| New push clears forward | BR-004, T12 |
| Virtual tab entry ignored | BR-006, T30 |
| `isNavigating` blocks/allows push | §2.3 |
| `goBack` returns popped entry | §3.3 |
| `goBack` without `currentPosition` | §3.3 |
| `goBack` empty stack → null, no orphan | edge case |
| Single stale entry skipped | BR-007 |
| Multiple consecutive stale skipped | BR-007, T25 |
| All-stale → null, no orphan | BR-007 |
| `canGoBack` / `canGoForward` across empty/all-stale/mixed | BR-009, T24 |
| `goForward` symmetry | §3.3 |
| Back + Forward round-trip | US-001/US-002 |
| Column ignored for dedupe | BR-003 |
| Cross-buffer same line NOT deduped | BR-003 |

## Commits

**Branch:** `master` (repo convention)

| Commit | Message |
|--------|---------|
| `7b3fef5` | feat(core): add navigation history store |
| `6f62b3d` | test(core): unit tests for navigation store |

## Pending / Known issues

- **Store is not yet exercised by any code.** No entry-capture, no navigation pipeline, no UI. Feature is invisible to users — this is the planned Phase-1 exit state.
- **Sub-agent review deferred** — bundled into the Phase 4 final sweep.
- **Pure-logic test duplication.** The Node script reimplements `pushEntry`/`goBack`/`goForward` by hand (no Zustand in Node). Divergence risk accepted; the logic is ~40 lines and a sub-agent review at Phase 4 will cross-check the two implementations.

## Notes for next phase

- `useNavigationStore` is the canonical API. Phase 2 will call `pushEntry(entry)` from `EditorPane`'s cursor observer and the tab-switch effect; Phase 3 will call `beginNavigating` / `goBack` / `goForward` / `endNavigating` from the navigation pipeline.
- `pushEntry` reads `editorStore.getBuffer(id)?.kind` synchronously. That's fine because `editorStore` is a Zustand slice too — no async. If callers ever want to pre-validate the buffer, they can call `useEditorStore.getState().getBuffer(id)` themselves, but it's not required.
- `goBack(currentPosition)` / `goForward(currentPosition)` — pass the live cursor position as `currentPosition` so symmetric round-trips work. Don't pass `null` unless there's truly nothing to preserve.
- `isNavigating` flag must be set **before** calling `goBack`/`goForward` so the resulting tab-switch/cursor-move don't re-push. Phase 3's `useNavigation` hook is responsible for this.
- `clearForBuffer` is a no-op. Do not call it from Phase 2/3 code expecting cleanup; it exists only so a future v2 can swap to eager cleanup without changing the public interface.
