# {Feature Name} - Overview

## 1. Description

{1-3 sentences describing what this feature does and why it exists in the builder pipeline.}

> 📋 See [Specification](./spec.md) for API, data model, and technical contract.

---

## 2. Features

| ID | Feature | Priority | Stories | Description |
|----|---------|----------|---------|-------------|
| F1 | {Feature Name} | Must Have | US-001, US-002 | {Brief description} |
| F2 | {Feature Name} | Should Have | US-003 | {Brief description} |
| F3 | {Feature Name} | Could Have | US-004 | {Brief description} |

---

## 3. User Stories

### Actors

| Actor | Description |
|-------|-------------|
| Developer | Runs builds locally via Vessel UI or CLI |
| CI Runner | Executes builds in automated pipeline |
| Operator | Configures apps, credentials, and build rules |

### Stories

#### US-001: {Story Title}
> **As a** {actor}, **I want to** {action}, **so that** {benefit}.

**Acceptance Criteria:**
- [ ] {Criterion 1}
- [ ] {Criterion 2}

---

## 4. Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-001 | {Rule Name} | {Description — e.g., "Only cache if git working tree is clean"} |
| BR-002 | {Rule Name} | {Description} |

---

## 5. Dependencies

### Upstream (Required by this feature)

| Dependency | Purpose |
|------------|---------|
| {e.g., @cf-builder/core BuildContext} | {e.g., Provides app/env/action config} |
| {e.g., AWS S3 credentials} | {e.g., Upload artifacts} |

### Downstream (Features that depend on this)

| Feature | Impact |
|---------|--------|
| {e.g., Vessel Build Detail page} | {e.g., Displays cache hit status} |

---

## 6. Out of Scope

- {Feature explicitly not included}
- {Feature deferred to future}

---

## 7. Assumptions

- {Assumption about environment, tools, or user behavior}

---

## 8. Glossary

| Term | Definition |
|------|------------|
| BuildContext | Immutable per-job config object passed to all plugins |
| BuilderPlugin | Interface that all build steps implement |
| Orchestrator | Topological sort engine that runs plugins in dependency order |
| Vessel | The Electron desktop GUI for triggering and monitoring builds |
