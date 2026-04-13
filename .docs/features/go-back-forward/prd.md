# Go Back / Go Forward — Overview

## 1. Description

Add VS Code-style cross-file navigation history to the editor. Users can jump back and forward through cursor positions they visited — across files, not just within the current one — using OS-appropriate keyboard shortcuts, mouse side buttons, or two toolbar icons placed next to the Toggle Sidebar icon in the top strip. History is session-only and caps at 50 entries.

> 📋 See [Specification](./spec.md) for navigation-store shape, entry triggers, and IPC contract (to be written).

---

## 2. Features

| ID | Feature | Priority | Stories | Description |
|----|---------|----------|---------|-------------|
| F1 | Cross-file navigation stack | Must Have | US-001, US-002, US-005 | Global in-memory stack of `{bufferId, line, column}` entries, max 50. |
| F2 | Entry capture on significant events | Must Have | US-001, US-006 | Push on file open, tab switch, explicit jumps, and >10-line cursor moves. Exclude virtual tabs. |
| F3 | OS-appropriate keyboard shortcuts | Must Have | US-001, US-002 | macOS: `⌃-` / `⌃⇧-`. Windows/Linux: `Alt+Left` / `Alt+Right`. |
| F4 | Mouse side-button support | Should Have | US-004 | BrowserBack (button 3) and BrowserForward (button 4) invoke Back/Forward. |
| F5 | Toolbar icons | Must Have | US-003 | Back + Forward buttons in MenuBar and QuickStrip right-strip, to the left of Toggle Sidebar. |
| F6 | Closed-tab skip | Must Have | US-005 | Entries pointing at closed buffers are skipped, not auto-reopened. |

---

## 3. User Stories

### Actors

| Actor | Description |
|-------|-------------|
| Editor user | macOS or Windows user who edits files in NovaPad and expects VS Code-like navigation. |

### Stories

#### US-001: Jump back to the previous cursor location across files
> **As a** user editing multiple files, **I want to** press the OS Back shortcut and return to the previous cursor location, **so that** I can quickly retrace my recent focus even across files.

**Acceptance Criteria:**
- [ ] After opening file A, clicking at line 100, then opening file B, pressing `Alt+Left` (Windows) or `⌃-` (macOS) activates file A's tab and places the cursor at line 100 column X.
- [ ] The cursor is visible (revealed in viewport, centered if previously off-screen).
- [ ] The file A tab becomes the active tab; no new duplicate is created.
- [ ] If no back history exists, the shortcut is a no-op (does not error, does not move focus).

#### US-002: Jump forward after going back
> **As a** user, **I want to** press Forward after Back and land where I was before I pressed Back, **so that** the shortcuts feel symmetric.

**Acceptance Criteria:**
- [ ] After pressing Back once, pressing Forward returns to the location that was active immediately before Back.
- [ ] Forward is a no-op when the forward stack is empty.
- [ ] Pressing Back, making a new edit or jump, and then pressing Forward does **not** restore the discarded forward history (standard browser/VS Code semantics).

#### US-003: Use the toolbar icons
> **As a** user, **I want to** click Back / Forward toolbar icons, **so that** I don't have to remember keyboard shortcuts.

**Acceptance Criteria:**
- [ ] Back and Forward icons appear in both MenuBar (Windows) and QuickStrip (macOS) right-strip, immediately to the left of the Toggle Sidebar icon. Order: `[Back] [Forward] [Toggle Sidebar] [Gear]`.
- [ ] Clicking Back / Forward performs the same action as the keyboard shortcut.
- [ ] Back is disabled when the back stack is empty; Forward is disabled when the forward stack is empty (reduced opacity + disabled cursor).
- [ ] Button tooltips show the OS-appropriate shortcut (e.g., `Back (⌃-)` on macOS, `Back (Alt+Left)` on Windows).

#### US-004: Use mouse side buttons
> **As a** user with a gaming or productivity mouse, **I want to** press the side Back/Forward buttons to navigate.

**Acceptance Criteria:**
- [ ] Pressing BrowserBack (button 3) anywhere in the editor window triggers Back.
- [ ] Pressing BrowserForward (button 4) triggers Forward.
- [ ] The button press does not also perform a secondary action (e.g., no context menu opens).

#### US-005: Skip entries for closed files
> **As a** user who has closed a file whose positions are still in my history, **I want to** Back/Forward to simply skip those entries, **so that** navigation doesn't stall or error.

**Acceptance Criteria:**
- [ ] After closing a file with 2 entries in the back stack, pressing Back advances to the next viable entry — a different file that is still open.
- [ ] If every remaining back entry is a closed file, the shortcut becomes a no-op (Back button becomes disabled).
- [ ] Closed-file entries are **not** auto-reopened.
- [ ] Skipping is silent — no toast, no error dialog.

#### US-006: Settings tab does not pollute history
> **As a** user, **I want to** flip to the Settings virtual tab and back without the round-trip filling my navigation history.

**Acceptance Criteria:**
- [ ] Opening the Settings (or Keyboard Shortcuts) tab does not push an entry.
- [ ] Switching away from a virtual tab back to a file does not push an entry specifically for the virtual tab.
- [ ] Navigation history is unchanged after opening and closing the Settings tab.

---

## 4. Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-001 | Session-only history | The navigation stack is in-memory; cleared on app quit. Not persisted to `session.json`. |
| BR-002 | Capped at 50 entries | When pushing a new entry would exceed 50, the oldest is discarded. |
| BR-003 | Dedupe consecutive same-position | If a push would create an entry with the same `{bufferId, line}` as the current top, the push is suppressed. Column differences are ignored for dedupe. |
| BR-004 | Forward stack truncated on new push | Any push that is not a back/forward navigation clears the forward stack (browser semantics). |
| BR-005 | Significant-jump threshold | Inside the same buffer, a cursor move is recorded only if it moves by more than 10 lines from the last recorded position. Measured by absolute `newLine - oldLine`. |
| BR-006 | Virtual tabs excluded | Buffers with `kind !== 'file'` never generate entries nor are they recorded as destinations. |
| BR-007 | Closed buffers skipped | Entries referencing a non-existent buffer id are skipped during navigation. |
| BR-008 | Global (not per-split) | Split view is disabled app-wide; if it's enabled later, the stack remains global across splits. |
| BR-009 | Disabled when empty | Back/Forward toolbar icons render disabled when their respective stack is empty. |

---

## 5. Dependencies

### Upstream (required by this feature)

| Dependency | Purpose |
|------------|---------|
| `Buffer.kind` discriminator (`editorStore`) | Enforces BR-006 (exclude virtual tabs). |
| Monaco `onDidChangeCursorPosition` | Source of cursor events; threshold check runs here. |
| `editorStore.activeId` + `setActive(id)` | Tab-switch mechanism for navigate-to-entry. |
| `editorStore.getBuffer(id)` | Validates an entry's buffer still exists (BR-007). |
| `EditorPane` Monaco instance | Target for `editor.revealLineInCenter()` + `editor.setPosition()` on navigation. |
| `MenuBar` + `QuickStrip` right-strip | New home for the two toolbar icons (F5). |
| `shortcutMod()` + `isMacOS()` (`utils/platform`) | Used for tooltip text and to pick the right keybinding per platform. |

### Downstream (features that will depend on this)

| Feature | Impact |
|---------|--------|
| Future Go-to-Definition / symbol navigation | Will call the navigation store's `pushEntry()` so jumps are backtrackable. |
| Future Find Results navigation | Same — each result click should push. |

---

## 6. Out of Scope

- **"Last Edit Location"** — VS Code has a separate command (`workbench.action.navigateToLastEditLocation`). Not in v1.
- **Persistence across restart** — VS Code also doesn't do this; matches.
- **Configurable line threshold** — locked at 10 in v1; can be exposed in Settings later.
- **Auto-reopening closed files** — skip instead (US-005).
- **Visual history list** — no dropdown showing recent positions; only Back/Forward.
- **Per-split history** — split view is disabled globally.
- **Menu-bar entries** — no `File → Navigate Back` / `Search → Navigate Back` items. Only toolbar + shortcuts + mouse buttons. (Confirmed with user.)
- **Find-panel-local navigation** — the Find/Replace dialog has its own match-navigation; not connected to global history.

---

## 7. Assumptions

- Monaco's `onDidChangeCursorPosition` fires reliably for all user-initiated cursor movements (arrow keys, click, Go to Line, Find Next, etc.) — this is standard Monaco behavior.
- The `Alt+Left` / `Alt+Right` accelerators don't conflict with any existing shortcut; on Windows `Alt+Left` is not currently bound elsewhere in the app.
- The mouse buttons are exposed to Electron's renderer via the `auxclick` event + `event.button === 3|4`; this is standard Chromium behavior.
- A typical editing session contains far fewer than 50 "significant" navigation events, so the cap rarely bites in practice.
- The Monaco `revealLineInCenter` API will handle scrolling correctly when the target position is off-screen.

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Navigation entry | A record of `{ bufferId, line, column, timestamp }` captured when the cursor lands somewhere "interesting." |
| Back stack | LIFO list of entries before the current position, plus the current position implicitly. |
| Forward stack | Entries that have been undone via Back and can be redone via Forward. Truncated on any new push. |
| Significant jump | A cursor move within the same buffer that crosses the 10-line threshold (BR-005). |
| Virtual tab | A buffer with `kind !== 'file'` (Settings, Keyboard Shortcuts) — excluded from history (BR-006). |
| BrowserBack / BrowserForward | Mouse side buttons, reported by the DOM `mouseup` / `auxclick` event with `button === 3` / `button === 4`. |
