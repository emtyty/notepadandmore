---
name: discovery
description: Analyze and document a feature, flow, or system in this codebase. Outputs a structured markdown file into docs/<feature>/ directory. USE WHEN the user asks to "discovery", "analyze", "research", "tổng hợp flow", "phân tích", or wants to understand how something works and save the result.
---

# Discovery Skill

You are performing a **discovery** — a structured analysis of a feature, flow, or system in this codebase. Your job is to read code, synthesize findings, and write the result to a file.

## Output Rules

**ALWAYS write output to a file. Never just print to chat.**

### File path convention

```
docs/<feature>/<topic>.md
```

- `<feature>` — the domain/area being analyzed (e.g. `startup`, `auth`, `ipc`, `services`, `ui`, `store`, `network`)
- `<topic>` — the specific thing analyzed (e.g. `flow`, `architecture`, `comparison`, `optimization`)

Examples:
```
docs/startup/flow-analysis.md
docs/auth/oauth-flow.md
docs/ipc/channel-map.md
docs/services/dotnet-lifecycle.md
docs/ui/component-inventory.md
```

If the user specifies a feature/topic name, use it. Otherwise infer from context.

### File format

Every discovery file must start with:

```markdown
# <Title>

> **Feature**: <feature> | **Topic**: <topic> | **Date**: <YYYY-MM-DD>
> **Sources**: list of files/paths analyzed

## Summary
One paragraph explaining what was discovered and why it matters.
```

Then continue with structured sections appropriate to the topic.

## Discovery Process

### Step 1 — Understand the scope
Read the user's request carefully. Identify:
- What feature/area to analyze
- Which codebase(s) to look at (legacy apps at `/Users/haht/Documents/creativeforce/lighthouseink/`, `lighthousehue/`, `lighthouseluma/`, `lighthousekelvin/` — or cf-desktop packages/apps)
- What question to answer

### Step 2 — Read code systematically
- Start from entry points (main.ts, index.ts, app.ts)
- Follow imports to understand dependencies
- Read actual code, not just file names
- Note patterns: sequential vs parallel, blocking vs async, error handling

### Step 3 — Synthesize findings
Structure your findings by:
- **What exists** (current state)
- **How it works** (flow / sequence)
- **Limitations / problems** (what's wrong or could be better)
- **Recommendations** (what to do in cf-desktop)

### Step 4 — Write to file
Create the docs file. If the `docs/<feature>/` folder doesn't exist yet, create it.

Then confirm to the user: "Đã ghi kết quả vào `docs/<feature>/<topic>.md`"

## Section Templates by Discovery Type

### Flow Analysis
```markdown
## Flow Diagram
[ASCII or mermaid diagram of the sequence]

## Step-by-step breakdown
### Step N — <name>
- What it does
- Files involved
- Blocking/async?

## Limitations
- ...

## Recommendations for cf-desktop
- ...
```

### Architecture Analysis
```markdown
## Component Map
[Overview of components and relationships]

## Dependency Graph
[Which depends on what]

## Patterns Used
- Pattern: explanation

## Gaps / Missing pieces
- ...
```

### Comparison (Legacy vs New)
```markdown
## Side-by-side comparison
| Aspect | Legacy | cf-desktop |
|---|---|---|

## What to keep
## What to change
## What to drop
```

### IPC / API Map
```markdown
## Channels / Endpoints
| Channel | Direction | Payload | Handler |
|---|---|---|---|

## Missing handlers
## Recommended additions
```

## Important constraints

- **Read actual code** before writing anything — don't invent
- **Cite file paths** for every finding (e.g. `lighthouseink/InkClient/src/main.ts:L185`)
- **Be specific** — avoid vague statements like "this could be better"
- If legacy reference apps are relevant, read them at `/Users/haht/Documents/creativeforce/lighthouseink/`, `lighthousehue/`, `lighthouseluma/`, `lighthousekelvin/`
- Cross-reference with existing docs in `docs/` before writing to avoid duplication
