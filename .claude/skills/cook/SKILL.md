---
name: cook
description: Implement an implementation plan phase-by-phase. Executes tasks, writes unit tests, self-tests, fixes bugs, writes phase completion notes, and stops after each phase for human review. Use when the user says "cook", "implement phase", "start coding", or references a plan.md file.
---

# Cook

Execute an implementation plan phase-by-phase — implement tasks, write tests, self-test, fix bugs, write completion notes, and stop for human review after each phase.

**Announce:** "I'm using the cook skill to execute the implementation plan."

---

## Process

**Step 1: Identify the plan**
- If user specified a feature name, look for `.docs/features/<feature-name>/plan.md`.
- If user specified a path, read it directly.
- If neither, ask: "Which implementation plan should I execute? Provide the feature name or file path."

**Step 2: Read and understand the plan**
- Read the full plan document.
- Read referenced spec and PRD for detailed requirements.
- Check `implementation-notes/` for existing phase completion notes to determine current progress.

**Step 3: Determine which phase to work on**
- If user specified a phase number, start there.
- If resuming, find the first incomplete phase (no completion note) whose dependencies are met.
- **Announce:** "Starting Phase {N}: {title}. Scope: {brief description}."

**Step 4: Checkout/verify branch**
- Check current branch: `git branch --show-current`
- Follow git workflow from `.claude/rules/common/git-workflow.md`.
- If not on the correct branch: `git checkout -b feat/<scope>/<feature-name>` from `main`.

**Step 5: Pre-implementation preparation**
- Read spec sections referenced by the phase's tasks.
- Explore the codebase with sub-agents to understand existing code the phase modifies.
- For vessel UI tasks: check existing component patterns in `apps/vessel/src/renderer/`.
- For core tasks: read existing plugins in `packages/core/src/builders/` for patterns.

**Step 6: Implement tasks**

Work through each task sequentially (unless independent — then parallelize).

For each task:
1. Read the referenced spec section.
2. Read the target file(s) to understand existing code.
3. Implement the change.
4. Run typecheck to verify no compilation errors:
   - Core: `cd packages/core && npm run typecheck`
   - Vessel: `cd apps/vessel && npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json`
   - All: `npm run typecheck:all` from root
5. Fix any type errors before moving to the next task.
6. **Commit the task:**
   ```
   git add <specific files>
   git commit -m "feat(core): add build cache plugin skeleton"
   ```

**Commit principles:**
- One commit per task. Never bundle unrelated tasks.
- Follow the `<type>(<scope>): <description>` format.
- Bug fixes found during self-testing get their own commit: `fix(<scope>): ...`

**Implementation principles:**
- Follow existing codebase patterns — match naming, structure, style of surrounding code.
- Reference the spec for exact type definitions and interfaces.
- Don't add features or refactoring beyond what the task specifies.
- Add `data-testid` to all interactive elements in vessel UI tasks.

**Step 7: Write unit tests**

After all tasks in the phase are implemented:

**Core (Vitest)**:
- Test file next to source: `foo.test.ts` beside `foo.ts`.
- Test plugin `execute()` by collecting emitted events.
- Test `shouldRun()` for all relevant flag combinations.
- Mock shell commands with `vi.mock('execa')`.
- Run: `cd packages/core && npm run test`

**Vessel — Component Tests (Playwright CT)**:
- Test file in `apps/vessel/tests/` mirroring the component.
- Naming: `<ComponentName>.spec.tsx`.
- Mock `window.api` using fixtures in `tests/mocks/`.
- Run: `cd apps/vessel && npm run test-ct`

Commit tests separately: `test(core): add unit tests for build cache plugin`

**Step 8: Self-test and fix bugs**

Run through the phase's exit criteria:
- Typecheck: `npm run typecheck:all`
- Unit tests: `npm run test:core`
- Build verification: `npm run build:core` (required before testing vessel)
- If vessel UI changed: `npm run test-ct`

Fix bugs immediately. Re-run the failing check. Don't move on with known failures.

**Step 9: Write phase completion note**

Save to `.docs/features/<feature-name>/implementation-notes/phase-{N}.md`:

```markdown
# Phase {N}: {title} — Completion Note

**Status:** Completed | Completed (mock-tested) | Partial
**Date:** {today's date}

## What was done
- {Bullet list of implemented tasks}

## Verification results
- [x] typecheck passes
- [x] unit tests pass
- [ ] {blocked item — explain why}

## Unit tests
- {Test files written and what they cover}

## Commits
**Branch:** `{branch-name}`
| Package | Commit | Message |
|---------|--------|---------|
| `packages/core` | `abc1234` | feat(core): ... |
| `apps/vessel` | `def5678` | feat(vessel): ... |

## Pending / Known issues
{None, or description of what's blocked}

## Notes for next phase
{Context the next phase implementer needs}
```

**Step 10: Stop for human review**

Present a summary:
- Phase completed, verification results
- Any pending items or blockers
- Ask: "Phase {N} is complete. Ready to proceed to Phase {N+1}?"

**Do NOT proceed without user confirmation.**

---

## Handling Special Situations

### Resuming a partially completed phase
- Check which tasks are already implemented (read files, check git log).
- Continue from where work left off.

### Blocked tasks
- Implement all other tasks. Mark blocked ones with reason.
- Set phase status to "Partial".

### Build order dependency
- Always run `npm run build:core` after changing `packages/core` before testing `apps/vessel`.
- Vessel imports the built output from `packages/core/dist/`.

---

## Notes
- The plan is the source of truth for *what* to build. The spec is the source of truth for *how* to build it.
- Phase notes accumulate in `implementation-notes/` creating an audit trail.
- Use `TaskCreate` and `TaskUpdate` to track progress within long phases.
