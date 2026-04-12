---
name: run-e2e
description: Run E2E tests from a tests.md file against the running Vessel app using Playwright MCP. Reads the PRD to prioritize tests by feature importance, picks the top 5 unverified tests, executes them via browser automation, and marks each as Passed or Failed. Use when the user says "run tests", "verify tests", "check tests", or "run e2e".
---

# Run E2E Tests

Execute E2E tests from `tests.md` against the running Vessel Electron app using Playwright MCP.

**Announce:** "I'm using the run-e2e skill to verify tests from tests.md."

---

## Important Rules

- **Never fix bugs automatically.** Report failures clearly — don't attempt to fix code.
- **Never skip steps.** Follow each test's steps exactly as written.
- **Always take screenshots.** Capture after each significant action.
- **Update tests.md after each test.** Mark immediately, don't batch.

---

## Process

### Step 1: Identify the feature and read documents

1. Determine feature name (from user input or current branch name).
2. Read `.docs/features/<feature-name>/tests.md` — the test cases.
3. Read `.docs/features/<feature-name>/prd.md` — feature priorities.

### Step 2: Parse tests and determine priority

Filter: only `Not Tested` and `Failed` tests.

Prioritize using PRD feature priority:
1. **Must Have** features first
2. **Should Have** features second
3. Prefer happy-path/functional tests over edge cases within the same tier

**Select exactly 5 tests** (or fewer if less available). Present selection to user:
```
Selected tests to verify (by priority):
1. Test 1: {title} (F1 - Must Have)
2. Test 3: {title} (F1 - Must Have)
...
Starting verification now.
```

### Step 3: Prepare the app

1. Check if Vessel app is running — take a snapshot to see current state.
2. If not running, ask user to start it: `cd apps/vessel && npm run dev`
3. Navigate to the correct starting point per test's preconditions.

### Step 4: Execute tests one by one

For each selected test:

#### 4a. Announce the test
```
--- Test {N}: {title} ---
Preconditions: {list}
```

#### 4b. Set up preconditions
- Navigate to required page/state as described in preconditions.
- If a precondition requires a specific build state (e.g., "a completed Luma build"), look for it in the app's history or trigger it.

#### 4c. Execute each step
For each numbered step:
1. Take a **snapshot** to identify interactive elements.
2. Perform the action (click, type, navigate, observe).
3. Take a **screenshot** for evidence.
4. Verify the step's expected outcome.

Use Playwright MCP tools:
- `browser_snapshot` — read accessibility tree
- `browser_click` — click buttons/links
- `browser_type` — type into inputs
- `browser_take_screenshot` — capture visual evidence
- `browser_navigate` — go to URL/route

#### 4d. Evaluate results
A test **passes** only if ALL expected result bullets are confirmed.  
A test **fails** if ANY expected result is not met.

#### 4e. Record verdict
```
Result: PASSED / FAILED
[If FAILED]: Expected: ... | Actual: ...
```

#### 4f. Update tests.md immediately
- Passed: `**Status:** Passed ({YYYY-MM-DD})`
- Failed: `**Status:** Failed ({YYYY-MM-DD}) — {brief reason}`

### Step 5: Summary report

After all tests:

```
## E2E Test Run Summary — {feature-name}
Date: {YYYY-MM-DD}

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | {title} | Passed | — |
| 3 | {title} | FAILED | {brief} |

Passed: X/5 | Failed: Y/5
```

**If ALL passed**: No report file needed. `tests.md` updates are sufficient.

**If ANY failed**: Write report to `.docs/features/<feature-name>/raw/e2e-report-{YYYY-MM-DD}.md`:
```markdown
# E2E Report — {feature-name}
Date: {YYYY-MM-DD} | Tests: {N} | Passed: {P} | Failed: {F}

## Failed Tests

### Test {N}: {title}
- Expected: {what should have happened}
- Actual: {what actually happened}
- Steps to reproduce: {specific steps}
- Screenshots: {list}
```

Tell the user: "I found failures and wrote a report to [...]. I'm not fixing them automatically — let me know if you'd like me to investigate."

---

## Handling Common Situations

**Vessel app not running**: Ask user to start it. Cannot proceed without the app running.

**App requires build artifacts**: Some E2E tests need the Vessel app in production mode (`npm run build:vessel`). Check if dev mode is sufficient or if a full build is needed.

**Test depends on a real build**: For tests requiring `build` project (real build pipeline), remind user this takes significant time and may need AWS credentials.

**Flaky element**: Use `browser_snapshot` for detection. If inconsistent, attempt twice before declaring failure.

---

## Notes
- Screenshots saved to `.tmp/screenshots/` — gitignored.
- Tests execute in priority order, not test number order.
- Always update `tests.md` immediately after each test — don't batch.
