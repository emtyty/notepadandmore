# Common Bug Patterns in CreativeForce Builder v2

A catalog of frequently encountered bug patterns. Use as a starting point — if symptoms match a known pattern, verify faster.

---

## Core Library (`packages/core/`)

### AsyncGenerator Not Fully Consumed
**Symptom**: Build appears to hang or stop mid-pipeline. Some BuildEvents are missing in UI.  
**Root cause**: The consumer (Orchestrator or CLI) doesn't await the full generator — `break` or early `return` exits the generator loop without exhausting it.  
**How to check**: Look at how `execute()` generators are consumed. Search for `for await` loops with early exits.  
**Fix**: Ensure the generator is fully consumed or explicitly `return.throw()` on cancellation.

### shouldRun() With Side Effects
**Symptom**: Build behavior changes unpredictably depending on call order.  
**Root cause**: `shouldRun()` reads external state (files, env vars) that changes between calls.  
**How to check**: Read the `shouldRun()` implementation — should only read from `ctx` (BuildContext).  
**Fix**: Move any external reads to `execute()` or to `loadConfig()`.

### BuildContext Mutation
**Symptom**: Later plugins see different config values than expected.  
**Root cause**: A plugin mutates the shared `BuildContext` object (adds/changes fields).  
**How to check**: Search for direct assignments to `ctx.*` in plugin `execute()` methods.  
**Fix**: If a plugin needs derived state, compute it locally inside `execute()`.

### execa Error Not Caught
**Symptom**: Build crashes with unhandled rejection instead of showing a clean error event.  
**Root cause**: `execa()` call without try/catch in an AsyncGenerator.  
**How to check**: Search for `execa(` calls without surrounding try/catch in builders.  
**Fix**: Wrap in try/catch and `yield { type: 'error', ... }`.

### Config Zod Parsing Fails Silently
**Symptom**: Config loads but has undefined fields, causing runtime errors deep in a plugin.  
**Root cause**: Zod `.optional()` fields aren't being validated strictly enough, or `.parse()` is replaced with `.safeParse()` without checking success.  
**How to check**: Look at `loadConfig()` and the schema for the affected field.  
**Fix**: Use `.parse()` (throws on failure) and let the error surface at load time.

---

## Vessel Main Process (`apps/vessel/src/main/`)

### IPC Handler Not Registered
**Symptom**: Renderer calls `window.api.something()` and gets undefined or a timeout.  
**Root cause**: The IPC handler was added to preload but not registered in `ipc-handlers.ts`.  
**How to check**: Search for the channel name in both `preload/index.ts` and `main/ipc-handlers.ts`.  
**Fix**: Add the corresponding `ipcMain.handle('<channel>', ...)` in `ipc-handlers.ts`.

### Window Reference Null After Minimize to Tray
**Symptom**: Build events don't arrive in the UI after the window was minimized and restored.  
**Root cause**: Code checks `if (win)` but `win` was set to null on minimize.  
**How to check**: Look at the window lifecycle in `main/index.ts` — when is `win` set to null?  
**Fix**: Use the tray's `show()` pattern — only set `win = null` on actual window close, not minimize.

### electron-store Write Race Condition
**Symptom**: Settings are saved correctly but occasionally revert to old values.  
**Root cause**: Two async IPC handlers both write to electron-store without synchronization.  
**How to check**: Look for multiple `store.set()` calls that could race in different IPC handlers.  
**Fix**: Queue writes or use a single IPC handler as the write entry point.

---

## Vessel Renderer (`apps/vessel/src/renderer/`)

### Stale Closure in IPC Event Subscription
**Symptom**: Build event handler reads outdated store state or React state.  
**Root cause**: Event subscription set up in `useEffect` with empty deps captures stale closure.  
**How to check**: Look at `useBuildEvents.ts` — are all referenced state/store values in the deps array?  
**Fix**: Use `useRef` to hold the latest callback, or use Zustand selectors that don't require closure capture.

### Zustand Store Subscription Too Broad
**Symptom**: Components re-render on every build event even when their data didn't change.  
**Root cause**: Component subscribes to the entire store: `const store = useBuildStore()`.  
**How to check**: Look for `use*Store()` calls without a selector function.  
**Fix**: Use a specific selector: `const status = useBuildStore(s => s.jobs[id]?.status)`.

### IPC Listener Leaking (Memory/Duplicate Events)
**Symptom**: Build events arrive multiple times in the UI, or memory grows over time.  
**Root cause**: `window.api.onBuildEvent(callback)` called in component without cleanup (returning the unsubscribe function from useEffect).  
**How to check**: Look for IPC subscriptions in `useEffect` without a return cleanup function.  
**Fix**: Always return the unsubscribe function from `useEffect`:
```typescript
useEffect(() => {
  const unsub = window.api.onBuildEvent(handler);
  return unsub;
}, []);
```

### React Router State Lost on Navigation
**Symptom**: Build detail page loses live log data when navigating away and back.  
**Root cause**: Component state is local to the component, which unmounts on navigation. Should be in Zustand store.  
**How to check**: Is the data stored in `useState` or in the Zustand build store?  
**Fix**: Move persistent data (build jobs, log lines) to the Zustand store, not component state.

---

## Config System

### App Config Not Found
**Symptom**: `loadConfig()` throws "Unknown app: <name>".  
**Root cause**: New app config file exists in `config/apps/` but not imported/registered in `config/loader.ts`.  
**How to check**: Check `config/loader.ts` for the app registry.  
**Fix**: Add the import and registry entry.

### Environment Variable Override Not Applied
**Symptom**: Config loads with default value instead of the environment variable value.  
**Root cause**: The env var override in `config/env-overrides.ts` uses the wrong key or wrong field path.  
**How to check**: Read `env-overrides.ts` and compare the field path with the schema.  
**Fix**: Align the env var key with `CF_` prefix convention and correct the field path.
