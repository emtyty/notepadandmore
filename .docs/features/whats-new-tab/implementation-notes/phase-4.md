# Phase 4: Auto-open trigger + persistence — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

- **Task 4.1** (`src/renderer/src/App.tsx`) — Auto-open trigger: `useEffect` that fires once when `configStore.loaded === true && readyForAutoOpen === true`. Reads `currentVersion` via `window.api.app.getVersion()`, compares to `useConfigStore.getState().lastSeenVersion`, and on mismatch calls `openVirtualTab('whatsNew', { activate: false })` followed immediately by `setProp('lastSeenVersion', currentVersion)` (BR-004 write-on-fire). Wrapped in try/catch — silent on failure (BR-005 / spec §6). A `useRef` guards against React StrictMode double-invocation. Also widened the global `Window.api` type in `useFileOps.ts` to add the `app` namespace.
- **Task 4.2** (`tests/whats-new-helpers.ts`, new) — Test-isolation primitives: `freshUserDataDir()` mints a temp dir per test; `launchIsolated()` passes `--user-data-dir=...` to Electron with optional `skipSessionRestore: false` to drop `E2E_TEST=1`; `seedConfig` / `readConfig` / `seedSession` for arranging state; `getRuntimeAppVersion` reads what the launched Electron actually reports (NOT `package.json`); polling helpers `waitForAutoOpenSettle` / `waitForAutoOpenIdle`.
- **Task 4.3** (`tests/whats-new-autoopen.spec.ts`, new) — 6 E2E tests covering Tests 3, 4, 5, 9, 16, 20 from `tests.md`.
- **Task 4.4** (`tests/whats-new-session.spec.ts`, new) — 2 E2E tests covering Tests 6 and 10 (require session restore, use `skipSessionRestore: false`).

### Two follow-on fixes uncovered by the test suite

- **`fix(core): keep WelcomeScreen visible when only inactive virtual tabs exist`** (`6a0a841`) — the WelcomeScreen render gate was `buffers.length === 0`, which became false the moment auto-open appended its inactive `whatsNew` tab on a fresh-install launch — leaving a blank EditorPane behind the inactive tab. Switched to `!activeId` for WelcomeScreen and `!!activeId` for StatusBar. Sub-agent reviewer specifically verified there's no transient-null state during file open (`addBuffer` sets `activeId` atomically in the same `set()` call).
- **`fix(core): restore virtual-tab-only sessions and gate auto-open on session ready`** (`3735e1e`) — two related fixes: (a) the `session:restore` handler at `App.tsx:197` only called `restoreSession` when `session?.files?.length` was truthy, silently dropping a session whose only entry was a `whatsNew` virtual tab. Changed to also check `session?.virtualTabs?.length`. (b) The auto-open effect would race with session restore IPC, producing the wrong tab order ([whatsNew, file1, file2] instead of [file1, file2, whatsNew]). Added a `readyForAutoOpen` state set by both the session-restore handler and a 200ms fallback timer (covers E2E_TEST=1 and fresh-install no-session paths).

## Verification results

- [x] `npx tsc --noEmit -p tsconfig.web.json` — 13 errors, all preexisting baseline.
- [x] `npx tsc --noEmit -p tsconfig.node.json` — 19 errors, all preexisting.
- [x] `npm run build` — clean.
- [x] `npx playwright test tests/whats-new*.spec.ts` — **13/13 green** in 21.3s.
  - 5 Phase 3 tests (manual open) — still passing after Phase 4 changes
  - 6 Phase 4 auto-open tests
  - 2 Phase 4 session-restore tests
- [x] Sub-agent (`code-reviewer`) review: 9/9 checkpoints clean. No critical or important issues. Specifically validated BR-004 write-on-fire timing, BR-002 focus-no-steal, BR-005 ready-gating, single-fire guarantee, silent failure behavior, session-restore fix, WelcomeScreen/StatusBar gating safety, test isolation, and runtime version source.

## Tests added

| Test | Spec | Status |
|------|------|--------|
| 3. Auto-open fires on fresh install (covers Test 14 — focus-no-steal) | `tests/whats-new-autoopen.spec.ts` | ✅ |
| 4. Auto-open fires on stale lastSeenVersion | `tests/whats-new-autoopen.spec.ts` | ✅ |
| 5. No auto-open when versions match | `tests/whats-new-autoopen.spec.ts` | ✅ |
| 9. At-most-once across launches (write-on-fire) | `tests/whats-new-autoopen.spec.ts` | ✅ |
| 16. Help-menu open after auto-open re-activates without duplicating | `tests/whats-new-autoopen.spec.ts` | ✅ |
| 20. Closing the auto-opened tab does not re-trigger | `tests/whats-new-autoopen.spec.ts` | ✅ |
| 6. Auto-open does not steal focus from a restored session | `tests/whats-new-session.spec.ts` | ✅ |
| 10. Tab persists across restarts when left open (session round-trip) | `tests/whats-new-session.spec.ts` | ✅ |

## Tests intentionally not implemented

| Test | Reason |
|------|--------|
| 12. Silent no-op on `app:get-version` IPC failure | Implementation handles via try/catch (sub-agent verified the catch path doesn't write `lastSeenVersion`). Externally observable behavior is "no tab appears" — already covered by negative assertions in Test 5. Mocking the IPC requires test infra not present in this project. |
| 13. Malformed `lastSeenVersion` treated as null | Spec assumed configStore's defaults-merge would coerce malformed values to default, but reading the code shows the merge is a simple object spread — a number lastSeenVersion lands as-is in the store. Fortunately this doesn't break the feature: `42 !== "1.4.2"` is true, so auto-open still fires. The behavior matches the spec's conclusion ("auto-open fires") just not for the spec's stated reason. Covered indirectly by Test 4. |
| 15. `openVirtualTab('whatsNew')` defaults to `activate: true` | Already covered end-to-end by Test 1 (Help-menu open results in active whatsNew tab). |
| 17. Session round-trip preserves `whatsNew` kind (unit-style) | Subsumed by Test 10 (full E2E session round-trip via launch → session save → relaunch → restored). |
| 18. Config write failure does not crash | Same rationale as Test 12 — handled in implementation, requires mock infra not present. |
| 19. Two auto-opens never produce a duplicate | The single-fire `useRef` guard makes this case impossible to trigger from production code paths. Verified by sub-agent code review. |

## Bugs found and fixed during cooking

1. **`import('../package.json')` ESM attribute error** in initial test draft. Fixed by switching to `fs.readFileSync` then ultimately replaced entirely by `getRuntimeAppVersion` (because Electron in test mode reports its own binary version, not the project version).
2. **WelcomeScreen disappears behind inactive auto-opened tab** — the `buffers.length === 0` gate was wrong for the new flow. Fixed in `6a0a841`.
3. **Virtual-tab-only sessions silently fail to restore** — `if (session?.files?.length)` guard at App.tsx:197. Fixed in `3735e1e`.
4. **Tab order race between auto-open and session restore** — auto-open fired before session:restore IPC arrived. Fixed in `3735e1e` with `readyForAutoOpen` state.

## Commits

**Branch:** `master`

| Commit | Message |
|--------|---------|
| `491bf21` | feat(core): auto-open whats-new tab on version mismatch |
| `6a0a841` | fix(core): keep WelcomeScreen visible when only inactive virtual tabs exist |
| `3735e1e` | fix(core): restore virtual-tab-only sessions and gate auto-open on session ready |
| `1f07adf` | test(core): e2e suites for whats-new auto-open + session round-trip |

## Pending / Known issues

- **Phase 3 tests will write `lastSeenVersion` to the developer's real config dir** the first time the suite runs after this feature lands. This is because `tests/whats-new.spec.ts` still uses the non-isolated `launchApp` helper. Behavior remains correct (the tests don't break), but it's mildly impolite. Future cleanup: migrate Phase 3 tests to `launchIsolated` from the helpers module. Out of scope for this iteration.
- **The legacy `window.api.appVersion` constant** (in `src/preload/index.ts:7`) remains unreliable in packaged builds. Spec §4.2 documented this and explicitly placed cleanup out of scope. Recommended follow-up: deprecate or remove it now that `window.api.app.getVersion()` exists.

## Notes

The feature is now functionally complete. All 8 PRD acceptance criteria (US-001 through US-005 across 5 features F1–F5) are exercised by the 13 passing E2E tests. The placeholder body content can be replaced in a follow-up "Release notes content" feature without touching any of the plumbing built here.
