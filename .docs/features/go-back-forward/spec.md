# Specification: Go Back / Go Forward

## 1. Scope

This feature is entirely **renderer-side**. No main-process or preload changes.

- **Renderer** (`src/renderer/src/`): new `useNavigationStore` Zustand slice; new `NavButtons` component; new keyboard + mouse-button listeners; extend `EditorPane`'s cursor-change handler to feed the navigation store; extend `MenuBar` and `QuickStrip` to host `NavButtons` in the right-strip.
- **Main process**: no changes.
- **Preload**: no changes.
- **CLI**: N/A.

> See [PRD](./prd.md) for user stories and business rules.

---

## 2. Data Shapes

### 2.1. `NavigationEntry`

```typescript
// src/renderer/src/store/navigationStore.ts
export interface NavigationEntry {
  bufferId: string   // id from editorStore Buffer
  line: number       // 1-based line number
  column: number     // 1-based column
  timestamp: number  // Date.now() at capture — diagnostic only, not used for dedupe
}
```

### 2.2. `useNavigationStore` — shape

```typescript
interface NavigationState {
  back: NavigationEntry[]       // oldest at index 0, newest at end
  forward: NavigationEntry[]    // newest at end (popped first on Forward)
  isNavigating: boolean         // set true while a goBack/goForward call is resolving
                                // so resulting cursor/tab changes don't auto-push
}

interface NavigationActions {
  pushEntry(entry: NavigationEntry): void
  goBack(): NavigationEntry | null       // returns the entry we navigated TO, or null if stack empty / all stale
  goForward(): NavigationEntry | null
  clearForBuffer(bufferId: string): void // called when a buffer is removed — can drop entries if desired (see 2.4)
  beginNavigating(): void                // sets isNavigating = true
  endNavigating(): void                  // sets isNavigating = false
  canGoBack(): boolean                   // derived from back.length > 0 AND at least one entry has a live buffer
  canGoForward(): boolean
}
```

### 2.3. `pushEntry` contract

1. If `isNavigating === true`, **ignore the push**.
2. If the entry's buffer is a virtual tab (`buffer.kind !== 'file'`), **ignore** (BR-006).
3. Look up the current **top of `back`** (or the "implicit current" — see §3.2):
   - If same `{bufferId, line}`, **drop** (dedupe — BR-003).
4. Append to `back`.
5. If `back.length > 50`, shift oldest (BR-002).
6. Truncate `forward` to `[]` (BR-004).

### 2.4. Closed buffer handling (BR-007)

Two implementation options; spec mandates option **B** (lazy skipping):

- **A (eager)**: subscribe to `editorStore.buffers` and physically remove `clearForBuffer(bufferId)` entries when a buffer is removed.
- **B (lazy)** ✅ : leave entries in place; when `goBack`/`goForward` pops an entry, verify the buffer still exists via `editorStore.getBuffer(id)`. If it doesn't, discard that entry and recurse to the next in the same direction. If the stack empties, return `null`.

Rationale for B: keeps navigation store decoupled from editor-store lifecycle events and makes "reopen-and-continue" easier to add later if we decide to change our minds.

`clearForBuffer` is still in the interface for future use but is a no-op in v1.

### 2.5. Selectors and disabled state (BR-009)

`canGoBack()` returns `true` iff the back stack has at least one entry whose buffer still exists in `editorStore.buffers` (filtering for `kind === 'file'`). Same for `canGoForward()`. These are used to drive the disabled state of the toolbar icons.

> Note: this is O(stack size × buffer count) per selector call; at cap 50 and typical <100 buffers it's fine. If it becomes a hotspot, memoize on `(back, forward, buffers)` identity.

---

## 3. Entry Trigger Rules

### 3.1. Tab-switch trigger

When `editorStore.activeId` changes AND the new active buffer has `kind === 'file'` AND `isNavigating === false`:

- Capture the **previous** buffer's current cursor position (read from Monaco via `editorRegistry.get()?.saveViewState()` or tracked directly).
- Push `{ bufferId: previousActiveId, line, column, timestamp }` if the previous buffer was also a file buffer and had a known position.

Rationale: this captures "where you were" when you leave a file, so Back returns there.

Implementation placement: a Zustand subscription to `editorStore` at module load time, OR an effect inside `EditorPane` that watches `activeId` changes. **Either is acceptable** — contract-level, the push must fire exactly once per tab-switch that crosses between two file buffers.

### 3.2. Same-buffer significant-jump trigger (BR-005)

Inside `EditorPane`'s existing `onDidChangeCursorPosition` handler:

- Maintain a **`lastRecordedLine`** ref per active buffer (resets on tab switch).
- On each cursor change, if the new line number differs from `lastRecordedLine` by **> 10** (strictly greater than), push a new entry with the new position and update `lastRecordedLine`.
- Initial `lastRecordedLine` = the line recorded when the buffer became active (or line 1 if never recorded).

This covers:
- Clicking far in the same file (mouse-driven jump).
- `Go to Line` command (jumps typically >10 lines).
- `Find Next` matches that jump more than 10 lines away.
- PageDown / Ctrl+End / Ctrl+Home that move the cursor far.

It does **not** cover small jumps (e.g., Find Next lands 3 lines away). That's an accepted trade-off for MVP simplicity — the user agreed to the threshold approach.

### 3.3. "Current position" and the implicit top of stack

The navigation stack does **not** include the user's *current* position as a back-stack entry. Instead, the current position is implicit (live cursor). Consequences:

- On Back: read current position → push to `forward` → pop `back` → navigate.
- On Forward: read current position → push to `back` → pop `forward` → navigate.

This matches browser history semantics and VS Code's model.

### 3.4. File-open trigger

Opening a brand-new file (via `Open File…`, `Open Folder`, recents, or drag-drop) results in a tab-switch to the new buffer — so §3.1 handles it. No extra trigger needed.

### 3.5. Virtual tabs (BR-006)

- If either the **source** or **destination** of a potential tab-switch is a virtual tab (`kind !== 'file'`), **no push** happens.
- Corollary: flipping from file A → Settings → file A leaves the stack unchanged. The Settings tab never shows up as a destination.

---

## 4. Keyboard Shortcut Registration

### 4.1. Platform mapping

| Action | macOS | Windows / Linux |
|--------|-------|-----------------|
| Back | `Ctrl+-` (i.e. `Control + Minus`) | `Alt+Left` |
| Forward | `Ctrl+Shift+-` | `Alt+Right` |

macOS uses **Ctrl** (not Cmd) deliberately, to match VS Code and to avoid the Cmd+- zoom-out default.

### 4.2. Registration mechanism

Window-level `keydown` listener attached at `document.documentElement` with **`capture: true`** so the event is intercepted before Monaco's own handlers. Match using `e.ctrlKey`, `e.altKey`, `e.shiftKey`, and `e.key` (value `'-'` or `'ArrowLeft'`/`'ArrowRight'`).

If the match fires: call `preventDefault()` + `stopPropagation()` and dispatch the corresponding store action.

> Not using Electron accelerators / hidden menu items for these — window-level listener is cross-platform, testable with `page.keyboard.press`, and doesn't need IPC.

### 4.3. Conflict notes

- **macOS `Ctrl+-`** does not conflict. `Cmd+-` is bound to `editor:command → zoomOut` on macOS via the menu, but `Ctrl+-` (different modifier) is unbound.
- **Windows `Alt+Left` / `Alt+Right`** do not conflict. Only `Alt+Up` / `Alt+Down` are currently bound (`menu.ts:133–134`, Move Line Up/Down).
- Inside Monaco, `Alt+Left`/`Alt+Right` have no default keybinding, so Monaco will not consume them.
- Windows `Ctrl+-` IS bound to Zoom Out in `MenuBar.tsx:174` — but that's handled by the Windows MenuBar dropdown's `Ctrl+-` accelerator string (display only, not actually registered). Monaco's `editor.action.fontZoomOut` registers `Ctrl+NumpadSubtract` / `Ctrl+Minus` natively and is unaffected by our capture listener since we only match on the actual Back/Forward bindings.

### 4.4. When the listener is active

- Listener is mounted for the lifetime of the App component (from initial mount to app quit).
- Listener skips handling if the event target is a text input **outside** Monaco (e.g., the Find input). This is done by checking `e.target instanceof HTMLInputElement | HTMLTextAreaElement` and the element is not inside `.monaco-editor` — in which case we `return` without acting.

---

## 5. Mouse Side Buttons

### 5.1. Binding

Window-level `mouseup` listener at `document.documentElement`:

| DOM `event.button` | Meaning | Action |
|---|---|---|
| `3` | BrowserBack | `goBack()` |
| `4` | BrowserForward | `goForward()` |

Call `preventDefault()` on match to suppress any downstream default behavior (Electron does not navigate on back/forward by default, but belt-and-suspenders).

### 5.2. Scope

Applies everywhere in the app window — inside Monaco, on toolbar, on sidebar. Matches VS Code's "anywhere in the window" behavior.

> Not using Electron `app-command` (main-process) routing in v1. If mouse buttons don't deliver reliably on some OS, fall back to `app-command` via a new IPC channel in v2.

---

## 6. UI — `NavButtons` Component

### 6.1. Placement

New component: `src/renderer/src/components/editor/NavButtons.tsx`.

Rendered in:
- `MenuBar.tsx` (Windows/Linux) — in the right-strip, **to the left of** the Toggle Sidebar button.
- `QuickStrip.tsx` (macOS) — same position, same relative order.

Final right-strip order on both platforms: `[← Back] [→ Forward] [Toggle Sidebar] [Gear]`.

### 6.2. Rendering contract

- Two `<button>` elements, `ArrowLeft` and `ArrowRight` lucide icons, size 14.
- `data-testid="nav-back"` and `data-testid="nav-forward"`.
- `disabled={!canGoBack}` / `disabled={!canGoForward}` wired to the store selectors.
- When disabled: 40% opacity, `cursor-not-allowed`, no hover background.
- `title` attribute shows platform-appropriate shortcut:
  - macOS: `Back (⌃-)` / `Forward (⌃⇧-)`
  - Windows/Linux: `Back (Alt+Left)` / `Forward (Alt+Right)`

### 6.3. Click handlers

- Back button → `useNavigationStore.getState().goBack()` → if result not null, dispatch navigation (see §7).
- Forward button → symmetric with `goForward()`.

### 6.4. Re-renders

Subscribes to `back.length` and `forward.length` (via Zustand selector) to re-render when stacks change.

---

## 7. Navigation Execution Contract

Whether triggered by shortcut, mouse button, or toolbar click, executing a back/forward action follows the same pipeline:

1. Call `beginNavigating()` on the store.
2. Call `goBack()` / `goForward()` on the store → returns `NavigationEntry | null`.
3. If `null`, call `endNavigating()` and bail (nothing to do).
4. Resolve the target buffer via `editorStore.getBuffer(entry.bufferId)`. If still null, pop again (lazy skip) — store handles this loop internally (§2.4).
5. If target buffer is not active, call `editorStore.setActive(entry.bufferId)`.
6. After the next render tick, call `editorRegistry.get()?.setPosition({ lineNumber: entry.line, column: entry.column })` and `editor.revealLineInCenter(entry.line)`.
7. Call `endNavigating()`.

Step 6 uses `queueMicrotask` (or `requestAnimationFrame`) so Monaco has time to mount the destination buffer's model via EditorPane's model-swap effect.

> The `isNavigating` flag (§2.2) guarantees the cursor-move and tab-switch resulting from steps 5–6 don't trigger §3.1/§3.2 recursion.

---

## 8. Integration Points

### 8.1. Store mounting

`useNavigationStore` is created at module-load time in `store/navigationStore.ts`. No provider, no setup needed beyond the file existing.

### 8.2. EditorPane

- Extend the existing `onDidChangeCursorPosition` callback (EditorPane.tsx:202–209) with the §3.2 threshold push.
- Add a `lastRecordedLine` ref that resets on buffer switch.
- Add a separate effect watching `activeId` for §3.1 tab-switch push.

### 8.3. App.tsx

- Mount the window-level `keydown` (§4.2) and `mouseup` (§5.1) listeners in an effect.
- Add cleanup on unmount.
- Expose a common `navigate(direction)` helper that `NavButtons`, the key handler, and the mouse handler all call — lives in `hooks/useNavigation.ts` (new).

### 8.4. MenuBar / QuickStrip

- Import and render `<NavButtons />` in the right-strip, to the left of Toggle Sidebar.

---

## 9. Business Rules (Technical Enforcement)

| ID | Rule | Enforced By |
|----|------|-------------|
| BR-001 | Session-only history | No serialization — store is module-level, dies with the renderer. |
| BR-002 | Capped at 50 entries | `pushEntry` step 5. |
| BR-003 | Dedupe consecutive same-position | `pushEntry` step 3. |
| BR-004 | Forward stack truncated on new push | `pushEntry` step 6. |
| BR-005 | 10-line threshold for same-buffer jumps | `EditorPane.onDidChangeCursorPosition` diff vs `lastRecordedLine`. |
| BR-006 | Virtual tabs excluded | `pushEntry` step 2 + §3.1/§3.2 guards. |
| BR-007 | Closed buffers skipped | `goBack`/`goForward` internal loop (§2.4 option B). |
| BR-008 | Global (no split handling) | N/A — single Monaco instance in v1. |
| BR-009 | Disabled when empty | `canGoBack` / `canGoForward` + `disabled` attribute on toolbar buttons. |

---

## 10. Validation & Error Handling

| Condition | Behavior |
|-----------|----------|
| `goBack` / `goForward` called with empty stack | Return `null`; caller bails. No error. |
| All remaining entries reference closed buffers | After lazy-skip loop exhausts the stack, return `null`. Store stacks end up empty. |
| `editor.setPosition` called before Monaco mounted the destination model | Deferred via `queueMicrotask`. If still not mounted after one tick, silently skip (the position will be preserved by Monaco's own viewState restore once the model is ready). |
| Monaco's `onDidChangeCursorPosition` fires during navigation execution | `isNavigating === true` causes `pushEntry` to no-op. Flag cleared in step 7. |
| Keydown match fires while focus is in a text input outside Monaco (e.g., Find input) | Listener returns early. |

---

## 11. Test Hooks

The implementation must expose these data attributes / selectors so E2E tests can interact:

- `[data-testid="nav-back"]`, `[data-testid="nav-forward"]` on the toolbar buttons.
- Buttons must reflect `disabled` via the DOM `disabled` attribute (not just class styling) so Playwright `toBeDisabled()` works.
- `useNavigationStore.getState()` is accessible from DevTools for manual inspection; not a public API, just a debugging aid.

---

## 12. Open Questions

1. **Should `Find Next` explicitly push, or rely on the 10-line threshold?** The threshold catches most Find jumps but misses nearby matches. PRD-level decision: stick with threshold in v1 (confirmed). If user reports missed navigations, revisit.
2. **Should `Go to Line` always push, or only when the jump crosses the threshold?** Same answer: threshold-only in v1.
3. **When navigating Back lands in a file that's been edited a lot, the recorded line might now point at a different textual position.** VS Code tolerates this (just puts cursor at the numerical line). Same behavior here — no line-tracking against edits in v1.
