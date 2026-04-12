---
paths:
  - "apps/vessel/**"
---

# Logging Rules

## Main Process (`src/main/`)

- Use `console.log/warn/error` with a `[Module]` prefix tag for all log output.
- Prefix pattern: `[IPC]`, `[AutoBuild]`, `[Settings]`, `[BuildHistory]`, `[Credentials]`.

```typescript
console.log('[IPC] Build started', { buildId, app, env });
console.error('[AutoBuild] Git poll failed', error);
```

- Structured data as second argument — never interpolate into the string.

## Renderer (`src/renderer/`)

- Avoid `console.*` in production renderer code. Use them only during development.
- Build event logs (from core) are displayed in `LogViewer` component — don't re-log them.
- Store errors in Zustand store state for display in the UI — don't log to console.

## IPC Layer

- Log IPC channel names and relevant params in the main process handler:

```typescript
ipcMain.handle('build:start', (_, args) => {
  console.log('[IPC] build:start', args);
  // ...
});
```

## Don'ts

- No logging sensitive data: AWS credentials, signing certificates, tokens.
- No `console.log` spam in hot paths (IPC handlers, event loops).
- Don't log binary data or large objects — log IDs and summaries instead.
