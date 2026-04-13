# Implementation Plan: Go Back / Go Forward

**Feature:** go-back-forward
**Date:** 2026-04-13
**Prerequisites:** PRD, Spec, and Tests finalized.

> References:
> - [PRD](./prd.md) — features, user stories, business rules
> - [Spec](./spec.md) — data shapes, entry triggers, shortcut registration, navigation execution
> - [Tests](./tests.md) — 30 scenarios

---

## Phase Overview

| # | Phase | Description | Depends On | Deliverable | Verification |
|---|-------|-------------|------------|-------------|--------------|
| 1 | Store + logic | `useNavigationStore` with `pushEntry`/`goBack`/`goForward`, dedupe, cap, forward-truncate, virtual-tab guard, lazy-skip | — | Pure store behaves correctly; node-script unit tests pass | Typecheck + Node unit tests + sub-agent review |
| 2 | Entry capture | Tab-switch observer + cursor-threshold in `EditorPane.onDidChangeCursorPosition` | P1 | Entries are pushed at the right events; verifiable via DevTools `useNavigationStore.getState()` | Typecheck + manual DevTools probe |
| 3 | Navigation execution | `useNavigation` hook; tab-switch + `setPosition`/`revealLineInCenter`; `isNavigating` flag wiring | P1 | Programmatic `navigate('back')` / `'forward')` works end-to-end | Typecheck + sub-agent review |
| 4 | UI + input wiring | `NavButtons` in MenuBar + QuickStrip; window-level keydown + mouseup listeners in `App.tsx` | P2, P3 | Full user-facing flow; all E2E tests pass | Typecheck + Playwright E2E (tests.md) |

> **Parallelism**: P2 and P3 can run concurrently once P1 merges. P4 blocks on both.

---

## Phase 1: Store + Logic

**Goal:** Implement `useNavigationStore` with all business rules encoded in the store itself. No UI, no integrations — just the pure state machine.

**Input:** Spec §2 (Data Shapes), §9 (Business Rules).
**Output:** `src/renderer/src/store/navigationStore.ts` exports a working Zustand store. Unit script proves dedupe, cap, forward-truncate, virtual-tab guard, and lazy-skip semantics.

### Tasks

| # | Task | Area | Description | Verification |
|---|------|------|-------------|--------------|
| 1.1 | Create `NavigationEntry` type + store skeleton | `src/renderer/src/store/navigationStore.ts` | Export `NavigationEntry`, `useNavigationStore` with `back: []`, `forward: []`, `isNavigating: false`, and stub actions. | Typecheck |
| 1.2 | Implement `pushEntry` | same file | Per spec §2.3: check `isNavigating`, check virtual-tab (requires reading `editorStore.getBuffer(id)?.kind`), dedupe by `{bufferId, line}` against top of `back`, append, cap at 50 with shift, clear `forward`. | Node script unit test |
| 1.3 | Implement `goBack` / `goForward` with lazy-skip | same file | Per spec §2.4 option B. On empty stack return `null`. Pop; if destination buffer is missing (`getBuffer` returns null) or its kind is not `'file'`, discard and recurse in same direction. On success, shift current top of the opposite stack. Caller must have already pushed the current cursor to the opposite stack — see §2.2/§3.3. Actually let's encode that here: `goBack()` accepts an optional `currentPosition: NavigationEntry` which is pushed onto `forward` before popping `back`. | Node script unit test |
| 1.4 | Implement `canGoBack` / `canGoForward` selectors | same file | Must check at least one entry's buffer still exists + is a file buffer. | Node script unit test |
| 1.5 | Implement `beginNavigating` / `endNavigating` + `clearForBuffer` no-op | same file | `clearForBuffer` is a no-op in v1 but present in the interface. | Typecheck |
| 1.6 | Write `scripts/test-navigation-store.mjs` | `scripts/` | Covers T9 (simulated in pure logic), T11, T12, T13, T24, T25, T30. Uses a mock `getBuffer` lookup. | `node scripts/test-navigation-store.mjs` |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 1.2 | T11 | Dedupe consecutive same-line |
| 1.2 | T12 | New push truncates forward |
| 1.2 | T13 | 50-entry cap |
| 1.2 | T30 | Virtual-tab push ignored |
| 1.3 | T25 | Lazy-skip multiple stale entries |
| 1.4 | T24 | `canGoBack` false when all stale |

### Phase Exit Criteria

- [ ] `npx electron-vite build` succeeds.
- [ ] `node scripts/test-navigation-store.mjs` passes all assertions.
- [ ] Sub-agent review confirms the store matches spec §2 and §9.
- [ ] No UI or integration code exists yet — the feature is invisible to users.

---

## Phase 2: Entry Capture

**Goal:** Feed the Phase-1 store with entries at the right events. No navigation execution yet — this phase only pushes, never pops.

**Input:** Phase 1 — `pushEntry` is live.
**Output:** Cursor jumps and tab switches produce entries in `useNavigationStore`. Observable via DevTools.

### Tasks

| # | Task | Area | Description | Verification |
|---|------|------|-------------|--------------|
| 2.1 | Tab-switch push (§3.1) | `src/renderer/src/components/EditorPane/EditorPane.tsx` (or a new effect in `App.tsx`) | Watch `editorStore.activeId`. When it changes, and both old and new buffers have `kind === 'file'`, push an entry for the **previous** buffer's current cursor (read from Monaco via `editor.saveViewState()` or a tracked ref). Skip when `isNavigating === true`. | Typecheck + manual DevTools probe |
| 2.2 | Threshold cursor-change push (§3.2) | `EditorPane.tsx` `onDidChangeCursorPosition` | Add a `lastRecordedLineRef` per active buffer. On each cursor-change event, if `Math.abs(newLine - lastRecordedLine) > 10` and `isNavigating === false` and active buffer is a file, push an entry and update `lastRecordedLineRef`. | Typecheck + manual |
| 2.3 | Reset `lastRecordedLineRef` on tab switch | `EditorPane.tsx` | When active buffer changes, reset the ref so the next push is measured relative to the new buffer's current line. | Typecheck + manual |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 2.1 | T3 (partial — capture side), T14, T26 | Tab-switch captures; virtual tab excluded |
| 2.2 | T9, T10, T21, T22 | Threshold logic |

Full end-to-end behavior for T3/T4/T10/T14/T22/T26 needs Phase 3 + 4. This phase only verifies the **push** half.

### Phase Exit Criteria

- [ ] `npx electron-vite build` succeeds.
- [ ] Manual smoke: open two files, move cursor significantly, switch tabs — inspect `useNavigationStore.getState().back` in DevTools and confirm entries appear as expected.
- [ ] Opening the Settings virtual tab produces **no** new entries.
- [ ] Sub-agent review confirms §3.1 and §3.2 are faithfully implemented, including the `isNavigating` short-circuit.

---

## Phase 3: Navigation Execution

**Goal:** Implement the `navigate(direction)` pipeline that pops a stack entry, switches tabs, and repositions the Monaco cursor. Integrates with the Phase-1 store and respects `isNavigating`.

**Input:** Phase 1 — `goBack`/`goForward` exist.
**Output:** Calling `useNavigation().navigate('back' | 'forward')` from DevTools performs the full trip: active tab flips, cursor lands, `isNavigating` is set and cleared.

### Tasks

| # | Task | Area | Description | Verification |
|---|------|------|-------------|--------------|
| 3.1 | Create `src/renderer/src/hooks/useNavigation.ts` | new file | Exports `useNavigation()` returning `{ navigate(direction) }`. Internally reads current cursor from `editorRegistry.get()?.getPosition()`, calls `beginNavigating()`, calls store `goBack/goForward(currentPos)`, resolves destination buffer, calls `editorStore.setActive(id)` if needed, schedules `editor.setPosition({line, column})` + `editor.revealLineInCenter(line)` via `queueMicrotask`, calls `endNavigating()` at the end. | Typecheck + sub-agent review |
| 3.2 | Handle Monaco model-not-yet-mounted (§7 step 6) | same file | If `editor.getModel()?.uri` doesn't match the target buffer after the microtask (still mid-swap), silently skip the `setPosition` call — Monaco's viewState restore will land the cursor once the model swap completes. | Sub-agent review (edge case) |
| 3.3 | Wire `isNavigating` around entry capture | Phase 2 code | Already added the guard in Phase 2; confirm here that tab-switch and threshold-push both observe the flag. Small audit task. | Sub-agent review |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 3.1 | T3, T4, T15, T16, T17, T26, T27 | End-to-end navigation |
| 3.2 | T27 | Edit-drift / Monaco race |
| 3.3 | T17, T28 | `isNavigating` guard |

Tests run fully in Phase 4 when the user can invoke `navigate` via UI. Phase 3's manual verification: call `useNavigation().navigate('back')` from DevTools after seeding entries.

### Phase Exit Criteria

- [ ] `npx electron-vite build` succeeds.
- [ ] Manual DevTools probe: seed 2 entries via Phase 2 behavior, then call the exported `navigate('back')` — active tab flips and cursor lands.
- [ ] `isNavigating` observed `true` during the call, `false` after.
- [ ] Sub-agent review against spec §7.

---

## Phase 4: UI + Input Wiring

**Goal:** User-reachable Back/Forward. Toolbar buttons in both strips, keyboard shortcuts per OS, mouse side buttons. End-to-end tests pass.

**Input:** Phase 2 (entry capture) + Phase 3 (navigation pipeline).
**Output:** Full feature. All 30 tests in `tests.md` are covered (some via manual QA where Playwright can't reach).

### Tasks

| # | Task | Area | Description | Verification |
|---|------|------|-------------|--------------|
| 4.1 | Create `NavButtons` component | `src/renderer/src/components/editor/NavButtons.tsx` | Two buttons with `ArrowLeft`/`ArrowRight` icons, `data-testid="nav-back"` / `"nav-forward"`, disabled when `canGoBack()`/`canGoForward()` is false, title with platform-appropriate shortcut. Click → `useNavigation().navigate(direction)`. | Playwright CT (or E2E proxy) |
| 4.2 | Embed in `MenuBar` right-strip | `MenuBar.tsx` | Render `<NavButtons />` immediately before the `Toggle Sidebar` button in the right-strip. Final order: `[Back] [Forward] [Toggle Sidebar] [Gear]`. | T1 |
| 4.3 | Embed in `QuickStrip` right-strip | `QuickStrip.tsx` | Same placement, same order — visible on macOS. | T1 |
| 4.4 | Register window-level keydown listener | `App.tsx` or new `useNavigationShortcuts` hook | `document.documentElement.addEventListener('keydown', handler, { capture: true })`. Match `Ctrl+-` / `Ctrl+Shift+-` on macOS, `Alt+ArrowLeft` / `Alt+ArrowRight` on Windows/Linux. Skip if target is a non-Monaco `<input>` / `<textarea>` (§4.4). Call `preventDefault` + `stopPropagation` + `navigate(direction)`. Clean up on unmount. | T5, T6, T19, T20 |
| 4.5 | Register mouse side-button listener | same hook | Window-level `mouseup` listener. `button === 3` → back; `button === 4` → forward. `preventDefault` on match. | T7, T8 |
| 4.6 | Regression sweep | All | Run all `tests.md` scenarios; fix any failures. | Full Playwright suite |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 4.1 | T2, T18, T29 | Disabled state, tooltip text, reactivity |
| 4.2 / 4.3 | T1 | Toolbar icon order/placement |
| 4.4 | T5, T6, T19, T20, T23 | Keyboard shortcuts + Find-input escape + zoom-no-conflict + no-persist |
| 4.5 | T7, T8 | Mouse buttons |
| 4.6 | T3, T4, T10, T14, T15, T16, T17, T22, T25, T26, T27, T28 | Full navigation flows |

### Phase Exit Criteria

- [ ] `npx electron-vite build` succeeds.
- [ ] `npx playwright test tests/go-back-forward.spec.ts` — full E2E suite passes on the running platform.
- [ ] Manual smoke of T5/T6 on the **other** platform (if implementation host is macOS, smoke Windows — or note as QA item).
- [ ] Sub-agent review confirming `tests.md` coverage and spec §§4–7.

---

## Verification Strategy

### Automated Checks (per task)

| Method | When to Use | How |
|--------|-------------|-----|
| **Typecheck** | Every code change | `npx electron-vite build` (all three bundles compile) |
| **Unit (Node script)** | Store pure logic | `node scripts/test-navigation-store.mjs` (no Vitest in repo) |
| **Playwright E2E** | User-facing flows | `npx playwright test tests/go-back-forward.spec.ts` |
| **Manual DevTools probe** | Phases 2 & 3 before UI exists | Inspect `useNavigationStore.getState()` after gestures |
| **Sub-agent review** | Complex logic in P1, P3; final sweep in P4 | Spawn Opus sub-agent with spec reference |

### Sub-agent Review Prompts

**Phase 1:**
> "Review `src/renderer/src/store/navigationStore.ts` against `.docs/features/go-back-forward/spec.md` §2. Confirm: (a) `pushEntry` follows spec §2.3 exactly (order of checks matters — virtual-tab guard before dedupe); (b) `goBack`/`goForward` implement lazy-skip per §2.4 option B and handle the empty-after-skip case correctly; (c) `canGoBack`/`canGoForward` validate against the current `editorStore.buffers` list; (d) `isNavigating` flag gates pushes. Report any deviations."

**Phase 3:**
> "Review `src/renderer/src/hooks/useNavigation.ts` against spec §7. Confirm the 7-step pipeline runs in order, `isNavigating` is set before and cleared after regardless of success/failure, and Monaco model-swap timing (§7 step 6) is handled via `queueMicrotask` or equivalent. Check that `currentPosition` is correctly read and passed to the store."

**Phase 4 (final):**
> "Independent review: does the implementation fully realize `.docs/features/go-back-forward/prd.md`? Walk each US-001 through US-006 and confirm the acceptance criteria are met. Confirm the keyboard shortcut listener uses `capture: true` and does not fire inside non-Monaco inputs. Confirm tooltip text matches platform (⌘-style on macOS, Alt-style on Windows). Confirm no regression in the existing app-settings-rework flow (gear dropdown still works)."

---

## Execution Notes

- **Parallelism**: P2 and P3 can be cooked in parallel after P1. P4 waits on both.
- **Commit hygiene**: one task = one commit. Use `feat(core)` / `refactor(core)` per `.claude/rules/common/git-workflow.md`.
- **Decision points to record in commit messages**:
  - P1.3: chose lazy-skip (option B) over eager `clearForBuffer` — decoupling rationale.
  - P2.1: chose to read previous buffer's cursor via `editor.getPosition()` at switch time vs. tracking in a ref — note the pick.
  - P4.4: chose window-level capture-listener over Electron hidden-menu-item accelerator — testability rationale.
- **Test env constraint**: `E2E_TEST=1` still skips session restore; tests run with `{forward,back} = []` at launch, so every test starts from a clean stack. T23 (no-persistence) becomes a direct consequence of not-seeded, but is still worth asserting explicitly.
- **Pre-existing `tests/seed.spec.ts` is broken** (confirmed during app-settings-rework) — don't block on it.
- **Integration with app-settings-rework**: `Buffer.kind` already exists; virtual-tab exclusion in BR-006 leans on it. No new editorStore changes needed.
