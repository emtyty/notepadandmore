# Go Back / Go Forward — Test Cases

Verifies cross-file navigation history (VS Code-style): keyboard shortcuts per OS, mouse side-button support, toolbar icons placed left of Toggle Sidebar, 50-entry cap, dedupe of consecutive same-position pushes, 10-line threshold for same-buffer jumps, virtual-tab exclusion, lazy skipping of entries pointing at closed buffers.

---

## Test Scenarios

### Test 1: Back/Forward toolbar icons render in the expected position

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- App launched in E2E mode.

**Steps**

1. Inspect the right-side icon strip of the MenuBar (Windows) or QuickStrip (macOS).
2. Read the rendered order of icon buttons.

**Expected Result**

- Four icons appear in this exact order: `[← Back] [→ Forward] [Toggle Sidebar] [Gear]`.
- `data-testid="nav-back"` and `data-testid="nav-forward"` are present on the first two buttons.

**Status:** Not Tested

---

### Test 2: Back/Forward buttons are disabled when their stack is empty

**Type**: E2E Test
**Category**: Functional (BR-009)

**Preconditions**
- App just launched; no file tabs opened; no navigation history.

**Steps**

1. Read the DOM `disabled` attribute on `[data-testid="nav-back"]` and `[data-testid="nav-forward"]`.

**Expected Result**

- Both buttons report `disabled` (Playwright `toBeDisabled()` passes).

**Status:** Not Tested

---

### Test 3: Tab-switch between two file buffers pushes an entry

**Type**: E2E Test
**Category**: Functional (US-001, §3.1)

**Preconditions**
- Two file buffers open — `fileA.txt` at line 50, then open `fileB.txt` (now active).
- Navigation stack is empty at start.

**Steps**

1. With `fileB.txt` active and cursor at line 1, click `nav-back`.
2. Observe the active tab and cursor position.

**Expected Result**

- Active tab becomes `fileA.txt`.
- Cursor lands at line 50 (the last known position in A).
- `nav-back` becomes disabled; `nav-forward` becomes enabled.

**Status:** Not Tested

---

### Test 4: Forward returns to the location Back came from

**Type**: E2E Test
**Category**: Functional (US-002)

**Preconditions**
- Continues from Test 3 — we're now in `fileA.txt:50` after a Back.

**Steps**

1. Click `nav-forward`.
2. Observe active tab and cursor.

**Expected Result**

- Active tab flips to `fileB.txt`.
- Cursor lands at the line where we were before Back (e.g., line 1).
- `nav-forward` becomes disabled; `nav-back` becomes enabled.

**Status:** Not Tested

---

### Test 5: Keyboard shortcut (platform-appropriate) triggers Back

**Type**: E2E Test
**Category**: Functional (US-001, §4.1)

**Preconditions**
- Two file buffers open with at least one recorded back entry.
- Focus inside the Monaco editor.

**Steps**

1. On macOS, press `Ctrl+-`. On Windows/Linux, press `Alt+ArrowLeft`.
2. Observe active tab and cursor.

**Expected Result**

- Same behavior as Test 3 — navigates to the previous location.
- Monaco does not also execute any conflicting command (no zoom-out, no line move).

**Status:** Not Tested

---

### Test 6: Keyboard shortcut triggers Forward

**Type**: E2E Test
**Category**: Functional (US-002, §4.1)

**Preconditions**
- Back stack has at least one entry that was moved to forward by a prior Back.

**Steps**

1. macOS: press `Ctrl+Shift+-`. Windows/Linux: `Alt+ArrowRight`.

**Expected Result**

- Navigates to the entry popped from the forward stack.
- `nav-forward` disabled state toggles correctly after the navigation.

**Status:** Not Tested

---

### Test 7: Mouse side-button BrowserBack navigates back

**Type**: E2E Test
**Category**: Functional (US-004, §5)

**Preconditions**
- At least one entry in the back stack.
- Focus anywhere in the app window.

**Steps**

1. Dispatch a `mouseup` event with `button: 3` on `document.documentElement` (via Playwright `page.evaluate`).

**Expected Result**

- Same behavior as Test 3 — back navigation fires once.
- No context menu opens.
- `preventDefault` was called (observable by Electron not performing any default back action).

**Status:** Not Tested

---

### Test 8: Mouse side-button BrowserForward navigates forward

**Type**: E2E Test
**Category**: Functional (US-004, §5)

**Preconditions**
- At least one entry in the forward stack.

**Steps**

1. Dispatch a `mouseup` with `button: 4`.

**Expected Result**

- Forward navigation fires once.

**Status:** Not Tested

---

### Test 9: Same-buffer cursor move ≤10 lines does NOT push an entry

**Type**: Unit Test (navigationStore) **or** E2E
**Category**: Edge Case (BR-005)

**Preconditions**
- File with 100 lines open, cursor recorded at line 5.
- Back stack holds the initial entry.

**Steps**

1. Click line 12 (delta = 7 lines).
2. Read the back stack length.

**Expected Result**

- Back stack length is unchanged — no new entry for a sub-threshold jump.

**Status:** Not Tested

---

### Test 10: Same-buffer cursor move >10 lines DOES push an entry

**Type**: E2E Test
**Category**: Functional (BR-005, §3.2)

**Preconditions**
- File with 100 lines, cursor at line 5, `lastRecordedLine = 5`.

**Steps**

1. Click (or `editor.setPosition`) line 30 (delta = 25).
2. Read the back stack length.

**Expected Result**

- Back stack has one more entry than before, pointing at the line-30 position.

**Status:** Not Tested

---

### Test 11: Consecutive same-line pushes are deduped

**Type**: Unit Test (navigationStore)
**Category**: Edge Case (BR-003)

**Preconditions**
- `pushEntry({ bufferId: 'b1', line: 20, column: 1 })` already called once.

**Steps**

1. Call `pushEntry({ bufferId: 'b1', line: 20, column: 5 })` (same line, different column).
2. Read stack length.

**Expected Result**

- Stack length is **unchanged** — different-column-same-line deduped per BR-003.

**Status:** Not Tested

---

### Test 12: New push truncates the forward stack

**Type**: Unit Test (navigationStore)
**Category**: Edge Case (BR-004)

**Preconditions**
- Back stack has 3 entries. One Back has been executed (forward stack now has 1 entry).

**Steps**

1. Call `pushEntry({ bufferId: 'b1', line: 99, column: 1 })`.
2. Read `forward` length.

**Expected Result**

- `forward` array is empty.

**Status:** Not Tested

---

### Test 13: Stack capped at 50 entries, oldest dropped

**Type**: Unit Test (navigationStore)
**Category**: Edge Case (BR-002)

**Preconditions**
- Empty stacks.

**Steps**

1. Call `pushEntry` 51 times with distinct positions (e.g., line 1..51 in the same buffer).
2. Read `back.length` and `back[0].line`.

**Expected Result**

- `back.length === 50`.
- The oldest entry (line 1) has been dropped; `back[0].line === 2`.

**Status:** Not Tested

---

### Test 14: Virtual tab (Settings) does not pollute history

**Type**: E2E Test
**Category**: Functional (US-006, BR-006)

**Preconditions**
- `fileA.txt` open and active, cursor at line 20. Back stack snapshot taken.

**Steps**

1. Open the Settings virtual tab (click gear → Settings, or `Cmd/Ctrl+,`).
2. Switch back to `fileA.txt` tab.
3. Compare the back stack to the snapshot.

**Expected Result**

- Back stack is identical to snapshot — no entries added for opening or leaving Settings.
- `nav-back` disabled state is unchanged.

**Status:** Not Tested

---

### Test 15: Closed-buffer entries are skipped during Back

**Type**: E2E Test
**Category**: Error Handling (US-005, BR-007)

**Preconditions**
- Three files opened in order: A, B, C. Cursor touched distant lines in each so stack has 2 entries (one for A, one for B when switching away).
- Active tab is C.

**Steps**

1. Close tab B (its buffer is removed from the store).
2. Click `nav-back`.

**Expected Result**

- Active tab becomes A — the stack entry for B was skipped.
- The skip is silent (no toast, no error).
- If B's entry was the only back entry remaining, `nav-back` becomes disabled after the skip.

**Status:** Not Tested

---

### Test 16: Closed file is not auto-reopened

**Type**: E2E Test
**Category**: Error Handling (US-005)

**Preconditions**
- Back stack has one entry pointing at a closed buffer.

**Steps**

1. Click `nav-back`.
2. Observe tab list.

**Expected Result**

- No new tab is created for the closed file.
- Since every back entry is stale, `nav-back` either no-ops or skips to the next viable entry (confirming the "skip, don't reopen" rule).

**Status:** Not Tested

---

### Test 17: Back/Forward does not recurse while navigating

**Type**: E2E Test
**Category**: Edge Case (`isNavigating` flag, §2.2)

**Preconditions**
- Two file buffers A and B with entries in the back stack.
- Back stack has 2 entries.

**Steps**

1. Click `nav-back` twice in rapid succession (or three times — more than entries available).
2. Read back stack length and forward stack length.

**Expected Result**

- The resulting tab-switches during navigation do **not** produce extra entries (`isNavigating` guard).
- Total entry count across back + forward is conserved — only moved between stacks.

**Status:** Not Tested

---

### Test 18: Toolbar button tooltips show platform-appropriate shortcut

**Type**: E2E Test
**Category**: Functional (§6.2)

**Preconditions**
- App launched.

**Steps**

1. Hover `nav-back`. Read the tooltip text.
2. Hover `nav-forward`.

**Expected Result**

- On macOS: tooltip reads `Back (⌃-)` and `Forward (⌃⇧-)`.
- On Windows/Linux: tooltip reads `Back (Alt+Left)` and `Forward (Alt+Right)`.
- Never the opposite platform's label.

**Status:** Not Tested

---

### Test 19: Keydown listener ignores shortcut when focus is in the Find input

**Type**: E2E Test
**Category**: Edge Case (§4.4)

**Preconditions**
- Find/Replace dialog is open; input has focus.
- Back stack has at least one entry.

**Steps**

1. Press `Alt+ArrowLeft` (Windows) or equivalent on macOS while focus is in the Find input.

**Expected Result**

- The Find input receives the keystroke (cursor moves left one char).
- Navigation is **not** triggered; active tab stays where it is.

**Status:** Not Tested

---

### Test 20: Keyboard shortcut does not trigger Zoom Out on Windows

**Type**: E2E Test
**Category**: Functional (§4.3)

**Preconditions**
- File tab open with text, current font size noted.

**Steps**

1. Windows only: press `Alt+ArrowLeft` (the Back shortcut).
2. Measure Monaco's font size after the keystroke.

**Expected Result**

- Font size is unchanged — Back navigation fires without collateral Zoom Out.
- (This test is mostly to validate there's no accidental mapping; on macOS the shortcut is `Ctrl+-` which also doesn't zoom, since zoom is `Cmd+-`.)

**Status:** Not Tested

---

### Test 21: Sub-threshold typing (adding new lines) does not inflate the stack

**Type**: E2E Test
**Category**: Edge Case (BR-005)

**Preconditions**
- File open, cursor at line 5, back stack has 1 entry at line 5.

**Steps**

1. Type characters that add 8 new lines (e.g., press Enter 8 times). Cursor ends up at line 13.
2. Read back stack length.

**Expected Result**

- Stack length unchanged (delta 8 ≤ threshold 10).

**Status:** Not Tested

---

### Test 22: Go to Line command (large jump) pushes an entry

**Type**: E2E Test
**Category**: Functional (§3.2)

**Preconditions**
- File open with 200 lines, cursor at line 5, back stack snapshot taken.

**Steps**

1. Invoke `Go to Line` (`Cmd/Ctrl+G`) and jump to line 150.
2. Read back stack length.

**Expected Result**

- Back stack has one more entry (delta 145 > 10 → pushes at some point during or after the jump).

**Status:** Not Tested

---

### Test 23: Navigation history is NOT persisted across restart

**Type**: E2E Test
**Category**: Functional (BR-001)

**Preconditions**
- Back stack has 3 entries.

**Steps**

1. Close the app cleanly.
2. Relaunch.
3. Read back stack.

**Expected Result**

- Back stack is empty on relaunch.
- `nav-back` and `nav-forward` are disabled.

**Status:** Not Tested

---

### Test 24: Go back disabled when all entries point at virtual tabs / are stale

**Type**: Unit Test (navigationStore)
**Category**: Edge Case (BR-007, BR-009)

**Preconditions**
- Back stack has 2 entries, both pointing at bufferIds that no longer exist in `editorStore`.

**Steps**

1. Call `canGoBack()`.

**Expected Result**

- Returns `false`.
- Toolbar `nav-back` reflects as disabled.

**Status:** Not Tested

---

### Test 25: Back skips multiple consecutive stale entries in one action

**Type**: E2E Test
**Category**: Edge Case (§2.4 lazy loop)

**Preconditions**
- Back stack has 4 entries in order: `A (stale)`, `A (stale)`, `B (live)`, `C (stale — current)`. Note: the top of back is at the end of the array.
- Active tab is `D (live)`.
- User closed A and C after the entries were recorded.

**Steps**

1. Click `nav-back`.

**Expected Result**

- Navigation lands on `B (live)` in one action.
- The two popped stale entries (`C` and then the A's) are discarded internally.
- `forward` stack now contains 1 entry: D's current position.

**Status:** Not Tested

---

### Test 26: Opening a brand-new file captures the departure from the previous file

**Type**: E2E Test
**Category**: Functional (§3.4)

**Preconditions**
- `fileA.txt` open, cursor at line 30.

**Steps**

1. Open `fileB.txt` via File → Open File (new tab, becomes active).
2. Click `nav-back`.

**Expected Result**

- Active tab becomes `fileA.txt`.
- Cursor lands at line 30.

**Status:** Not Tested

---

### Test 27: Navigating to a line that now has less content (edited file) still reaches the line

**Type**: E2E Test
**Category**: Edge Case (§12 open Q #3)

**Preconditions**
- File has 200 lines. Back stack has an entry for line 150.
- User now deletes the last 100 lines, so the file is 100 lines long.

**Steps**

1. Click `nav-back` (target is line 150 in the 100-line buffer).

**Expected Result**

- Navigation succeeds. Cursor lands at the end of the file (Monaco's `setPosition` clamps to valid range).
- No error; no crash.

**Status:** Not Tested

---

### Test 28: Rapid successive shortcut presses don't queue phantom navigations

**Type**: E2E Test
**Category**: Edge Case (`isNavigating` flag, §7)

**Preconditions**
- Back stack has 5 entries.

**Steps**

1. Press the Back shortcut 3 times in quick succession (within ~100 ms).

**Expected Result**

- Exactly 3 navigations happened, not more (`isNavigating` prevents extra intra-nav pushes; does NOT block subsequent user-invoked navigations).
- Final state: back stack length is `original - 3`, forward stack length is `+3`.

**Status:** Not Tested

---

### Test 29: NavButtons subscribe reactively to stack changes

**Type**: Component Test
**Category**: Functional (§6.4)

**Preconditions**
- Empty back stack → `nav-back` disabled.

**Steps**

1. From the store, call `pushEntry({ bufferId: 'b1', line: 1, column: 1 })`.
2. Observe `nav-back` disabled state.
3. Call `goBack()` (simulating Back click).
4. Observe `nav-back` disabled state again.

**Expected Result**

- After step 1: `nav-back` becomes enabled within one render tick.
- After step 3 (back stack back to 0): `nav-back` becomes disabled.

**Status:** Not Tested

---

### Test 30: No cursor-position push occurs for virtual tabs when their cursor is "moved"

**Type**: Unit Test (navigationStore)
**Category**: Edge Case (BR-006)

**Preconditions**
- Settings virtual tab active (no Monaco mounted beneath, but still an active buffer).

**Steps**

1. Invoke `pushEntry({ bufferId: settingsBufferId, line: 1, column: 1 })`.

**Expected Result**

- The push is ignored (step 2 of `pushEntry`).
- Stacks remain unchanged.

**Status:** Not Tested
