# Implementation Plan: {Feature Name}

**Feature:** {feature-name}
**Date:** {date}
**Prerequisites:** PRD, Spec, and Tests must be finalized before implementation begins.

> References:
> - [PRD](./prd.md) — features, user stories, business rules
> - [Spec](./spec.md) — data shapes, IPC channels, plugin interface
> - [Tests](./tests.md) — E2E test cases

---

## Phase Overview

| # | Phase | Description | Depends On | Deliverable | Verification |
|---|-------|-------------|------------|-------------|--------------|
| 1 | {Phase Name} | {Brief description} | — | {What is produced} | Typecheck + unit tests |
| 2 | {Phase Name} | {Brief description} | Phase 1 | {What is produced} | E2E test |
| 3 | {Phase Name} | {Brief description} | Phase 1 | {What is produced} | Sub-agent review |

> Phases with no dependency between them can be executed **in parallel**.

---

## Phase 1: {Phase Name}

**Goal:** {One sentence — what this phase achieves}

**Input:** {What this phase needs — e.g., "Finalized spec §2 Data Shapes", "Existing BuildContext interface"}  
**Output:** {What this phase produces — e.g., "New Zod schemas compile cleanly, exported from index.ts"}

### Tasks

| # | Task | Package | Description | Verification |
|---|------|---------|-------------|--------------|
| 1.1 | {Task name} | `packages/core` | {What to implement} | `npm run typecheck` |
| 1.2 | {Task name} | `packages/core` | {What to implement} | Unit test (Vitest) |
| 1.3 | {Task name} | `apps/vessel` | {What to implement} | `npm run typecheck:vessel` |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 1.2 | Test 3 | {Test name from tests.md} |

### Phase Exit Criteria

- [ ] `npm run typecheck:all` passes with no errors
- [ ] `npm run test:core` passes — all new unit tests green
- [ ] Sub-agent review confirms code matches spec §{section}

---

## Phase 2: {Phase Name}

**Goal:** {One sentence}

**Input:** {Output from previous phase(s)}  
**Output:** {What this phase produces}

### Tasks

| # | Task | Package | Description | Verification |
|---|------|---------|-------------|--------------|
| 2.1 | {Task name} | `apps/vessel` | {What to implement} | Playwright CT |
| 2.2 | {Task name} | `apps/vessel` | {What to implement} | E2E test |

### Linked Tests

| Task | Test | Description |
|------|------|-------------|
| 2.2 | Test 1 | {Test name from tests.md} |

### Phase Exit Criteria

- [ ] {Criterion}
- [ ] Playwright component test passes
- [ ] E2E test passes against local dev build

---

<!-- Repeat for additional phases -->

## Verification Strategy

### Automated Checks (per task)

| Method | When to Use | How |
|--------|-------------|-----|
| **Typecheck** | All code tasks | `npm run typecheck:all` |
| **Unit Test** | Plugin logic, utilities, config parsing | `npm run test:core` (Vitest) |
| **Component Test** | React components in isolation | `npm run test-ct` (Playwright CT) |
| **E2E Test** | Full user-facing flows | `npm run test-e2e` (Playwright) |
| **Sub-agent Review** | Complex plugin logic, new schemas | Spawn independent Opus sub-agent |

### Sub-agent Review Protocol

For complex tasks, spawn an Opus sub-agent with:

> "Review the implementation of {task description} against spec §{section}. Verify:
> 1. All types/interfaces match the spec
> 2. Zod validation rules are correct
> 3. Plugin `shouldRun()` is pure (no side effects)
> 4. `execute()` yields correct BuildEvent types
> Report any discrepancies."

---

## Execution Notes

- **Parallel phases**: Phases with no dependency can run concurrently.
- **Phase handoff**: Confirm phase output matches next phase's input before proceeding.
- **Build order**: Always run `npm run build:core` after core changes before testing vessel.
- **Test linking**: After a task linked to an E2E test, run that test immediately.
