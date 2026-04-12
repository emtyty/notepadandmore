---
paths:
  - "*/**"
---

# Git Workflow

## Commit Messages

Format: `<type>(<scope>): <description>`  
Types: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`  
Scope: `core`, `vessel`, `config`, `cli`

Examples:
- `feat(core): add incremental build cache for electron plugin`
- `fix(vessel): resolve IPC race condition on build cancel`
- `chore(config): update luma app signing config`

If working on a GitHub issue, append: `(closes #123)`

## Branches

| Type    | Naming                        | Base   | Merges Into |
| ------- | ----------------------------- | ------ | ----------- |
| Feature | `feat/<scope>/<short-desc>`   | `main` | `main`      |
| Fix     | `fix/<scope>/<short-desc>`    | `main` | `main`      |
| Release | `release/v<major>.<minor>.0`  | `main` | `main`      |
| Hotfix  | `hotfix/<short-desc>`         | `main` | `main`      |

**Examples**: `feat/core/build-cache`, `fix/vessel/log-viewer-scroll`, `release/v2.1.0`

## Workflow
1. Pull latest `main` before branching.
2. Make commits following the format above.
3. Push and create PR targeting `main`.
4. Squash merge PRs — keep history clean.

## Rules

- **Never force-push to `main`.**
- **Always run `npm run typecheck` before committing** — catch type errors early.
- This is a monorepo — `packages/core` and `apps/vessel` share the same git repo. A single commit can span both if the change is tightly coupled (e.g., adding a new event type to core + handling it in vessel).
- Run `npm run build:core` before committing core changes — vessel depends on it.
