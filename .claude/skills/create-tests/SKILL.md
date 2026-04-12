---
name: create-tests
description: Create E2E and component test cases for a feature. Use after PRD is finalized. Produces a tests.md file with functional flows, edge cases, and error scenarios for both the Vessel UI (Playwright) and core library (Vitest).
---

# Create Test Cases

Create comprehensive test cases covering functional flows, edge cases, and error scenarios.

**Announce:** "I'm using the create-tests skill to create test cases."

---

## Process

**Step 1: Clarify intent**
- If no feature specified, ask: "Which feature should I write tests for?"

**Step 2: Gather context**
- Read: `.docs/features/<feature-name>/prd.md` — acceptance criteria and business rules
- Read: `CLAUDE.md` — understand the build pipeline
- Check existing test files in `apps/vessel/tests/` and `apps/vessel/e2e/` for patterns

**Step 3: Identify test scenarios**

Map each acceptance criterion and business rule to test scenarios.

Categorize:
- **Functional** — core user flows (happy path)
- **Edge Case** — boundary values, empty states, maximum inputs
- **Error Handling** — invalid input, network failure, permission issues
- **Integration** — core library + Vessel UI working together

For Vessel UI features, note which tests are:
- **Component Tests** (Playwright CT) — isolated React component behavior
- **E2E Tests** (Playwright) — full Electron app flow

For core library features, note which tests are:
- **Unit Tests** (Vitest) — plugin logic, config parsing, event generation

**Step 4: Create tests file**
- Use the [tests-template.md](tests-template.md) template.
- Order: happy-path first, then edge cases and errors.
- Each test: clear preconditions, numbered steps, concrete expected results.
- Save to `.docs/features/<feature-name>/tests.md`.

## Notes
- Tests describe behavior from the user's perspective, not implementation details.
- Use concrete examples: "start a Luma debug build" not "start a build".
- Mark all tests as `Not Tested` initially.
