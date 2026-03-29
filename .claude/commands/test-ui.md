Run the full Playwright E2E test cycle for this Notepad & More Electron app. The cycle has 4 phases: Plan → Generate → Run → Heal. Complete all phases before reporting results.

## Scope

Use `$ARGUMENTS` as the test scope if provided (e.g. `/test-ui TopAppBar tooltip behaviour`).

Default scope when no arguments given — the current UI changes on branch `feature/ui-style-redesign`:
- **TopAppBar** — glass header, 6 icon buttons, brand name, quick search input
- **SideNav** — 80px left nav, logo, 6 nav items (Files/Search/View/Symbols/Tools/Plugins), Undo/Redo at bottom, active state with teal left border
- **Tooltip component** — custom portal tooltip, 300ms delay, 3 directions (top/bottom/right)
- **Sidebar** — header with teal uppercase title, close button, panel switching via SideNav
- **StatusBar** — 32px height, dark bg (not blue), status dot, teal accent
- **MD3 teal color palette** — `--bg: #131313`, `--accent: #68e5cb`, all components using CSS vars

## Critical constraints (read before generating tests)

- **Always build first**: `npm run build` — tests launch `out/main/index.js`, not the dev server
- **`E2E_TEST=1`** env var is set automatically by the test runner (disables close handler)
- **`workers: 1`** — only one Electron instance runs at a time; never use parallel workers
- **Monaco gotcha**: always click `.monaco-editor textarea` before calling `keyboard.type()`; fixture waits ~1-2s after React mount
- **IntelliSense popup**: press Escape before asserting editor content if needed
- **Native menu actions**: use `app.evaluate()` + `webContents.send(channel)` not UI clicks
- **testDir**: `./tests` — all generated specs go here
- **Session restore is disabled** in E2E mode — each test starts with a clean state

## Phase 1 — Plan

Launch the **playwright-test-planner** agent with this instruction:

> Explore the Notepad & More Electron app and create a test plan for: **[scope]**.
> Focus on user-visible behaviour and interaction flows. For each feature, list test cases with steps and expected outcomes. Save the plan to `specs/ui-redesign.md` (or a feature-specific name if $ARGUMENTS was given).

Wait for the plan file to be saved before proceeding.

## Phase 2 — Generate

Launch the **playwright-test-generator** agent with this instruction:

> Read the test plan at `specs/[plan-file].md` and generate Playwright test files in `tests/`.
> Follow the Monaco gotchas and Electron constraints from CLAUDE.md.
> Use `data-testid` selectors where available: `topbar`, `sidenav`, `sidebar`, `statusbar`, `bottom-panel`, `app`.
> For icon button tests: hover to trigger Tooltip, then assert tooltip text appears in the DOM (it renders via React portal into `document.body`).

## Phase 3 — Run

```bash
npm run build && npm run test:e2e
```

Capture: total tests, passed, failed, any error messages.

If **all tests pass** → skip Phase 4 and go straight to Report.

## Phase 4 — Heal (only if tests fail)

Launch the **playwright-test-healer** agent with this instruction:

> Fix the failing Playwright tests. The test output shows: [paste error summary].
> Diagnose whether failures are selector issues, timing issues, or assertion issues.
> Fix the test files and re-run to confirm they pass.

Repeat up to 3 heal cycles. If still failing after 3 cycles, report the remaining failures with a root-cause analysis.

## Report

Summarise:
- Tests created (new spec files and test count)
- Pass rate (e.g. 12/14 passing)
- Issues healed (what was broken and how it was fixed)
- Any remaining failures and why