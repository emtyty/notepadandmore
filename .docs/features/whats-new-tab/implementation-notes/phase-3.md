# Phase 3: Manual open — Help menu + IPC — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

- **Task 3.1** (`src/main/index.ts`) — Registered `ipcMain.handle('app:get-version', () => app.getVersion())` at module scope so the renderer can read the real packaged version (the legacy `window.api.appVersion` is unreliable in production builds and was left untouched per spec §4.2).
- **Task 3.2** (`src/preload/index.ts`) — Exposed `window.api.app.getVersion()` returning `Promise<string>` via `ipcRenderer.invoke('app:get-version')`.
- **Task 3.3** (`src/preload/index.ts`) — Added `'menu:whats-new-open'` to both the `on()` and `off()` IPC allow-lists.
- **Task 3.4** (`src/main/menu.ts`) — Added "What's New" as the first item of the Help submenu on both macOS and Win/Linux. No accelerator. Click handler fires `menu:whats-new-open`.
- **Task 3.5** (`src/renderer/src/App.tsx`) — Subscribed `menu:whats-new-open` → `useEditorStore.getState().openVirtualTab('whatsNew')` (default `activate: true` for foreground open). Added the matching `off()` in the cleanup branch.
- **E2E tests** (`tests/whats-new.spec.ts`) — Implemented Tests 1, 2, 7, 8, 11 from `tests.md`. Native menu actions are driven via `app.evaluate(({ BrowserWindow }) => ... webContents.send(...))` per the Monaco gotcha in CLAUDE.md. Test 11 inspects the Menu structure via `app.evaluate(({ Menu }) => Menu.getApplicationMenu())`.

## Verification results

- [x] `npx tsc --noEmit -p tsconfig.web.json` — 13 errors, all preexisting baseline.
- [x] `npx tsc --noEmit -p tsconfig.node.json` — 19 errors, all preexisting (17 in `node_modules`, 2 in `searchWorker.ts`).
- [x] `npm run build` — succeeded.
- [x] `npx playwright test tests/whats-new.spec.ts` — **5/5 green** in 6.8s. (Per user direction: scoped run only — full regression suite not executed.)
- [x] Sub-agent (`code-reviewer`) review: passed all 6 verification points (menu placement first-on-both-platforms, IPC channel symmetry in on/off lists, app:get-version registered at module scope with correct invoke wiring, legacy appVersion left in place, renderer listener uses default activate, no regressions).

## Tests added

| Test | File | Status |
|------|------|--------|
| 1. Help → What's New opens the tab in the foreground | `tests/whats-new.spec.ts` | ✅ Passing |
| 2. Second click dedupes (no duplicate tab) | `tests/whats-new.spec.ts` | ✅ Passing |
| 7. Tab title is the static string "What's New" | `tests/whats-new.spec.ts` | ✅ Passing |
| 8. Tab body renders "Coming soon" placeholder | `tests/whats-new.spec.ts` | ✅ Passing |
| 11. Help menu entry positioned at top of submenu | `tests/whats-new.spec.ts` | ✅ Passing |

## Bug found and fixed during cooking

- **Initial test failure**: my `launchApp` helper copied `tests/fixtures.ts` and included `await page.waitForSelector('[data-testid="tabbar"] [data-tab-title]', { timeout: 5_000 })`. In a clean `E2E_TEST=1` launch with no session restore, there are no tabs on mount, so the selector times out and all 5 tests fail at the helper. **Fix**: removed the tabbar wait — my tests create the `whatsNew` tab themselves via the IPC, so a pre-existing tab is unnecessary. No code commit needed (the bug was in test scaffolding only). The fix landed in the `tests/whats-new.spec.ts` file before its first commit (`2fb0da5`).

## Commits

**Branch:** `master`

| Commit | Message |
|--------|---------|
| `6bb40ba` | feat(core): expose app:get-version IPC handler |
| `7049ad0` | feat(core): expose window.api.app.getVersion() in preload bridge |
| `9b41461` | feat(core): allowlist menu:whats-new-open IPC channel in preload |
| `4cecc5e` | feat(core): add Help → What's New menu entry |
| `5c46b98` | feat(core): wire menu:whats-new-open IPC listener in renderer |
| `2fb0da5` | test(core): e2e suite for whats-new manual open |

## Pending / Known issues

None. Phase 3 is fully complete and the manual-open flow is shippable on its own.

## Notes for next phase (Phase 4 — Auto-open trigger + persistence)

- The `app:get-version` IPC is already wired and tested indirectly via the renderer using it in Phase 4. No additional preload work needed.
- For Phase 4 tests: when seeding `lastSeenVersion` to suppress auto-open, the seed must land in the *test-isolated* `userData` directory. Otherwise tests will pollute the developer's real config. The plan calls for a per-test `--user-data-dir=<temp>` Electron flag — implement this in a `testWithSession` fixture variant.
- **Important**: Phase 3's tests do NOT seed `lastSeenVersion`. They work today because Phase 4 (auto-open) doesn't exist yet. Once Phase 4 lands, these Phase 3 tests will need to either (a) seed `lastSeenVersion = currentVersion` in a `beforeEach` or (b) accept that the `whatsNew` tab may already exist on launch — and assert their behaviors from there. The dedupe test (Test 2) is naturally robust; Test 1's "tab is foreground active" might need rework if auto-open already opened the tab in the background and the manual click then re-activates it. Re-verify after Phase 4.
- Auto-open trigger pattern (per spec §7.1): runs from a `useEffect` in App.tsx that depends on `configStore.loaded`. Wraps the IPC call + write in a single try/catch. Write `lastSeenVersion` IMMEDIATELY after the open call (BR-004 — write-on-fire, not write-on-close).
