---
name: create-plan
description: Create a phased implementation plan for a feature, with independent phases, clear input/output contracts per phase, task-level verification, and linked tests. Use after PRD and spec are finalized.
---

# Create Implementation Plan

Break a feature into independent, verifiable phases with clear input/output boundaries.

**Announce:** "I'm using the create-plan skill to create a phased implementation plan."

---

## Process

**Step 1: Clarify intent**
- If no feature specified, ask: "Which feature should I plan? Provide the feature name."

**Step 2: Read all source documents**

All three must exist before planning:
- `.docs/features/<feature-name>/prd.md` — features, stories, acceptance criteria
- `.docs/features/<feature-name>/spec.md` — data shapes, IPC channels, plugin interface
- `.docs/features/<feature-name>/tests.md` — E2E test cases

If any document is missing, tell the user and suggest the skill: `/create-prd`, `/create-spec`, or `/create-tests`.

**Step 3: Analyze the codebase**

Spawn Explore sub-agents to understand:
- **Existing plugin patterns**: How existing builders in `packages/core/src/builders/` are implemented
- **IPC patterns**: How existing channels are defined in `apps/vessel/src/preload/` and handled in `ipc-handlers.ts`
- **Zustand store patterns**: How existing stores in `apps/vessel/src/renderer/stores/` are structured
- **Test patterns**: Component test and E2E test patterns already in the codebase

**Step 4: Design the phases**

Follow these principles:
1. **Foundation first**: Core types, Zod schemas, BuildContext changes — things other phases depend on.
2. **Core before Vessel**: Implement and test the core library before building the UI that consumes it.
3. **Smallest verifiable unit**: Each phase produces something testable in isolation.
4. **E2E tests at the boundary**: Link to specific tests from `tests.md` at the phase that completes a user-facing flow.

For each phase, define:
- **Input**: What must be in place before this phase starts
- **Output**: Exactly what this phase produces
- **Tasks**: Concrete implementation tasks with verification method
- **Linked tests**: Which tests from `tests.md` can run after this phase
- **Exit criteria**: Checkboxes that must all pass

**Step 5: Assign verification methods**

Every task needs one:
- **Typecheck**: `npm run typecheck` — for type/interface/schema changes
- **Unit test**: `npm run test:core` (Vitest) — for plugin logic, utility functions
- **Sub-agent review**: Independent review against spec — for complex logic, new plugin implementations
- **E2E test**: Playwright CT or E2E test — for user-facing flows

**Step 6: Ask for alignment**

Present the phase overview table and ask:
- "Does this phase breakdown look right?"
- "Any phases to split, merge, or reorder?"

**Step 7: Generate the plan**
- Use the [plan-template.md](plan-template.md) template.
- Save to `.docs/features/<feature-name>/plan.md`.

## Notes
- One task = one focused commit. If a task says "implement X, Y, Z" it's three tasks.
- Link E2E tests to the **last phase** that completes the flow.
- Foundation phases (no user-facing behavior) are verified by typecheck + sub-agent review — by design.
