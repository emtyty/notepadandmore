# Phase 2: Component shell + render wiring — Completion Note

**Status:** Completed
**Date:** 2026-04-13

## What was done

- **Task 2.1** — Created `src/renderer/src/components/WhatsNewTab/WhatsNewTab.tsx`. Renders a header bar with the static title `"What's New"` and a centered placeholder body (`Sparkles` icon + "Coming soon" headline + brief explainer). Mirrors the layout/styling-token discipline of `ShortcutsTab.tsx`. `data-testid="whatsnew-tab"`.
- **Task 2.2** — Imported `WhatsNewTab` in `src/renderer/src/App.tsx` and added the third virtual-tab render branch (after the existing `'settings'` and `'shortcuts'` branches), wrapped in the same `<div className="absolute inset-0 bg-background z-10">` overlay used by the other two kinds.
- **Task 2.3** — Imported `Sparkles` from `lucide-react` in `TabBar.tsx` and added the kind-icon branch for `whatsNew`, matching the props (`size={18} className="shrink-0 opacity-80"`) used by `'settings'` and `'shortcuts'`.

## Verification results

- [x] `npx tsc --noEmit -p tsconfig.web.json` — 13 errors, **all preexisting baseline** (none in any file touched by this phase). Stable across all 3 task commits.
- [x] Sub-agent (`code-reviewer`) review: passed all 6 verification points (structure mirrors ShortcutsTab, title exactly "What's New", "Coming soon" body present, render switch wiring correct, tab-bar icon wiring correct, no regressions to the existing 'settings'/'shortcuts' branches).

## Tests

None at this phase. Tests 7 (title) and 8 (placeholder body) from `tests.md` are linked to Phase 3 because they need the Help-menu entry point to drive them E2E.

For interim manual verification (developer console in `npm run dev`), exposing the store on `window` lets you smoke-test:
```js
;(window as any).__editor = useEditorStore  // add this temporarily in App.tsx if needed
useEditorStore.getState().openVirtualTab('whatsNew')
```
The tab should appear with the Sparkles icon and the "Coming soon" body. Remove the temporary expose before committing.

## Commits

**Branch:** `master`

| Commit | Message |
|--------|---------|
| `7433eac` | feat(core): add WhatsNewTab placeholder component |
| `cd5834f` | feat(core): mount WhatsNewTab in the virtual-tab render switch |
| `7a9e42b` | feat(core): add Sparkles tab-bar icon for whatsNew kind |

## Pending / Known issues

None. Phase 2 complete.

## Notes for next phase (Phase 3 — Manual open via Help menu)

- The `WhatsNewTab` component mounts correctly; Phase 3 only needs to provide an entry point. After Phase 3, `Help → What's New` will produce a visible, themed tab with the Sparkles icon and the "Coming soon" body — fully sufficient to drive E2E Tests 1, 2, 7, 8, 11.
- The `App.tsx` render switch (~lines 364–372) and tab-bar icon section (TabBar.tsx ~lines 150–152) are now full reference patterns for any future virtual-tab kinds.
- `Sparkles` icon was chosen over alternatives (`Newspaper`, `Megaphone`, `PartyPopper`) for "shiny new things" semantics. Documented in commit `7a9e42b` for future reference.
