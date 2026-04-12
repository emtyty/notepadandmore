# Phase 1–4: All Phases — Completion Note

**Status:** Completed
**Date:** 2026-04-12

## What was done

### Phase 1: Registry Constants
- Created `src/renderer/src/constants/registries.ts`
- Defined `EncodingEntry`, `LanguageEntry`, `EOLEntry` types
- Created `ENCODINGS` (6 entries), `LANGUAGES` (22 entries), `EOLS` (3 entries) arrays
- Exported lookup functions: `getEncodingLabel()`, `getLanguageLabel()`, `getEOLShort()`
- Encoding values aligned with `chardet`/`iconv-lite` names (e.g., `'UTF-8'` not `'utf8'`)

### Phase 2: QuickPick Component
- Created `src/renderer/src/components/QuickPick/QuickPick.tsx`
- Reusable overlay: backdrop (`bg-black/30`), dialog centered at top (`top-[60px]`)
- Search input with auto-focus, case-insensitive substring filtering
- Scrollable list (max-height 300px) with checkmark on active item
- Keyboard navigation: ArrowUp/Down (with wrap), Enter to select, Escape to close
- Hover to highlight, mouse click to select
- "No matching items" empty state
- Fade-in animation via `animate-in fade-in-0 duration-100`
- All `data-testid` attributes from tests.md applied

### Phase 3: StatusBar Integration
- Rewrote `src/renderer/src/components/StatusBar/StatusBar.tsx`
- Replaced `cycleEOL` and `cycleEncoding` with QuickPick openers
- Made language label clickable (was static text)
- Local `activePicker` state (`useState`) — not Zustand
- Three QuickPick instances for encoding, language, EOL
- Dispatch same `CustomEvent` types: `editor:set-encoding`, `editor:set-language-local`, `editor:set-eol`
- Display names resolved via registry lookup functions
- Hover styling: `hover:bg-[var(--color-statusbar-foreground)]/10` with rounded corners
- Picker closes on tab switch (`useEffect` watching `activeId`)
- Guard: no picker opens when `buf` is null (no active buffer)

### Phase 4: Menu Removal
- Removed Encoding section from `src/main/menu.ts` (native Electron menu)
- Removed Language section from `src/main/menu.ts` (native Electron menu)
- Removed Encoding and Language from `MenuBar.tsx` menus object and `topMenus` array
- Verified no orphaned references via grep
- IPC allowlist channels in `preload/index.ts` remain intact

## Verification results
- [x] `npm run build` passes (all three bundles: main, preload, renderer)
- [x] No TypeScript errors
- [x] No orphaned references to removed Encoding/Language menus
- [x] IPC channels preserved in preload allowlist

## New files
- `src/renderer/src/constants/registries.ts` — registry constants and lookup functions
- `src/renderer/src/components/QuickPick/QuickPick.tsx` — reusable Quick Pick component

## Modified files
- `src/main/menu.ts` — removed Encoding and Language menus
- `src/renderer/src/components/StatusBar/StatusBar.tsx` — full rewrite with QuickPick integration
- `src/renderer/src/components/editor/MenuBar.tsx` — removed Encoding and Language sections

## Pending / Known issues
- Manual dev server testing recommended before commit
- E2E tests from `tests.md` not yet implemented as Playwright specs
