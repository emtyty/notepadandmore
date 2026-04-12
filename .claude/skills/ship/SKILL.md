---
name: ship
description: Prepare a feature for release — write release notes, update changelog, create a deployment/release checklist, finalize the Vessel app version, and prepare for publishing. Use when the user says "ship", "prepare release", "ready to release", or wants to wrap up a feature for production.
---

# Ship

Prepare a feature for production release — gather implementation context, write release notes, bump versions, create release checklist, and update documentation.

**Announce:** "I'm using the ship skill to prepare this feature for release."

---

## Prerequisites

Before using this skill, verify:
- All implementation phases completed (check `implementation-notes/`)
- E2E tests passing (check `tests.md` for statuses)
- `npm run typecheck:all` passes
- `npm run build:all` passes
- No critical pending issues

If prerequisites not met, warn the user and list what's missing.

---

## Process

**Step 1: Identify the feature**
- From user input, or extract from current branch name: `feat/<scope>/<feature-name>`.

**Step 2: Gather context**

Read all feature documents:
1. `prd.md` — features, user stories, acceptance criteria
2. `spec.md` — what interfaces/IPC channels were added/changed
3. `plan.md` — phases and scope
4. `implementation-notes/*.md` — what was actually built, skipped, or known issues
5. `tests.md` — which tests passed/failed/skipped

Build a picture of:
- What changed in `packages/core/` vs `apps/vessel/`
- Any breaking changes to the plugin interface or IPC contract
- Any config schema changes (requires migration guidance)
- Known limitations or deferred items

**Step 3: Write release notes**

Create `.docs/features/<feature-name>/release-notes.md`:

```markdown
# {Feature Name} — Release Notes

**Version:** {semver bump — major/minor/patch}
**Date:** {today's date}

## Summary
{2-3 sentences describing what was built}

## What's New

### {Capability Group 1}
- {User-facing change}

### {Capability Group 2}
- {User-facing change}

## Improvements
- {Performance, reliability, UX improvements}

## Known Limitations
- {Deferred items with reference to future work}

## Breaking Changes
- {API, IPC, or config changes that require updates}
- {Or "None"}

## Files Changed
| Package | Description |
|---------|-------------|
| `packages/core` | {What changed — new plugins, types, config} |
| `apps/vessel` | {What changed — new pages, IPC, UI} |
```

**Step 4: Bump versions**

Determine semver bump:
- **Patch** (0.0.X): bug fixes only
- **Minor** (0.X.0): new features, backward compatible
- **Major** (X.0.0): breaking changes to plugin API, IPC contract, or config schema

Update versions:
- `packages/core/package.json` — if core changed
- `apps/vessel/package.json` — if vessel changed
- Root `package.json` if there's a workspace version

Commit: `chore: bump version to vX.Y.Z for {feature-name} release`

**Step 5: Update CHANGELOG.md**

Add entry to `CHANGELOG.md` at root (create if not exists):

```markdown
## [X.Y.Z] - {YYYY-MM-DD}

### Added
- {New feature or capability}

### Changed
- {Modified behavior}

### Fixed
- {Bug fixes included in this release}

### Breaking Changes
- {If any}
```

**Step 6: Write release checklist**

Create `.docs/features/<feature-name>/release-checklist.md`:

```markdown
# Release Checklist: {Feature Name} v{X.Y.Z}

## Pre-Release
- [ ] `npm run typecheck:all` passes
- [ ] `npm run build:all` passes
- [ ] `npm run test:core` — all unit tests pass
- [ ] `npm run test-ct` — all component tests pass
- [ ] E2E tests verified (see tests.md)
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json files
- [ ] release-notes.md written

## Config Changes (if any)
- [ ] New config fields documented
- [ ] Existing app configs (luma, hue, kelvin, ink, triad) updated if schema changed
- [ ] Migration notes written for any breaking config changes

## Vessel App Distribution (if releasing installer)
- [ ] `npm run build:vessel` produces clean output in `apps/vessel/out/`
- [ ] Code signing credentials configured (if macOS release)
- [ ] App version in `apps/vessel/package.json` matches release version
- [ ] Auto-updater config set correctly (if applicable)

## Merge & Tag
- [ ] PR reviewed and approved
- [ ] Squash merge into `main`
- [ ] Git tag created: `git tag v{X.Y.Z} && git push --tags`

## Post-Release
- [ ] GitHub release created with release notes
- [ ] Team notified
```

**Step 7: Update high-level documentation**

Check if `CLAUDE.md` or `.docs/features/` need updates:
- `CLAUDE.md`: Update if new plugins added to the build pipeline, new apps supported, or architecture changed
- `.docs/features/`: Add a summary doc for the new feature if it's a major capability

**Step 8: Present summary**

```
## Ship Summary for {feature-name} v{X.Y.Z}

### Documents Created
- release-notes.md
- release-checklist.md

### Version Changes
- packages/core: {old} → {new}
- apps/vessel: {old} → {new}

### Docs Updated
- {file} — {what changed}

### Breaking Changes
- {List, or "None"}

### Action Items (requires human)
- [ ] Review and merge PR
- [ ] Create git tag v{X.Y.Z}
- [ ] Create GitHub release
- [ ] {Any other manual steps}

### Anything I'm unsure about
- {Flag items where assumptions were made}
```

---

## Rules

- **Read implementation notes before writing** — they're the source of truth for what was actually built.
- **Don't invent** — only document features evidenced in implementation notes, commits, or tests.
- **Flag breaking changes clearly** — plugin API or config schema changes require migration notes.
- **Respect semver** — don't bump patch for features, don't bump minor for breaking changes.
