---
paths:
  - "apps/vessel/**"
---

# Testing Rules

## Frameworks

- **Component tests**: Playwright Component Testing (`playwright-ct.config.ts`) — for React components in isolation.
- **E2E tests**: Playwright (`e2e/playwright.config.ts`) — for full Electron app flows.
- **Core unit tests**: Vitest (`packages/core/vitest.config.ts`) — for plugin logic and utilities.

## Component Tests (`tests/`)

- Location: `apps/vessel/tests/` mirroring the component structure.
- Naming: `<ComponentName>.spec.tsx`.
- Test user-visible behavior — what the user sees, not implementation details.
- Mock IPC calls via `window.api` — never invoke real Electron in component tests.
- Add `data-testid` to all interactive elements in the component before writing tests.

## E2E Tests (`e2e/`)

- Location: `apps/vessel/e2e/`.
- Naming: `<feature>.spec.ts`.
- Two Playwright projects: `ui` (fast, mock builds) and `build` (real build pipeline).
- Run `ui` project first. Only run `build` project for full integration verification.
- Store test artifacts (screenshots) in `.tmp/` — gitignored.

## data-testid Convention

Use **kebab-case with dot notation** for hierarchy:

```tsx
data-testid="dashboard.btn-new-build"
data-testid="build-card.status-badge"
data-testid="log-viewer.filter-builder"
```

Pattern: `<page-or-component>.<element-type>-<name>`

## What to Test

- **Component tests**: rendering states (loading/error/empty), user interactions, conditional UI.
- **E2E tests**: full user flows — start build, view progress, cancel build, configure settings.
- **Don't test**: Electron internals, IPC plumbing, or static layout.

## Mocking

- Mock `window.api` for component tests using the fixtures in `tests/mocks/`.
- Never hit real build processes in `ui` project tests.
- Use `seed.spec.ts` to set up known state before other E2E tests.

## Commands

```bash
# From apps/vessel/
npm run test-ct          # Component tests (headless)
npm run test-ct:ui       # Component tests (interactive)
npm run test-e2e         # E2E ui project
npm run test-e2e:build   # E2E build project (real builds)
npm run test-e2e:debug   # E2E debug mode
```
