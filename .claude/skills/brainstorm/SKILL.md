---
name: brainstorm
description: Brainstorm and clarify feature ideas before creating a PRD. Use when the user has a rough idea about a new builder plugin, CI/CD improvement, config system change, or UI feature but hasn't defined scope clearly enough for a PRD. Also use when the user says "I'm thinking about...", "what if we...", "how should we approach...", or describes a problem without a clear solution.
---

# Brainstorm: Clarify Ideas Before PRD

Turn a rough idea or problem statement into well-defined requirements ready for PRD creation.

**Announce:** "I'm using the brainstorm skill to clarify this idea before writing a PRD."

---

## Process

### Step 1: Capture the raw idea

Restate what the user said in 1-2 sentences: "So the core idea is: **{restatement}**. Let me ask a few questions to sharpen this."

### Step 2: Gather project context

Before asking questions, read:
- `.docs/features/` — existing feature documentation
- `CLAUDE.md` — current architecture and build pipeline
- Relevant source files if the idea touches existing code

This helps ask better questions and avoid suggesting things that already exist.

### Step 3: Guided exploration

Run through these dimensions conversationally — 2-3 questions per round, not all at once.

**Problem & Value**
- What specific problem does this solve in the build pipeline?
- What's the current workaround, and why is it insufficient?
- How would we measure success? (build time, reliability, developer experience?)

**Users & Scenarios**
- Who triggers this? (developer locally, CI runner, Vessel UI user?)
- Walk through a concrete scenario: a developer wants to build Luma for UAT, they open Vessel, and then what happens?
- Are there apps or environments where this behaves differently?

**Scope & Boundaries**
- What's the smallest version that still delivers value? (MVP)
- What might people assume is included but shouldn't be?
- Does this affect the CLI? The Vessel UI? Both? The core library?

**Constraints & Risks**
- Any platform constraints? (macOS only, requires Xcode, needs AWS credentials?)
- Any timing constraints? (CI job time limits, code signing server availability?)
- What could break if this is implemented incorrectly?

**Existing landscape**
- Surface related patterns already in the codebase (e.g., "the `s3-upload` plugin already has retry logic…").
- Note any in-progress work that might overlap.

### Step 4: Challenge and refine

- Challenge assumptions: "You mentioned {X} — is that always true?"
- Identify gaps: "We haven't talked about what happens when the build fails mid-pipeline."
- Simplify: "This sounds like two separate features — caching and parallelism. Split them?"

### Step 5: Classify requirements

- **Features** — what the system should do
- **User Stories** — who does what and why
- **Business Rules** — constraints (e.g., "only cache if git tree is clean")
- **Dependencies** — what else needs to be in place
- **Out-of-Scope** — explicitly excluded

### Step 6: Write notes

Write notes to `.docs/features/<feature-name>/raw/notes.md`. Record:
- Open questions
- Decisions made with rationale
- Scope changes agreed upon
- Classified requirements

Update incrementally — append, don't rewrite.

Once done, present a summary and ask:
> "Does this capture your thinking? Ready to move to `/create-prd`?"

---

## Guidelines

- Be a thought partner, not a stenographer — push back, surface risks, suggest alternatives.
- Stay focused on *what* and *why*, not *how* (implementation is for later).
- Know when to stop — if the idea is clear, write the notes and move on.
