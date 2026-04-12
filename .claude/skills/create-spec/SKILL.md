---
name: create-spec
description: Create a technical specification (API contract, data shapes, IPC channels, config schema, plugin interface) for a feature. Use after PRD is done, before implementation begins. Defines the contract between core library, CLI, and Vessel UI.
---

# Create Specification

Create a spec document that defines the technical contract for a feature — plugin interfaces, IPC channels, config schemas, data shapes, and event types.

**Announce:** "I'm using the create-spec skill to create a technical specification."

---

## Process

**Step 1: Clarify intent**
- If no feature specified, ask: "Which feature should I spec? Provide the feature name or path to the PRD."

**Step 2: Gather context**
- Read: `.docs/features/<feature-name>/prd.md` — primary source.
- Read: `CLAUDE.md` for architecture overview.
- Explore the codebase for existing patterns:
  - Plugin interface: `packages/core/src/types/`
  - BuildEvent types: `packages/core/src/events/`
  - IPC channels: `apps/vessel/src/preload/index.ts`
  - Config schemas: `packages/core/src/config/schema.ts`

**Step 3: Identify the contract surface**

From the user stories, derive:
- **Data shapes** — new types, interfaces, or Zod schemas needed
- **Plugin interface changes** — new methods, events, or context fields
- **IPC channels** — new renderer↔main channels if Vessel UI is involved
- **Config schema changes** — new fields in `BuildContext` or per-app configs
- **CLI flag changes** — new `--flags` or argument shapes
- **BuildEvent types** — new event types yielded by plugins

Prepare ambiguities before writing. Examples:
- "Should cache invalidation be a separate event type or part of existing events?"
- "Does this need a new IPC channel or extend an existing one?"

**Step 4: Generate the spec**
- Use the [spec-template.md](spec-template.md) template.
- Skip sections that don't apply.
- Save to `.docs/features/<feature-name>/spec.md`.

## Notes
- The spec is the contract — not an implementation guide. No `import` statements, no implementation details.
- IPC channel shapes must match what the preload exposes — keep them minimal and typed.
