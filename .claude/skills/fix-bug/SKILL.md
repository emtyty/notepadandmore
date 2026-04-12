---
name: fix-bug
description: Systematic bug investigation and fixing. Finds root causes before applying fixes using hypothesis-driven debugging and git history analysis. Use when the user reports a bug, error, regression, or unexpected behavior. Also use when the user pastes an error message, stack trace, or describes broken behavior.
---

# Fix Bug

A structured approach: **never fix what you don't understand**. A quick patch that doesn't address the root cause will break again.

---

## Phase 0: Create a Task Checklist (MANDATORY — Do This First)

Create tasks with `TaskCreate` to track every phase:

| # | Task | Description |
|---|------|-------------|
| 1 | Understand the bug | Parse report, identify affected layer |
| 2 | Gather context | Git history, code exploration |
| 3 | Root cause analysis | Form hypotheses, verify each one |
| 4 | Plan the fix | Minimal fix, check for same pattern elsewhere |
| 5 | Implement the fix | Correct branch, make changes, self-review |
| 6 | Run existing tests | Typecheck + unit tests |
| 7 | E2E verification | Verify fix in running app via Playwright |
| 8 | Write regression tests | Tests that would have caught this bug |
| 9 | Wrap up | Summarize findings |

Mark each task `in_progress` when starting, `completed` when done.

---

## Phase 1: Understand the Bug

### 1.1 Parse the Bug Report

Extract:
- **What's happening** (the symptom)
- **What should happen** (expected behavior)
- **Where it happens** (which component, plugin, IPC channel, page)
- **When it started** (after a deploy, a merge, a config change?)
- **Reproduction steps** (if provided)

### 1.2 Identify the Affected Layer

```
Vessel UI (React/renderer)
    ↕ IPC (preload bridge)
Main Process (Electron/Node.js)
    ↕ Library call
Core (@cf-builder/core)
    ↕ Shell execution
External tools (codesign, electron-builder, AWS SDK)
```

Clues:
- UI rendering, state, or display issues → **Renderer**
- IPC call not received or wrong response → **IPC / Main**
- Build step fails, wrong output → **Core plugin**
- Tool exits with error → **Shell execution / external tool**
- Config not loaded correctly → **Config/schema**

### 1.3 Find the Feature Context

Spawn a Sonnet sub-agent to search:
- `.docs/features/` for related feature documentation
- `CLAUDE.md` for architecture overview
- Recent git commits in the affected area

---

## Phase 2: Gather Context

Use **Sonnet sub-agents** for all exploratory work to keep your main context clean.

### 2.1 Git Archaeology

```
In this repo:
1. git log --oneline -20 to see recent commits
2. git log --oneline -10 -- <affected file> to see file history
3. git diff HEAD~5..HEAD -- <relevant paths> to see recent changes
4. Report: what changed recently, which commits are most suspect
```

### 2.2 Code Exploration

```
Explore the code around [feature/plugin]:
1. Find the entry point (plugin execute(), IPC handler, React component)
2. Trace the data flow from trigger to output
3. Identify key functions involved
4. Report: execution path, key files, anything suspicious
```

### 2.3 Collect Evidence Checklist

- [ ] Symptom clearly described
- [ ] Expected vs actual behavior defined
- [ ] Affected layer identified
- [ ] Feature context found (docs or inferred)
- [ ] Recent git changes in the area reviewed
- [ ] Code execution path mapped

---

## Phase 3: Root Cause Analysis

### 3.1 Form Hypotheses

1-3 specific, testable hypotheses. Good hypothesis example:
- "The `shouldRun()` check in the electron plugin returns false when `action: 'publish-cep-panel'` because it checks for exact 'publish' match, not prefix."

### 3.2 Verify Each Hypothesis

Spawn a Sonnet sub-agent for targeted verification:
```
Verify hypothesis: [your hypothesis]
1. Read [specific file:function]
2. Check if [specific condition] is true
3. Report: confirmed or disproven, with exact code evidence
```

### 3.3 Confirm Root Cause

Explain:
- What code does wrong and why
- Why it's the root cause, not just a symptom
- Tell the user what you found before implementing the fix

---

## Phase 4: Plan the Fix

### 4.1 Minimal Fix Principle

Smallest change that correctly addresses the root cause. Don't:
- Refactor surrounding code
- Add "nice to have" improvements
- Fix unrelated issues noticed nearby

### 4.2 Check for Same Pattern Elsewhere

Spawn a Sonnet sub-agent:
```
Search for the same bug pattern as [the buggy code]:
1. Grep for [the problematic pattern/function/approach]
2. Check if other plugins/handlers/components have the same issue
3. Report: list of locations with the same pattern
```

### 4.3 Identify All Files to Change

List exact files and changes per layer.

---

## Phase 5: Implement the Fix

### 5.0 Ensure Correct Branch

- Already on the right feature/fix branch? Stay on it.
- Otherwise: `git checkout -b fix/<scope>/<short-desc>` from `main`.

### 5.1 Make the Changes

Apply the planned fix. Keep changes focused — one logical change per file.

### 5.2 Self-Review

- Does this address the root cause (not just the symptom)?
- Could this break other behavior?
- Any edge cases the fix doesn't handle?

---

## Phase 6: Run Existing Tests

```bash
# Typecheck
npm run typecheck:all

# Core unit tests
cd packages/core && npm run test

# Component tests (if vessel changed)
cd apps/vessel && npm run test-ct
```

All existing tests must pass. If a test fails:
- Your fix broke something → adjust the fix
- Test was testing the buggy behavior → update the test

**Do NOT proceed with known failures.**

---

## Phase 7: E2E Verification (DO NOT SKIP)

This verifies the fix works in the **running application**, not just in isolated tests.

### 7.1 Check Playwright Availability

Check if Playwright MCP tools are available (`mcp__playwright__*`). If not, ask the user to enable the Playwright MCP server.

If unavailable: "I couldn't verify this fix end-to-end. Please manually test [specific steps] before considering this done."

### 7.2 Test the Fix

1. Navigate to the affected page/feature in the running Vessel app.
2. Reproduce the original bug scenario.
3. Verify the bug is fixed — expected behavior now occurs.
4. Screenshot the fixed state for confirmation.
5. Test adjacent flows — make sure nothing broke.

### 7.3 If E2E Reveals the Fix Doesn't Work

1. Capture evidence (screenshot, specific failure description).
2. Return to Phase 3 if root cause was wrong, or Phase 5 if fix was incomplete.
3. Re-run from Phase 6 after adjusting.

**The bug is fixed only when the running Vessel app behaves correctly.**

---

## Phase 8: Write Regression Tests

Add a test that would have caught this bug.

**Core (Vitest)**:
```typescript
describe('plugin-name - bug description', () => {
  it('should [expected behavior] when [condition that triggered the bug]', () => {
    // Arrange: set up the state that triggered the bug
    // Act: invoke the function
    // Assert: verify correct behavior
  });
});
```

**Vessel (Playwright CT)**:
```typescript
test('component - bug description', async ({ mount }) => {
  // Arrange: set up props/state that triggered the bug
  // Act: interact
  // Assert: verify correct rendering/behavior
});
```

---

## Phase 9: Wrap Up

1. Summarize what you found and fixed.
2. Mention any similar patterns found that might need separate attention.
3. Note if the fix needs changes in multiple packages.

---

## Key Principles

| Principle | Why |
|-----------|-----|
| Track with tasks | Prevents skipping phases |
| Root cause, not symptoms | Symptom patches create whack-a-mole bugs |
| Hypothesize then verify | Prevents wasted effort on wrong theories |
| Minimal fix | Less change = less risk = easier review |
| E2E before done | Unit tests pass ≠ the fix works in the app |
| Fix-verify loop | Don't move on with known failures |
