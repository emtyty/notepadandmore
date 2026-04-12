# Implementation Plan: Status Bar Selectors (Encoding, Language, EOL)

**Feature:** statusbar-selectors
**Date:** 2026-04-12
**Prerequisites:** PRD and Spec finalized. Tests document pending (`/create-tests`).

> References:
> - [PRD](./prd.md) — features, user stories, business rules
> - [Spec](./spec.md) — data shapes, event contracts, component contracts

---

## Phase Overview

| # | Phase | Description | Depends On | Deliverable | Verification |
|---|-------|-------------|------------|-------------|--------------|
| 1 | Registry constants | Canonical encoding, language, and EOL lookup tables | — | New `registries.ts` with typed constants and lookup helpers | Typecheck |
| 2 | QuickPick component | Reusable overlay with search, keyboard nav, active-item marking | Phase 1 | New `QuickPick.tsx` component | Typecheck + dev server |
| 3 | StatusBar integration | Wire three pickers into StatusBar, replace cycle logic, resolve display names | Phase 1, 2 | Updated `StatusBar.tsx` with clickable items opening QuickPick | Typecheck + dev server |
| 4 | Menu removal | Remove Encoding and Language from native menu and custom MenuBar | Phase 3 | Updated `menu.ts` and `MenuBar.tsx` | Typecheck + dev server |

> Phases are sequential — each builds on the previous.

---

## Phase 1: Registry Constants

**Goal:** Establish the single source of truth for encoding, language, and EOL value ↔ display name mappings, as defined in Spec §2.

**Input:** Spec §2.1 (Encoding Registry), §2.2 (Language Registry), §2.3 (EOL Registry)
**Output:** New file `src/renderer/src/constants/registries.ts` exporting typed constants and lookup functions.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 1.1 | Create encoding registry | `src/renderer/src/constants/registries.ts` | Define `EncodingEntry` type and `ENCODINGS` array with all 6 entries per Spec §2.1. Export `getEncodingLabel(value: string): string` that returns `label` for a given internal value, falling back to the raw value if not found. | `npm run build` |
| 1.2 | Create language registry | `src/renderer/src/constants/registries.ts` | Define `LanguageEntry` type and `LANGUAGES` array with all 22 entries per Spec §2.2. Export `getLanguageLabel(value: string): string` that returns `label`, falling back to title-cased value. | `npm run build` |
| 1.3 | Create EOL registry | `src/renderer/src/constants/registries.ts` | Define `EOLEntry` type and `EOLS` array with 3 entries per Spec §2.3. Export `getEOLShort(value: string): string` that returns `short` form. | `npm run build` |

### Phase Exit Criteria

- [ ] `npm run build` passes with no errors
- [ ] All three registries export correctly typed arrays and lookup functions
- [ ] Values match Spec §2 tables exactly (encoding values align with `chardet`/`iconv-lite` names)

---

## Phase 2: QuickPick Component

**Goal:** Build the reusable QuickPick overlay component per Spec §4.1, following existing dialog patterns (fixed positioning, `bg-popover` theme, Escape to close).

**Input:** Phase 1 complete (registry types available). Spec §2.4 (QuickPick Props), §4.1 (Component Contract).
**Output:** New `QuickPick.tsx` component ready to be consumed by StatusBar.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 2.1 | Create QuickPick component shell | `src/renderer/src/components/QuickPick/QuickPick.tsx` | Implement the `QuickPickProps` interface from Spec §2.4. Render a fixed overlay: backdrop (`fixed inset-0 z-[9000] bg-black/30`), dialog container (`fixed z-[9001] bg-popover border border-border rounded-lg shadow-2xl`) centered horizontally ~60px from top, width `min(400px, 90vw)`. Click backdrop to close. | `npm run build` |
| 2.2 | Add search input | `src/renderer/src/components/QuickPick/QuickPick.tsx` | Render a text input with `placeholder` prop at top of dialog. Auto-focus on mount via `useRef` + `useEffect`. Filter `items` array by case-insensitive substring match on `item.label`. | `npm run build` |
| 2.3 | Add list rendering with active marker | `src/renderer/src/components/QuickPick/QuickPick.tsx` | Render filtered items as a scrollable list (max-height ~300px). Item matching `activeValue` shows a checkmark icon on the left. Each item shows `label` and optional `description`. Hover: `hover:bg-secondary`. Empty state: "No matching items" text. | `npm run build` |
| 2.4 | Add keyboard navigation | `src/renderer/src/components/QuickPick/QuickPick.tsx` | Track `highlightedIndex` via `useState`. Arrow Up/Down moves highlight (wrap around). Enter calls `onSelect(items[highlightedIndex].value)`. Escape calls `onClose()`. Reset highlight to 0 when filter changes. First item highlighted by default. | `npm run build` |
| 2.5 | Add fade-in animation | `src/renderer/src/components/QuickPick/QuickPick.tsx` | Add `animate-in fade-in duration-100` or equivalent Tailwind animation class on mount. Keep it simple — no exit animation needed (matches existing dialog patterns). | `npm run build` |

### Phase Exit Criteria

- [ ] `npm run build` passes
- [ ] QuickPick renders correctly with mock data in dev server (manual test)
- [ ] Search filters items in real time
- [ ] Arrow keys navigate, Enter selects, Escape closes
- [ ] Active item shows checkmark
- [ ] Backdrop click closes

---

## Phase 3: StatusBar Integration

**Goal:** Replace the StatusBar's cycle-on-click behavior with QuickPick popups for all three selectors, and use registry lookup for display names. Implements PRD US-003 through US-008.

**Input:** Phase 1 (registries) and Phase 2 (QuickPick component) complete. Spec §4.2 (StatusBar Item Updates), §4.3 (Display Name Resolution), §5.4 (Cycle Logic Removal).
**Output:** Updated `StatusBar.tsx` where clicking EOL/Encoding/Language opens a QuickPick.

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 3.1 | Add local picker state | `src/renderer/src/components/StatusBar/StatusBar.tsx` | Add `useState<'encoding' \| 'language' \| 'eol' \| null>(null)` for `activePicker`. Per Spec §2.5, this is local state — not Zustand. | `npm run build` |
| 3.2 | Replace encoding click handler | `src/renderer/src/components/StatusBar/StatusBar.tsx` | Remove `cycleEncoding` callback and `ENCODING_CYCLE` constant. Replace `onClick` on encoding `<span>` with `() => buf && setActivePicker('encoding')`. Guard on `buf` existing (BR-003). | `npm run build` |
| 3.3 | Replace EOL click handler | `src/renderer/src/components/StatusBar/StatusBar.tsx` | Remove `cycleEOL` callback and `EOL_CYCLE` constant. Replace `onClick` on EOL `<span>` with `() => buf && setActivePicker('eol')`. | `npm run build` |
| 3.4 | Make language label clickable | `src/renderer/src/components/StatusBar/StatusBar.tsx` | Add `onClick={() => buf && setActivePicker('language')}` and hover styling to the language `<span>` (currently static text). | `npm run build` |
| 3.5 | Render QuickPick for encoding | `src/renderer/src/components/StatusBar/StatusBar.tsx` | When `activePicker === 'encoding'`, render `<QuickPick>` with `items={ENCODINGS}`, `activeValue={buf.encoding}`, `placeholder="Select Encoding"`. On select, dispatch `CustomEvent('editor:set-encoding', { detail: value })` and set `activePicker` to `null`. | `npm run build` |
| 3.6 | Render QuickPick for language | `src/renderer/src/components/StatusBar/StatusBar.tsx` | When `activePicker === 'language'`, render `<QuickPick>` with `items={LANGUAGES}`, `activeValue={buf.language}`, `placeholder="Select Language"`. On select, dispatch `CustomEvent('editor:set-language-local', { detail: value })` and set `activePicker` to `null`. | `npm run build` |
| 3.7 | Render QuickPick for EOL | `src/renderer/src/components/StatusBar/StatusBar.tsx` | When `activePicker === 'eol'`, render `<QuickPick>` with `items={EOLS}`, `activeValue={buf.eol}`, `placeholder="Select End of Line Sequence"`. On select, dispatch `CustomEvent('editor:set-eol', { detail: value })` and set `activePicker` to `null`. | `npm run build` |
| 3.8 | Use registry for display names | `src/renderer/src/components/StatusBar/StatusBar.tsx` | Replace raw `buf.encoding`, `buf.language`, `buf.eol` display with `getEncodingLabel()`, `getLanguageLabel()`, `getEOLShort()` from registries. Per Spec §4.3. | `npm run build` |
| 3.9 | Update hover styling | `src/renderer/src/components/StatusBar/StatusBar.tsx` | Apply consistent hover styling to all three clickable items: `cursor-pointer hover:bg-[var(--color-statusbar-foreground)]/10 px-1 rounded` (or similar subtle background highlight). Replace the old `hover:underline decoration-dotted`. | `npm run build` |
| 3.10 | Close picker on tab switch | `src/renderer/src/components/StatusBar/StatusBar.tsx` | Add `useEffect` watching `activeId` from `editorStore`. When `activeId` changes and `activePicker` is not null, set `activePicker` to `null`. Per Spec BR-006. | `npm run build` |

### Phase Exit Criteria

- [ ] `npm run build` passes
- [ ] Clicking encoding/language/EOL in status bar opens the correct QuickPick (manual dev server test)
- [ ] Selecting an option applies the change to the active buffer
- [ ] Status bar labels show human-readable names from registries
- [ ] Clicking with no buffer open does nothing
- [ ] Switching tabs closes any open picker
- [ ] Old cycle behavior is fully removed

---

## Phase 4: Menu Removal

**Goal:** Remove the Encoding and Language top-level menus from both the native Electron menu and the custom MenuBar. Implements PRD US-009, Spec §5.1–§5.3.

**Input:** Phase 3 complete — status bar is the sole entry point for encoding/language/EOL selection.
**Output:** Cleaner menu bar with 8 remaining top-level menus (9 on macOS with App menu).

### Tasks

| # | Task | File | Description | Verification |
|---|------|------|-------------|--------------|
| 4.1 | Remove Encoding menu from native menu | `src/main/menu.ts` | Delete the Encoding section (lines ~304–325) from the `template` array. This removes all 6 encoding items and the EOL submenu from the native menu. | `npm run build` |
| 4.2 | Remove Language menu from native menu | `src/main/menu.ts` | Delete the Language section (lines ~328–356) from the `template` array. This removes Auto Detect, Plain Text, and all 20 language items. | `npm run build` |
| 4.3 | Remove Encoding section from custom MenuBar | `src/renderer/src/components/editor/MenuBar.tsx` | Delete the `Encoding` key from the `menus` object (lines ~183–199). Remove `'Encoding'` from the `topMenus` array. | `npm run build` |
| 4.4 | Remove Language section from custom MenuBar | `src/renderer/src/components/editor/MenuBar.tsx` | Delete the `Language` key from the `menus` object (lines ~200–224). Remove `'Language'` from the `topMenus` array. | `npm run build` |
| 4.5 | Verify no orphaned references | All renderer files | Grep for `'Encoding'` and `'Language'` menu references across the codebase. Ensure no dead imports, broken menu key references, or stale comments. Preload IPC allowlist channels (`editor:set-encoding`, `editor:set-eol`, `editor:set-language`) remain — they are still consumed by EditorPane. | `npm run build` + grep |

### Phase Exit Criteria

- [ ] `npm run build` passes
- [ ] Native menu shows: File, Edit, Search, View, Settings, Macro, Plugins, Window, Help (+ App on macOS)
- [ ] Custom MenuBar shows same menus without Encoding and Language
- [ ] No runtime errors or console warnings from removed menus
- [ ] Encoding/language/EOL changes still work via status bar pickers (regression test)
- [ ] IPC channels in preload allowlist remain intact

---

## Verification Strategy

### Automated Checks (per task)

| Method | When to Use | How |
|--------|-------------|-----|
| **Typecheck** | All code tasks | `npm run build` (electron-vite compiles all three bundles) |
| **Dev server** | UI changes (Phases 2–4) | `npm run dev` → manual interaction test |
| **Grep** | Removal tasks (Phase 4) | Verify no orphaned references |
| **E2E test** | After all phases | `npm run test:e2e` — once tests are created via `/create-tests` |

### Manual Test Checklist (Dev Server)

After each phase that touches UI (Phases 2–4), manually verify on `npm run dev`:

1. Open a file → encoding/language/EOL labels show in status bar with correct display names
2. Click encoding label → Quick Pick opens with all 6 encodings, current one checked
3. Type to filter → list narrows
4. Arrow keys → highlight moves
5. Enter → selection applies, picker closes, status bar updates
6. Escape → picker closes, no change
7. Click backdrop → picker closes, no change
8. Repeat for language and EOL pickers
9. Switch tabs while picker is open → picker closes
10. No file open (welcome screen) → clicking status bar items does nothing
11. Verify menus (Phase 4): no Encoding or Language in menu bar

---

## Execution Notes

- **No parallel phases** — each phase builds on the previous.
- **Commits**: One commit per task (or per phase if tasks are small). Commit messages: `feat(core): <description>`.
- **Encoding normalization**: Phase 1 defines canonical values aligned with `chardet` output. If existing buffers have old-format values (e.g., `'utf8'` from the old menu), the registry lookup falls back to displaying the raw value. A migration of existing values is out of scope.
- **Tests document**: Create via `/create-tests` after Phase 4 to define E2E test cases for the complete feature.
