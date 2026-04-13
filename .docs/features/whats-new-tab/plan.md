# Implementation Plan: What's New Tab

**Feature:** whats-new-tab
**Date:** 2026-04-13
**Prerequisites:** PRD, Spec, and Tests are finalized.

> References:
> - [PRD](./prd.md) — features, user stories, business rules
> - [Spec](./spec.md) — data shapes, IPC channels, type signatures
> - [Tests](./tests.md) — E2E and store-introspection test cases

---

## Project-Specific Conventions (deviations from skill defaults)

The cook/create-plan skill defaults assume a `packages/core` + `apps/vessel` monorepo with Vitest unit tests and `npm run typecheck`. NovaPad has none of those. This plan adapts:

| Skill default | NovaPad reality | This plan uses |
|---|---|---|
| `npm run typecheck` | No script; only `npm run build` does typecheck as a side-effect | `npx tsc --noEmit -p tsconfig.web.json` (renderer) and `npx tsc --noEmit -p tsconfig.node.json` (main+preload) |
| `npm run test:core` (Vitest) | No Vitest installed | Tests 14–19 from `tests.md` (originally tagged "Unit Test") become **E2E tests that introspect Zustand state via `page.evaluate(() => useEditorStore.getState())`** — matches the existing pattern in `tests/app-settings-rework.spec.ts` |
| `npm run test-ct` (Playwright CT) | Not configured | N/A — fold into E2E |
| `feat/<scope>/<name>` branch off `main` | Recent commits all land directly on `master` | Stay on `master` (match project practice) |
| Commit scope `(core)` / `(vessel)` | All recent commits use `(core)` regardless of layer | Use `feat(core)`, `test(core)`, `docs(core)`, etc. |

**Baseline typecheck has preexisting errors** in `EditorPane.tsx`, `Sidebar.tsx`, `useMacroRecorder.ts`, `useSearchEngine.ts`, `configStore.ts`, `pluginStore.ts`. None are in files this feature touches except `configStore.ts` (which has 3 errors related to `window.api.config` not being typed on the preload bridge — these errors **predate this feature** and are not blockers; new errors I introduce are blockers).

---

## Phase Overview

| # | Phase | Description | Depends On | Deliverable | Verification |
|---|-------|-------------|------------|-------------|--------------|
| 1 | **Foundation — types & store plumbing** | Widen `BufferKind`, `SessionVirtualKind`, `KNOWN_VIRTUAL_KINDS`, `SessionData.virtualTabs[].kind`, the `App.tsx:201` session-save filter; extend `openVirtualTab` with `{ activate }` option; add `lastSeenVersion` to `AppConfig`. No user-visible behavior. | — | All `kind` unions accept `'whatsNew'`; `openVirtualTab` supports background open; `lastSeenVersion` exists in config defaults | `tsc --noEmit` (both projects) + sub-agent review against spec §2 |
| 2 | **Component shell + render wiring** | Create `WhatsNewTab.tsx` ("Coming soon" placeholder); add render branch in `App.tsx:365-368`; add tab-bar icon for `whatsNew` in `TabBar.tsx:150-151` | Phase 1 | Calling `openVirtualTab('whatsNew')` from devtools renders a real, themed placeholder with a tab icon | `tsc --noEmit` + sub-agent review |
| 3 | **Manual open — Help menu + IPC** | Add `app:get-version` invoke handler in main; expose `window.api.app.getVersion()` in preload; allow `menu:whats-new-open` channel; add Help menu entry above About; wire `App.tsx` listener | Phases 1, 2 | User can open "What's New" from Help menu; dedupe works | `tsc --noEmit` + E2E Tests 1, 2, 7, 8, 11 |
| 4 | **Auto-open trigger + persistence** | Add post-mount effect in `App.tsx`: after `configStore.loaded`, fetch version, compare, open background tab + write `lastSeenVersion`. Plus the test-harness work for per-test config isolation. | Phases 1, 2, 3 | Feature complete | `tsc --noEmit` + E2E Tests 3, 4, 5, 6, 9, 10, 14–20 |

> Phases 2 and 3 both depend only on Phase 1 — they can be parallelized.

---

## Phase 1: Foundation — types & store plumbing

**Goal:** Make `'whatsNew'` a first-class kind everywhere the discriminator is used, give `openVirtualTab` a background-open option, and add `lastSeenVersion` to config — all without any user-visible behavior change.

**Input:** Spec §2 (Data Shapes), spec §2.3 (`openVirtualTab` signature), spec §2.4 (`AppConfig`).
**Output:** Codebase typechecks. Existing call-sites of `openVirtualTab` are unaffected (default `activate: true`). `'whatsNew'` is recognized by the kind union, the title map, the session normalizer, and the session-save filter — but no UI yet renders it.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 1.1 | Widen `BufferKind` and `openVirtualTab` signature | `src/renderer/src/store/editorStore.ts` | Change `BufferKind` to include `'whatsNew'`. Change `openVirtualTab` interface signature to accept the union including `'whatsNew'` and an optional `{ activate?: boolean }` second arg. Update the implementation to (a) include the `'whatsNew' → "What's New"` branch in the title map, (b) skip `set({ activeId: existing.id })` when `activate === false` and the buffer already exists, (c) skip `activeId: id` in the new-buffer set when `activate === false`. | `tsc --noEmit -p tsconfig.web.json` |
| 1.2 | Extend `SessionVirtualKind` and `KNOWN_VIRTUAL_KINDS` | `src/main/sessions/SessionManager.ts` | Add `'whatsNew'` to the `SessionVirtualKind` union and the `KNOWN_VIRTUAL_KINDS` set so the session-normalize step round-trips it instead of dropping it. | `tsc --noEmit -p tsconfig.node.json` |
| 1.3 | Widen renderer-side `SessionData.virtualTabs[].kind` | `src/renderer/src/hooks/useFileOps.ts` | Update the inline type at line 22 to include `'whatsNew'`. | `tsc --noEmit -p tsconfig.web.json` |
| 1.4 | Update session-save filter to include `'whatsNew'` | `src/renderer/src/App.tsx` (line 201) | Change `b.kind === 'settings' \|\| b.kind === 'shortcuts'` to also include `\|\| b.kind === 'whatsNew'`. Without this, an open What's New tab would not be persisted to `session.json`. | `tsc --noEmit -p tsconfig.web.json` + sub-agent review (this is a behavioral change masquerading as a type widening — easy to miss) |
| 1.5 | Add `lastSeenVersion` to `AppConfig` and `CONFIG_DEFAULTS` | `src/renderer/src/store/configStore.ts` | Add `lastSeenVersion: string \| null` to the `AppConfig` interface; add `lastSeenVersion: null` to `CONFIG_DEFAULTS`. The existing config-load merge-with-defaults path handles missing fields and type-coerces malformed values. | `tsc --noEmit -p tsconfig.web.json` |

### Linked Tests

None at this phase — no user-visible behavior. The store-introspection tests (14–19 from tests.md) will run in Phase 4 once entry points exist.

### Phase Exit Criteria

- [ ] `npx tsc --noEmit -p tsconfig.web.json` passes (ignoring the 9 preexisting errors documented above)
- [ ] `npx tsc --noEmit -p tsconfig.node.json` passes (ignoring any preexisting baseline)
- [ ] All four existing call-sites of `openVirtualTab` (`SettingsMenu.tsx:44/49`, `SideNav.tsx:35`, `App.tsx:113-114`, `useFileOps.ts:155`) compile without modification (validates the default-`true` backwards-compat contract)
- [ ] Sub-agent review confirms: (a) the `activate: false` branch correctly leaves `activeId` unchanged in both new-buffer and existing-buffer cases; (b) Task 1.4's filter update is present (sub-agent should specifically check this — easy to forget)

---

## Phase 2: Component shell + render wiring

**Goal:** A `'whatsNew'` virtual tab, when opened programmatically, renders a real component in the editor pane and shows an icon in the tab bar.

**Input:** Phase 1 complete.
**Output:** Devtools call `useEditorStore.getState().openVirtualTab('whatsNew')` produces a visible, themed placeholder tab with a recognizable icon. No user-facing entry point exists yet (Phase 3).

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 2.1 | Create `WhatsNewTab.tsx` placeholder component | `src/renderer/src/components/WhatsNewTab/WhatsNewTab.tsx` (new) | Function component with the same shape/styling-token discipline as `ShortcutsTab.tsx`. Renders centered "Coming soon" copy. Wraps in `data-testid="whatsnew-tab"`. Respects current theme via existing tokens. | `tsc --noEmit -p tsconfig.web.json` |
| 2.2 | Wire render branch in App.tsx | `src/renderer/src/App.tsx` (lines 365-368 area) | Add a third absolute-positioned `<div>` that renders `<WhatsNewTab />` when `activeBuf?.kind === 'whatsNew'` (mirroring the existing `'settings'` and `'shortcuts'` branches at lines 365 and 368). Import `WhatsNewTab`. | `tsc --noEmit -p tsconfig.web.json` + sub-agent review |
| 2.3 | Add tab-bar icon for `whatsNew` | `src/renderer/src/components/TabBar/TabBar.tsx` (lines 150-151 area) | Add a `{buf.kind === 'whatsNew' && <IconName size={18} className="shrink-0 opacity-80" />}` line. Use `Sparkles` from `lucide-react` (semantically appropriate for "what's new"; Newspaper is also acceptable — pick one and document the choice in the commit message). Import the icon at the top of the file. | `tsc --noEmit -p tsconfig.web.json` |

### Linked Tests

None directly at this phase — Tests 7, 8 (title, placeholder body) are deferred to Phase 3 because they need a real entry point to drive them. Sub-agent review covers visual correctness in the meantime.

### Phase Exit Criteria

- [ ] `npx tsc --noEmit -p tsconfig.web.json` passes
- [ ] Manual smoke (from devtools console in `npm run dev`): `useEditorStore.getState().openVirtualTab('whatsNew')` shows the new tab with icon and body content
- [ ] Sub-agent review confirms render branch ordering and icon import are consistent with the SettingsTab/ShortcutsTab pattern

---

## Phase 3: Manual open — Help menu + IPC

**Goal:** "Help → What's New" opens the tab in the foreground. Dedupe works. End-to-end testable.

**Input:** Phases 1 and 2 complete.
**Output:** First user-facing entry point. The auto-open trigger from Phase 4 will reuse the `app:get-version` handler added here.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 3.1 | Add `app:get-version` IPC handler | `src/main/index.ts` | Add `ipcMain.handle('app:get-version', () => app.getVersion())` near the other handler registrations. | `tsc --noEmit -p tsconfig.node.json` |
| 3.2 | Expose `window.api.app.getVersion()` in preload | `src/preload/index.ts` | Add an `app: { getVersion: () => ipcRenderer.invoke('app:get-version') }` block to the exposed `api`. Note: leave the existing unreliable `appVersion` constant in place per spec §4.2 (cleanup is out of scope). | `tsc --noEmit -p tsconfig.node.json` |
| 3.3 | Allow `menu:whats-new-open` in preload `on/off` allow-lists | `src/preload/index.ts` | Add the channel string to both the `on()` and `off()` allow-list arrays (lines 64–82 and 86–103). | `tsc --noEmit -p tsconfig.node.json` |
| 3.4 | Add Help menu entry "What's New" | `src/main/menu.ts` (Help submenu, line 373 area) | Insert a new menu item at the **top** of the Help submenu (above `About NovaPad` on Win/Linux, and above `Toggle Developer Tools` on macOS). No accelerator. Click handler: `() => win.webContents.send('menu:whats-new-open')`. | `tsc --noEmit -p tsconfig.node.json` + sub-agent review (verify it appears first across both platforms — there's a `process.platform === 'darwin'` branch that's easy to get wrong) |
| 3.5 | Wire renderer listener for `menu:whats-new-open` | `src/renderer/src/App.tsx` (near lines 113-114 where `menu:settings-open` is wired) | Add `window.api.on('menu:whats-new-open', () => useEditorStore.getState().openVirtualTab('whatsNew'))`. The default `activate: true` is what we want for manual open. Add the matching `window.api.off('menu:whats-new-open')` to the cleanup branch (around line 252). | `tsc --noEmit -p tsconfig.web.json` |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 3.5 | Test 1 | Help → What's New opens the tab in the foreground |
| 3.5 | Test 2 | Help → What's New dedupes |
| 2.1, 3.5 | Test 7 | Tab title is the static string "What's New" |
| 2.1, 3.5 | Test 8 | Tab body renders "Coming soon" placeholder |
| 3.4 | Test 11 | Help menu entry is positioned above About |

Per CLAUDE.md Monaco gotchas, the E2E tests should drive the menu via `electronApp.evaluate()` to call `webContents.send('menu:whats-new-open')` rather than trying to click a native menu item.

### Phase Exit Criteria

- [ ] `npx tsc --noEmit -p tsconfig.web.json` and `tsconfig.node.json` both pass
- [ ] `npm run build` succeeds (required for Playwright)
- [ ] `npm run test:e2e -- --grep "whats-new"` runs Tests 1, 2, 7, 8, 11 and they all pass
- [ ] Manual smoke in `npm run dev`: clicking Help → What's New on the actual native menu opens the tab and re-activates an existing one

---

## Phase 4: Auto-open trigger + persistence

**Goal:** Feature complete. Version-mismatch → background tab + `lastSeenVersion` write. All silent failure paths handled.

**Input:** Phases 1, 2, 3 complete.
**Output:** Fresh-install and version-bump flows are correct. `lastSeenVersion` enforces at-most-once. All 20 tests from `tests.md` pass.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 4.1 | Add auto-open trigger effect in App.tsx | `src/renderer/src/App.tsx` | Add a `useEffect` that runs once when `configStore.loaded === true`. Inside: `try { const cur = await window.api.app.getVersion(); const last = useConfigStore.getState().lastSeenVersion; if (last !== cur) { useEditorStore.getState().openVirtualTab('whatsNew', { activate: false }); useConfigStore.getState().setProp('lastSeenVersion', cur); } } catch (err) { console.warn('whats-new auto-open: version check failed', err) }`. The write happens **immediately** after the open call, not in a `.then()` of the open — this is BR-004 (write-on-fire). | `tsc --noEmit -p tsconfig.web.json` + sub-agent review against spec §6 (failure modes) |
| 4.2 | Add E2E test fixture variant for session-restore-enabled tests | `tests/fixtures.ts` (or new sibling file) | Tests 6 and 10 require session restore to actually run (the default fixture sets `E2E_TEST=1` which disables it per `src/main/index.ts:81-83`). Add a second exported fixture (e.g., `testWithSession`) that launches without `E2E_TEST=1` but with a per-test temp `userData` dir (via Electron CLI flag `--user-data-dir=...`) and pre-seeded `session.json` and `config.json`. | Tests 6 and 10 use this fixture and pass |
| 4.3 | Write E2E tests for the auto-open suite | `tests/whats-new.spec.ts` (new) | Implement Tests 3, 4, 5, 9, 14–20 from tests.md. Use the per-test temp `userData` approach for config seeding. Tests 14–16, 19 introspect store state via `await page.evaluate(() => (window as any).__store?.editor.getState())` — may need a small dev-only window expose in App.tsx (see Note A below). | `npm run test:e2e -- --grep "whats-new"` all pass |
| 4.4 | Write E2E tests for session-restore scenarios | `tests/whats-new-session.spec.ts` (new) | Implement Tests 6 and 10 using the session-enabled fixture. | `npm run test:e2e -- --grep "whats-new-session"` passes |

**Note A:** Whether to expose stores on `window` for E2E introspection is a project-wide question. Check `tests/app-settings-rework.spec.ts` first — if the existing tests already do this, follow the pattern; if they don't, prefer driving observable UI state (tab DOM, active-tab indicator) over store introspection where possible. The plan doesn't prescribe one; the Phase 4 implementer chooses based on existing conventions.

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 4.1, 4.3 | Test 3 | Auto-open fires on fresh install (lastSeenVersion = null) |
| 4.1, 4.3 | Test 4 | Auto-open fires on version mismatch |
| 4.1, 4.3 | Test 5 | No auto-open when versions match |
| 4.1, 4.4 | Test 6 | Auto-open does not steal focus from a restored session |
| 4.1, 4.3 | Test 9 | Auto-open is at-most-once across launches (write-on-fire) |
| 1.2, 4.4 | Test 10 | Tab persists across restarts when left open (session round-trip) |
| 1.1, 4.3 | Test 14 | `openVirtualTab('whatsNew', { activate: false })` does not change activeId |
| 1.1, 4.3 | Test 15 | `openVirtualTab('whatsNew')` defaults to `activate: true` |
| 1.1, 4.3 | Test 16 | `openVirtualTab` dedupes regardless of the activate option |
| 1.2, 4.3 | Test 17 | Session round-trip preserves the `whatsNew` kind |
| 4.1, 4.3 | Test 12 | Auto-open silently no-ops when `app:get-version` fails |
| 1.5, 4.3 | Test 13 | Malformed `lastSeenVersion` is treated as null |
| 4.1, 4.3 | Test 18 | Config write failure does not crash |
| 4.1, 4.3 | Test 19 | Two auto-opens in one session never produce a duplicate tab |
| 4.1, 4.3 | Test 20 | Closing the auto-opened tab in the same session does not re-trigger |

### Phase Exit Criteria

- [ ] All typechecks pass
- [ ] `npm run build` succeeds
- [ ] `npm run test:e2e` — full suite passes (no regressions in unrelated tests)
- [ ] All 20 tests in `tests.md` are implemented and green
- [ ] Manual smoke: launch with stale `lastSeenVersion` in `~/.config/notepad-and-more/config/config.json` → tab appears as rightmost without focus steal; `lastSeenVersion` is updated; relaunch shows no auto-open

---

## Verification Strategy

### Per-task

| Method | When to use | How |
|--------|-------------|-----|
| Typecheck (renderer) | Any file under `src/renderer/` | `npx tsc --noEmit -p tsconfig.web.json` |
| Typecheck (main/preload) | Any file under `src/main/` or `src/preload/` | `npx tsc --noEmit -p tsconfig.node.json` |
| Sub-agent review | Phase-1 behavioral tasks (1.1, 1.4), Phase-2 render wiring (2.2), Phase-3 menu placement (3.4), Phase-4 trigger (4.1) | Spawn `code-reviewer` agent against the relevant spec section |
| E2E test | All user-facing flows + store-introspection tests | `npm run build && npx playwright test --grep "whats-new"` |

### Sub-agent review prompt template

> "Review the implementation of {task} against `.docs/features/whats-new-tab/spec.md` §{section}. Specifically verify:
> {task-specific bullets}
> Report any discrepancies or missed cases. Under 200 words."

For Task 1.1 (the highest-risk task), the bullets must include:
> 1. The `activate: false` branch leaves `activeId` unchanged in BOTH the existing-buffer and new-buffer sub-cases.
> 2. The four existing call-sites are unaffected (check by reading them — no changes to argument shape).
> 3. The title map handles all three kinds (`'settings'`, `'shortcuts'`, `'whatsNew'`).

---

## Execution Notes

- **Phases 2 and 3 can run in parallel** if two implementers are available. They both depend only on Phase 1 and don't touch overlapping files (Phase 2: WhatsNewTab.tsx, App.tsx render switch, TabBar.tsx; Phase 3: main/index.ts, preload, menu.ts, App.tsx listener block — only App.tsx is shared, and the touched lines are far apart).
- **Build before E2E**: `npm run test:e2e` already runs `npm run build` first (see `package.json` script), so no separate build step needed.
- **Working tree hygiene**: Stage commits with explicit file paths. Do NOT use `git add -A` — the working tree has unrelated dirty files (`SettingsMenu.tsx`, `ui/Notepadandmore.html`, `ui/app-icon.png`, `cowork/`) that must not be swept into this feature's commits.
- **Branch**: stay on `master` per project convention.
- **Commit format**: `feat(core): ...`, `test(core): ...`, `docs(core): ...`. One commit per task.
- **Phase notes**: write to `.docs/features/whats-new-tab/implementation-notes/phase-{N}.md` after each phase's exit criteria are met.
