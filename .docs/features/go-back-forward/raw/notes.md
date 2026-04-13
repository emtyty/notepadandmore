# Go Back / Go Forward — Brainstorm Notes

## Core idea
Add VS Code-style navigation history so users can quickly jump back and forward through the cursor positions they visited across files — not just within the current file. Surfaced via OS-appropriate keyboard shortcuts and two toolbar buttons placed next to the Toggle Sidebar icon.

---

## Decisions (confirmed with user)

### Granularity — VS Code fidelity (option b)
An entry is pushed to the navigation stack on:
- **File open** (opening a file for the first time, or switching to a tab).
- **Tab switch** (activating a different buffer).
- **Explicit jumps** inside the editor: `Go to Line`, `Find` next/prev, future `Go to Definition`, etc.
- **"Significant" cursor jumps** inside the same file — cursor moved by more than **N lines** since the previous recorded position (not triggered by contiguous typing).

Default threshold: **10 lines** (matches VS Code default). Not user-configurable in v1.

### Virtual tabs (Settings, Keyboard Shortcuts) — excluded
Navigating into the Settings tab or Keyboard Shortcuts tab does **not** push a new entry. Navigating out of them does not push either. Rationale: these tabs are not editable document locations, so back-stacking them would clutter history when users flip to settings and back. Matches VS Code's behavior for its own Settings editor.

### Entry points
- **Keyboard shortcuts** (all platforms):
  - macOS: `⌃-` (Back), `⌃⇧-` (Forward).
  - Windows/Linux: `Alt+Left` (Back), `Alt+Right` (Forward).
- **Mouse side buttons**: BrowserBack (button 3) = Back, BrowserForward (button 4) = Forward.
- **Toolbar icons** in the MenuBar (Windows) and QuickStrip (macOS) right-strip — positioned immediately to the **left of the Toggle Sidebar icon**. Order becomes: `[Back] [Forward] [Toggle Sidebar] [Gear]`.

### Stack size & lifetime
- Cap at **50 entries**. Oldest entry is discarded when capacity is reached.
- **Not persisted** across restart — cleared on app quit. Matches VS Code.
- Current position → forward stack on back-navigation, trimmed forward stack on any new push (standard browser semantics).

### Closed files
- If an entry points to a file whose buffer has been closed, skip it and try the next entry in that direction.
- If the file still exists on disk but is closed, **do not auto-reopen** — just skip. (Simplifies v1; reopening semantics can come later.)

---

## Default decisions (to flag in PRD)

1. **Dedupe consecutive same-position entries.** If the cursor ends up at the same `{bufferId, line}` as the top of the stack, don't push a duplicate. Reduces noise.
2. **Toolbar button disabled state.** Back disabled when stack behind is empty; Forward disabled when stack ahead is empty.
3. **Threshold is line-based, not character-based.** Moving within a long wrapped line doesn't push.
4. **Same-buffer jumps cross over.** If user has file A open with 3 recorded positions and navigates back twice, then opens file B, the 2 undone A-positions are discarded from the forward stack (not preserved).
5. **No split-view handling in v1** — split view is disabled in this app. If it becomes enabled later, navigation history is global across splits.

---

## Classified requirements

### Features
- F1: Cross-file navigation history stack (max 50 entries, FIFO eviction).
- F2: Push entries on file open, tab switch, explicit jumps, and >10-line cursor moves.
- F3: Keyboard shortcuts per OS (macOS: `⌃-` / `⌃⇧-`; Windows/Linux: `Alt+Left` / `Alt+Right`).
- F4: Mouse side-button support (BrowserBack / BrowserForward).
- F5: Toolbar icons in MenuBar + QuickStrip right-strip, to the left of Toggle Sidebar.
- F6: Skip stack entries pointing at closed buffers.
- F7: Virtual tabs (Settings, Shortcuts) excluded from the stack.

### User stories
- US-1: As a user editing multiple files, I press the OS-appropriate Back shortcut and land on my previous cursor location in the file I was in before, even if it was a different file.
- US-2: As a user, I press Forward after Back and return to where I was.
- US-3: As a user, I click the Back toolbar button for the same effect; it's disabled when there's nothing to go back to.
- US-4: As a user with a gaming mouse, pressing the side Back button navigates back.
- US-5: As a user, after I close a tab that had entries in my history, pressing Back still works by skipping those entries.
- US-6: As a user, opening the Settings tab doesn't pollute my back history.

### Business rules
- BR-1: Navigation stack is in-memory only, reset on app restart.
- BR-2: Max 50 entries; oldest dropped on overflow.
- BR-3: Consecutive duplicate positions are not recorded twice.
- BR-4: Any new push truncates the forward stack (browser semantics).
- BR-5: Entries point to `{ bufferId, line, column }`. A file tab must still exist for the entry to be usable; otherwise skip.
- BR-6: Virtual buffers (`kind !== 'file'`) never produce navigation entries.

### Dependencies
- Existing `Buffer.kind` discriminator (Phase 1 of app-settings-rework) — needed for BR-6.
- `editorStore.activeId` and `getBuffer()` — to resolve destinations.
- Monaco `onDidChangeCursorPosition` — source of cursor events.
- EditorPane already wires Monaco lifecycle; navigation logic can hook there.
- Toolbar/MenuBar/QuickStrip components — need two new icon buttons each.

### Out of scope (v1)
- "Last Edit Location" history (separate VS Code command; future).
- Per-split navigation history (split view is disabled).
- Persisting history across app restarts.
- Configurable threshold for "significant jump."
- Auto-reopening closed files to revisit a stale entry.
- Showing a visual history list (dropdown of recent positions).
- Shortcuts inside the Find panel or Find Results panel.

---

## Open questions
- Do we need separate menu-bar entries (e.g., `Navigate → Back / Forward`)? The user asked for toolbar icons + shortcuts only, so no menu entries in v1. Flag in PRD for confirmation.
- Should a `Go to Line` action always push, or only when it actually moves the cursor? Default: push only if the resolved new line is different from the current line.
