---
name: create-prd
description: Create a Product Requirements Document (PRD) for a new feature — a new builder plugin, config system change, CI/CD improvement, or Vessel UI feature. Use after brainstorming or when the user provides a clear feature request.
---

# Create PRD

Create a comprehensive PRD outlining features, user stories, business rules, dependencies, and out-of-scope items.

**Announce:** "I'm using the create-prd skill to create a PRD."

---

## Process

**Step 1: Clarify intent**
- If the user hasn't provided a clear feature description, ask: "What feature should I write a PRD for?"

**Step 2: Gather context**
- Read relevant documents:
  - `.docs/features/<feature-name>/raw/notes.md` — brainstorm notes (primary input if exists)
  - `.docs/features/*.md` — related feature docs
  - `CLAUDE.md` — current architecture
- Check the codebase for related existing code (e.g., existing plugins, config patterns).

**Step 3: Classify requirements**
- If requirements are ambiguous, ask for clarification before writing.
- Classify into: Features, User Stories, Business Rules, Dependencies, Out-of-Scope.
- Write notes to `.docs/features/<feature-name>/raw/notes.md`.

**Step 4: Create PRD**
- Use the [prd-template.md](prd-template.md) template.
- Break features into user stories with acceptance criteria.
- Save to `.docs/features/<feature-name>/prd.md`.
- Announce: "PRD saved at `.docs/features/<feature-name>/prd.md`."

## Notes
- PRD covers *what* and *why* — no implementation details or technical specs.
- Focus on the developer/operator experience, not internal code structure.
