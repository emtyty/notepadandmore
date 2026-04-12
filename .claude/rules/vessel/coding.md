---
paths:
  - "apps/vessel/**"
---

# Vessel App Coding Rules

## TypeScript

- `strict: true` enforced via two tsconfigs: `tsconfig.node.json` (main/preload), `tsconfig.web.json` (renderer).
- Prefer explicit types over inference in function signatures. Avoid `any`.
- IPC message types must be defined in preload and shared — never use `any` for IPC payloads.

## Architecture Layers

Vessel is split into 3 isolated layers — never cross boundaries directly:

| Layer | Location | Can import from |
|-------|----------|-----------------|
| Main process | `src/main/` | Node.js APIs, electron, @cf-builder/core |
| Preload | `src/preload/` | Electron contextBridge only |
| Renderer | `src/renderer/` | window.api (preload), React, Zustand |

**The renderer never imports from `src/main/` or `src/preload/` directly.**  
**The main process never imports from `src/renderer/`.**

## IPC (Inter-Process Communication)

- All IPC channels defined in `src/preload/index.ts`. If adding a new channel, update preload first.
- Channel names: `<noun>:<verb>` pattern — e.g., `build:start`, `settings:get`, `auto-build:enable`.
- IPC handlers in `src/main/ipc-handlers.ts`. Keep handlers thin — delegate to service files.
- Always type IPC payloads. Never send untyped objects through IPC.

## State Management (Zustand)

- One store per domain: `build-store.ts`, `workspace-store.ts`.
- Stores live in `src/renderer/stores/`.
- Keep actions inside the store (`set()` pattern). No external mutations.
- Selectors: use shallow equality checks for derived state. Avoid subscribing to the whole store.

## React Patterns

- React 19 + React Router DOM 7.1.
- Pages in `src/renderer/pages/`. Components in `src/renderer/components/`.
- Use `useBuildEvents` hook (or similar) to subscribe to IPC events — never subscribe directly in components.
- `useMemo`/`useCallback` for expensive computations and stable prop references.
- Add `data-testid` to all interactive and testable elements.

## File Naming

| Type | Convention | Example |
|------|------------|---------|
| Pages | PascalCase | `BuildDetail.tsx` |
| Components | PascalCase | `BuildCard.tsx` |
| Stores | kebab-case | `build-store.ts` |
| Hooks | camelCase with `use` | `useBuildEvents.ts` |
| IPC handlers | kebab-case | `ipc-handlers.ts` |
| Services | kebab-case | `auto-build.ts`, `settings.ts` |

## Imports (Renderer)

Order: React → React Router → Zustand → UI libs (Ant Design icons) → internal hooks → stores → components → types

## Electron-Specific

- Use `electron-store` for all persistent settings. Never write to flat files manually.
- Minimize to system tray via the existing tray setup in `src/main/index.ts`.
- Window management: always check if window exists before sending IPC.
