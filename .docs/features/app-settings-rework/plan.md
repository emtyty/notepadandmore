# Implementation Plan: App Settings Rework

**Feature:** app-settings-rework
**Date:** 2026-04-13
**Prerequisites:** PRD, Spec, and Tests are finalized.

> References:
> - [PRD](./prd.md) — features, user stories, business rules
> - [Spec](./spec.md) — data shapes, IPC channels, menu contract
> - [Tests](./tests.md) — 31 scenarios

---

## Phase Overview

| # | Phase | Description | Depends On | Deliverable | Verification |
|---|-------|-------------|------------|-------------|--------------|
| 1 | Foundation | Buffer `kind`, `openVirtualTab`, session v3 + migration | — | Store + SessionManager primitives typecheck and unit-test cleanly | Typecheck + Vitest + sub-agent review |
| 2 | IPC + native menu | Add/remove IPC channels; drop Settings top-level; macOS App-menu `Settings…`; Windows `Ctrl+,` | P1 | `menu:settings-open` fires from macOS menu and Windows accelerator; no UI yet | Typecheck + manual IPC probe + sub-agent review |
| 3 | Virtual-tab views | `SettingsTab` + `ShortcutsTab` components; `EditorPane`/`TabBar` route on `kind`; delete `PreferencesDialog` | P1 | Programmatic `openVirtualTab('settings')` renders the Settings view | Typecheck + Playwright component tests |
| 4 | Gear icon + wire-up | MenuBar right-strip rework; gear dropdown; `App.tsx` listeners for both IPC channels; macOS gear strip | P2, P3 | Full flow works end-to-end | E2E (full `tests.md`) |

> P2 and P3 have no code overlap — **they can be executed in parallel** after P1.

---

## Phase 1: Foundation — Buffer Model + Session v3

**Goal:** Add the `kind` discriminator to `Buffer`, a `openVirtualTab` action, and migrate session persistence to v3 with a `virtualTabs` array.

**Input:** Spec §2 (Data Shapes), §2.3 (Session schema), §2.4 (order semantics), §6 (Session Restore).
**Output:** `editorStore` exposes virtual-tab helpers; `SessionManager` reads v1/v2/v3 and writes v3.

### Tasks

| # | Task | Area | Description | Verification |
|---|------|------|-------------|--------------|
| 1.1 | Add `BufferKind` type and `kind` field | `src/renderer/src/store/editorStore.ts` | Extend `Buffer` per spec §2.1; default `kind: 'file'` in `addBuffer`/`addGhostBuffer`. | `npm run typecheck` |
| 1.2 | Add `openVirtualTab` + `findVirtualBuffer` actions | `src/renderer/src/store/editorStore.ts` | Per spec §2.2. Singleton-focus semantics (BR-002). No Monaco model for virtual tabs. | Vitest unit test: open twice → one buffer, second call focuses. |
| 1.3 | Bump `Session` schema to v3 | `src/main/sessions/SessionManager.ts` | Add `virtualTabs: SessionVirtualTab[]`; update `normalize()` with v1→v2→v3 chain; malformed `virtualTabs` → `[]`; unknown `kind` → skip (spec §8). | Vitest unit test for `normalize()` with v1/v2/v3 + malformed fixtures. |
| 1.4 | Update renderer session save payload | `src/renderer/src/App.tsx` | Serialize `virtualTabs` from `buffers.filter(b => b.kind !== 'file')`; flat `activeIndex` per spec §2.4. **Decision point:** pick "separate arrays" (v3.1) vs "unified `tabs` array" — recommend unified ordered array for interleaving. Record decision in commit message. | Typecheck + spot-check by writing a session then reading it back. |
| 1.5 | Update renderer session restore | `src/renderer/src/hooks/useFileOps.ts` `restoreSession` | After ghost-buffer creation, walk `virtualTabs` and call `openVirtualTab(kind)`; respect flat `activeIndex`. | Typecheck + sub-agent review. |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 1.2 | T9, T10, T21 | Singleton focus behavior |
| 1.3 | T17, T18, T19 | v2 migration, malformed data, unknown kind |
| 1.4, 1.5 | T15, T16, T25 | Session restore round-trip |

### Phase Exit Criteria

- [ ] `npm run typecheck` passes.
- [ ] New Vitest tests for `openVirtualTab` singleton behavior pass.
- [ ] New Vitest tests for `SessionManager.normalize()` v1/v2/v3 + malformed pass.
- [ ] Sub-agent review confirms spec §2 and §6 are implemented faithfully.
- [ ] No user-facing behavior change yet (no menu/UI touched).

---

## Phase 2: IPC + Native Menu Rework

**Goal:** Remove the `Settings` top-level menu on all platforms, add macOS App-menu `Settings…` with `Cmd+,`, add Windows `Ctrl+,` accelerator, and update preload allowlist.

**Input:** Phase 1 — `openVirtualTab` exists (so the handler in Phase 4 has something to call). For this phase alone, only the IPC/menu plumbing is touched.

**Output:** `menu:settings-open` fires on macOS `App → Settings…` click, `Cmd+,`, and Windows `Ctrl+,`. No renderer listener yet.

### Tasks

| # | Task | Area | Description | Verification |
|---|------|------|-------------|--------------|
| 2.1 | Remove `Settings` top-level menu | `src/main/menu.ts` | Delete the entire top-level `Settings` block (current lines 304–335). | Typecheck + visual inspection of menu on macOS. |
| 2.2 | Add macOS App-menu `Settings…` | `src/main/menu.ts` | Insert `Settings…` after `About`, accelerator `Cmd+,`, click sends `menu:settings-open` (spec §4.1). | Manual: macOS menu shows entry, click triggers channel. |
| 2.3 | Register Windows `Ctrl+,` accelerator | `src/main/menu.ts` or `src/main/index.ts` | Implementation choice per spec §4.4. Recommended: hidden menu item with `visible: false, accelerator: 'Ctrl+,'` on Windows only. Sends `menu:settings-open`. | Manual: press `Ctrl+,` on Windows → IPC channel fires. |
| 2.4 | Update preload allowlist | `src/preload/index.ts` | **Add** `menu:settings-open`, `menu:shortcuts-open` to both `on` and `off` allowlists. **Remove** `menu:preferences`, `menu:shortcut-mapper`, `menu:udl-editor`, `menu:style-configurator`. Update `ElectronAPI` type export. | Typecheck + Playwright probe test (T23, T24). |
| 2.5 | Remove obsolete main-side emitters | `src/main/menu.ts` | Any remaining `win.webContents.send('menu:preferences' \| 'menu:shortcut-mapper' \| 'menu:udl-editor' \| 'menu:style-configurator')` references must be deleted. | `grep` audit. |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 2.1 | T2, T27 | Settings top-level removed; disabled surfaces gone |
| 2.2 | T1, T29 | macOS App-menu entry + accelerator |
| 2.3 | T30 | Windows `Ctrl+,` |
| 2.4 | T23, T24 | Channel allowlist correctness |

### Phase Exit Criteria

- [ ] `npm run typecheck` passes.
- [ ] `grep -r "menu:preferences\|menu:shortcut-mapper\|menu:udl-editor\|menu:style-configurator" src/` returns zero hits (dead references removed).
- [ ] Manually verify macOS `App → Settings…` shows `⌘,` and dispatches on click (renderer listener stub: temporary `console.log` or DevTools breakpoint).
- [ ] Manually verify Windows `Ctrl+,` dispatches.
- [ ] Sub-agent review confirms spec §3 and §4.

---

## Phase 3: Virtual-Tab Views — Settings, Shortcuts, and Removing PreferencesDialog

**Goal:** Render the Settings and Shortcuts tab views when `buffer.kind !== 'file'`; wire `TabBar` to display virtual-tab icons; delete `PreferencesDialog` and its state.

**Input:** Phase 1 — `openVirtualTab` and `BufferKind`.

**Output:** Calling `useEditorStore.getState().openVirtualTab('settings')` from DevTools opens a functional Settings tab with live-save; same for `'shortcuts'` (placeholder view). `PreferencesDialog` is gone.

### Tasks

| # | Task | Area | Description | Verification |
|---|------|------|-------------|--------------|
| 3.1 | Create `SettingsTab` component | `src/renderer/src/components/SettingsTab/SettingsTab.tsx` | Port the six-category body from `PreferencesDialog` into a non-modal component. Every input writes via `configStore.setProp` on change. No Save button. No local form state (read directly from store). Per spec §5.3. | Playwright CT: mount in isolation, change font size → `configStore` updates. |
| 3.2 | Create `ShortcutsTab` placeholder | `src/renderer/src/components/ShortcutsTab/ShortcutsTab.tsx` | Static placeholder ("Keyboard Shortcuts editor — coming soon"). Per spec §5.4. | Playwright CT: renders expected text. |
| 3.3 | Route virtual tabs in `EditorPane` | `src/renderer/src/components/EditorPane/EditorPane.tsx` | When active buffer `kind === 'settings'` render `<SettingsTab />`; `'shortcuts'` render `<ShortcutsTab />`; skip Monaco mount for those. Preserve Monaco path for `'file'`. | Typecheck + manual: `openVirtualTab('settings')` shows SettingsTab. |
| 3.4 | TabBar virtual-tab support | `src/renderer/src/components/TabBar/TabBar.tsx` | Render gear/keyboard icon per `kind`; no file-path tooltip; hide dirty dot when `kind !== 'file'`; context menu shows close-family only (spec §5.5). Drag-reorder untouched. | Playwright CT: render a virtual buffer → verify icon, absent dirty dot, context menu items (T13, T26). |
| 3.5 | Delete `PreferencesDialog` | `src/renderer/src/components/Dialogs/Preferences/*` | Remove folder. Remove import + mount from `App.tsx`. | `grep` audit. |
| 3.6 | Remove `showPreferences` from `uiStore` | `src/renderer/src/store/uiStore.ts` | Delete `showPreferences` + `setShowPreferences`. Update any callers to call `openVirtualTab('settings')` instead. | Typecheck. |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 3.1 | T11, T26 | Live-save, never dirty |
| 3.2 | T20 | Shortcuts stub tab opens |
| 3.3 | T7 (partial — rendering only) | Virtual tab shows correct view |
| 3.4 | T13, T14 | Context menu + drag-reorder |
| 3.5, 3.6 | T22 | PreferencesDialog fully removed |

### Phase Exit Criteria

- [ ] `npm run typecheck` passes.
- [ ] All new Playwright CTs pass.
- [ ] `grep -r "PreferencesDialog\|showPreferences" src/` returns zero hits.
- [ ] `grep -r "setShowPreferences" src/` returns zero hits.
- [ ] Manual: in dev console, `useEditorStore.getState().openVirtualTab('settings')` opens a working Settings tab.

---

## Phase 4: Gear Icon + Dropdown + Wire-Up

**Goal:** Replace the right-side Search and theme-toggle icons with a single gear icon; add the 4-entry dropdown; ensure the gear is visible on macOS (where MenuBar is hidden); wire `menu:settings-open`/`menu:shortcuts-open` listeners in `App.tsx`.

**Input:** Phase 2 (IPC channels) + Phase 3 (virtual tabs render).

**Output:** Full end-to-end feature. Every test in `tests.md` should pass.

### Tasks

| # | Task | Area | Description | Verification |
|---|------|------|-------------|--------------|
| 4.1 | Remove Search and theme icons from MenuBar | `src/renderer/src/components/editor/MenuBar.tsx` | Delete the two `<button>`s for Search and theme toggle in the right-side strip. Keep Toggle Sidebar. | Visual. |
| 4.2 | Remove `Settings` top-menu from MenuBar | `src/renderer/src/components/editor/MenuBar.tsx` | Remove `Settings` from `topMenus` and `menuItems`. | Visual (Windows) + T2. |
| 4.3 | Build gear dropdown component | `src/renderer/src/components/editor/SettingsMenu.tsx` (new) | 4 entries per spec §5.1: theme toggle (label flips), separator, `Keyboard Shortcuts`, `Settings`. Click-outside dismiss. Actions call `uiStore.toggleTheme()` + `configStore.setProp` for theme; `editorStore.openVirtualTab('shortcuts' \| 'settings')` for tabs. | Playwright CT (T4, T5, T6). |
| 4.4 | Place gear in MenuBar right-strip | `src/renderer/src/components/editor/MenuBar.tsx` | Add gear icon button that toggles the dropdown. Position where theme toggle lived. | Visual. |
| 4.5 | Ensure gear visible on macOS | `src/renderer/src/App.tsx` or new `TopStrip` component | Per spec §5.2: lift the right-icon strip (or render a mini-strip) so the gear is visible on macOS even though full MenuBar returns `null`. Decision in commit message. | T28. |
| 4.6 | Wire IPC listeners in `App.tsx` | `src/renderer/src/App.tsx` | `window.api.on('menu:settings-open', () => editorStore.getState().openVirtualTab('settings'))` and same for `'menu:shortcuts-open'`. Attach inside the same effect as `session:restore`. Clean up on unmount. | T8, T24, T29, T30. |
| 4.7 | Regression sweep | All | Run all tests from `tests.md`. Fix any failures. | Full E2E. |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 4.1 | T3 | Search/theme icons gone |
| 4.2 | T2 | Settings top-menu gone from Windows MenuBar |
| 4.3 | T4, T5, T6 | Dropdown structure and behavior |
| 4.5 | T28 | Gear visible on macOS |
| 4.6 | T1, T8, T29, T30 | Menu + shortcuts open Settings tab |
| 4.7 | T1–T31 | Full suite |

### Phase Exit Criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm run test:e2e` — full suite from `tests.md` passes on at least one platform.
- [ ] Manual smoke on the other platform (macOS ↔ Windows) for T1, T28, T29, T30.
- [ ] Sub-agent review: run `/review-pr`-style pass confirming spec §5 is fully implemented and no orphaned code remains from the old settings surface.

---

## Verification Strategy

### Automated Checks (per task)

| Method | When to Use | How |
|--------|-------------|-----|
| **Typecheck** | Any TS change | `npm run build` (electron-vite compiles all three bundles) or project's existing typecheck script |
| **Unit Test** | `editorStore` actions, `SessionManager.normalize()` | Vitest (add if not present — this repo currently lacks a unit test harness; Phase 1 may need to introduce `vitest` dev-dep. **If adding Vitest is out of scope for this feature, substitute a small manual test script in `scripts/` and run via `node` — note the decision in Phase 1's commit.**) |
| **Component Test** | `SettingsTab`, `ShortcutsTab`, `SettingsMenu`, `TabBar` virtual-tab rendering | Playwright CT |
| **E2E Test** | Full user flows | `npm run test:e2e` |
| **Sub-agent Review** | Schema migration, IPC allowlist changes, PreferencesDialog removal | Spawn Opus sub-agent |

### Sub-agent Review Prompts

**For Phase 1 (foundation):**
> "Review `src/renderer/src/store/editorStore.ts` and `src/main/sessions/SessionManager.ts` against `.docs/features/app-settings-rework/spec.md` §2 and §6. Confirm: (a) `Buffer.kind` is a discriminated union, defaulted correctly in both `addBuffer` and `addGhostBuffer`; (b) `openVirtualTab` is idempotent and focuses existing tab; (c) session v1→v2→v3 migration chain works; (d) malformed `virtualTabs` and unknown `kind` values are handled per §8. Report discrepancies."

**For Phase 2 (IPC/menu):**
> "Review `src/preload/index.ts` and `src/main/menu.ts` against spec §3 and §4. Confirm: (a) allowlist has exactly the additions/removals listed in §3.3; (b) macOS `App → Settings…` sits after `About` with `Cmd+,`; (c) Windows `Ctrl+,` accelerator works without a visible menu entry; (d) no orphaned `menu:preferences` / `menu:shortcut-mapper` / `menu:udl-editor` / `menu:style-configurator` references remain anywhere in `src/`."

**For Phase 4 (final sweep):**
> "Independent review: does the implementation fully realize `.docs/features/app-settings-rework/prd.md`? Check each acceptance criterion in US-001 through US-009. Flag any gaps or over-scope work. Confirm `PreferencesDialog.tsx` and `showPreferences` are truly gone (grep the repo)."

---

## Execution Notes

- **Parallelism:** Phase 2 and Phase 3 can run concurrently once Phase 1 merges. Phase 4 blocks on both.
- **Commit hygiene:** One task = one commit. Use the `feat(core)` / `refactor(core)` / `chore(core)` scopes per `.claude/rules/common/git-workflow.md`.
- **Decision points to record in commit messages:**
  - Phase 1.4: separate arrays vs unified `tabs` array in session v3.
  - Phase 2.3: hidden menu item vs `before-input-event` for Windows `Ctrl+,`.
  - Phase 4.5: lift right-strip into persistent header vs render mini-strip on macOS.
- **Build before E2E:** `npm run build` before running `test:e2e` — tests launch the built app (`out/main/index.js`).
- **E2E test env:** `E2E_TEST=1` is already honored by `src/main/index.ts`; session restore is skipped under that flag, so Phase 4's session-restore tests (T15, T16, T17, T25) need explicit session seeding or a test-only path to pre-populate `session.json`.
