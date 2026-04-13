# Phase 1: Foundation — types & store plumbing — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

- **Task 1.1** (editorStore.ts) — Widened `BufferKind` to include `'whatsNew'`. Extended `openVirtualTab` signature with an optional `{ activate?: boolean }` second arg defaulting to `true`. Updated implementation: when `activate === false`, neither the existing-buffer path nor the new-buffer path mutates `activeId`. Added `'whatsNew' → "What's New"` to the title map.
- **Task 1.2** (SessionManager.ts) — Added `'whatsNew'` to `SessionVirtualKind` and to `KNOWN_VIRTUAL_KINDS` so the session normalizer accepts it on load.
- **Task 1.3** (useFileOps.ts) — Widened `SessionData.virtualTabs[].kind` to match the SessionManager union.
- **Task 1.4** (App.tsx:201) — Updated the `virtualBuffers` filter in the session-save effect to include `b.kind === 'whatsNew'`. Without this, an open What's New tab would not be persisted to session.json on quit.
- **Task 1.5** (configStore.ts) — Added `lastSeenVersion: string | null` to `AppConfig` and `lastSeenVersion: null` to `CONFIG_DEFAULTS`. Persistence rides on the existing `save()` loop with no additional code.

## Verification results

- [x] `npx tsc --noEmit -p tsconfig.web.json` — 13 errors, **all preexisting**, none in any file touched by this phase. Baseline established and unchanged across all 5 task commits.
- [x] `npx tsc --noEmit -p tsconfig.node.json` — 19 errors, **all preexisting** (17 in `node_modules` type defs, 2 in `src/main/ipc/searchWorker.ts`). None in `SessionManager.ts`.
- [x] All four existing `openVirtualTab` call-sites compile unchanged (validates the `activate: true` default backwards-compat contract): `SettingsMenu.tsx:44/49`, `SideNav.tsx:35`, `App.tsx:113-114`, `useFileOps.ts:155`.
- [x] Sub-agent (`code-reviewer`) review: passed all 4 verification points (activate semantics, save filter inclusion, type-widening consistency, lastSeenVersion auto-persist). No critical or important issues.

## Unit tests

None for this phase by design — Phase 1 is foundation-only with no user-visible behavior. Store-introspection tests (Tests 14–19 from `tests.md`) will be implemented in Phase 4 once entry points exist to drive them.

## Commits

**Branch:** `master` (per project convention — no `feat/*` branch)

| Commit | Message |
|--------|---------|
| `3f3a48e` | feat(core): widen BufferKind and openVirtualTab for whats-new tab |
| `953445d` | feat(core): allow whatsNew kind to round-trip through session.json |
| `b9e58ba` | feat(core): widen SessionData.virtualTabs[].kind for whatsNew |
| `3a612b9` | feat(core): persist whatsNew tab in session save filter |
| `f887d30` | feat(core): add lastSeenVersion field to AppConfig |

(Also: `675b710 docs(core): add whats-new-tab feature documentation` committed at the start of cooking — feature docs only, no code.)

## Pending / Known issues

None. Phase 1 is fully complete.

## Notes for next phase (Phase 2 or Phase 3 — they can run in parallel)

- The `'whatsNew'` kind is now valid everywhere it needs to be on the data layer. Phase 2 can mount `WhatsNewTab` into the render switch in `App.tsx:365-368` and add the tab-bar icon in `TabBar.tsx:150-151` without further type plumbing.
- For Phase 2's smoke test: open a devtools console in `npm run dev` and run `useEditorStore.getState().openVirtualTab('whatsNew')` — once the render branch and icon are wired, this should produce a visible, themed placeholder tab. Note that `useEditorStore` is not exposed on `window` by default — the smoke test may need a temporary `;(window as any).__store = useEditorStore` line, or use React DevTools.
- For Phase 3: the `app:get-version` IPC must be added before the auto-open logic in Phase 4. Phase 3 has it as Task 3.1 already.
- For Phase 4: `lastSeenVersion` is read with `useConfigStore.getState().lastSeenVersion` and written with `useConfigStore.getState().setProp('lastSeenVersion', currentVersion)` — the debounced save fires automatically.
- The 13 + 19 preexisting typecheck errors are baseline noise unrelated to this feature. Future phases should track "any change in this count" rather than chasing absolute zero.
