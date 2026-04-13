# What's New Tab - Test Cases

Tests for the "What's New" virtual tab — manual open from the Help menu, version-change auto-open in the background, dedupe, focus-no-steal, write-on-fire timing of `lastSeenVersion`, session round-trip, and silent failure modes. E2E tests are Playwright against the compiled Electron app (build first; tests bypass the close handler via `E2E_TEST=1`). Unit tests are Vitest against the renderer Zustand stores.

> **Test isolation note:** Several tests need to seed or clear `lastSeenVersion` in the config file before the app launches, and need a clean `session.json`. The implementation should either point Electron's `userData` at a per-test temp dir (preferred) or seed/clear the real config files in test setup. This is a test-infrastructure concern — the tests below describe behavior; how to isolate the on-disk state is left to the test harness.

---

## Test Scenarios

### Test 1: Help → What's New opens the tab in the foreground

**Type**: E2E Test
**Category**: Functional
**Covers**: US-004, BR-006

**Preconditions**
- App launched with no prior session
- `lastSeenVersion` is set to the current `app.getVersion()` (so auto-open does **not** fire and pollute the test)
- Default empty buffer is the active tab

**Steps**

1. Trigger the `menu:whats-new-open` IPC by clicking the Help → What's New menu item (use `electronApp.evaluate()` to call `webContents.send('menu:whats-new-open')` per the Monaco gotchas in CLAUDE.md)
2. Wait for a tab whose title text is `"What's New"` to appear in `[data-testid="tabbar"]`
3. Read the active tab indicator

**Expected Result**

- A new tab labeled `"What's New"` appears in the tab bar
- The new tab is the **active** tab (foreground open)
- The tab body contains the placeholder copy (e.g., "Coming soon")

**Status:** Not Tested

---

### Test 2: Help → What's New dedupes — second click re-activates the existing tab

**Type**: E2E Test
**Category**: Functional
**Covers**: US-004, BR-006

**Preconditions**
- App launched, `lastSeenVersion` matches current version
- "What's New" tab is already open and active
- User clicks a different tab to switch away from it

**Steps**

1. Confirm tab count `N` and that the active tab is not "What's New"
2. Trigger `menu:whats-new-open` again
3. Read tab count and active tab

**Expected Result**

- Tab count is still `N` (no duplicate created)
- Active tab is now the existing "What's New" tab

**Status:** Not Tested

---

### Test 3: Auto-open fires on fresh install (lastSeenVersion = null)

**Type**: E2E Test
**Category**: Functional
**Covers**: US-003, US-005, BR-001, BR-003

**Preconditions**
- Clean config: `lastSeenVersion` is absent or `null`
- No prior session file
- App is NOT yet launched

**Steps**

1. Launch the app via the standard fixture
2. Wait for the app to finish initial mount (`[data-testid="app"]` and `configStore.loaded === true`)
3. Read the tab bar
4. Read the active tab
5. Read the persisted `lastSeenVersion` from the config file on disk

**Expected Result**

- A "What's New" tab is present in the tab bar
- The "What's New" tab is the **rightmost** tab
- The active tab is the default empty buffer (NOT "What's New") — focus was not stolen
- `lastSeenVersion` on disk equals the current `app.getVersion()` value

**Status:** Not Tested

---

### Test 4: Auto-open fires on version mismatch (stale lastSeenVersion)

**Type**: E2E Test
**Category**: Functional
**Covers**: US-003, US-005, BR-003

**Preconditions**
- `lastSeenVersion` in config is set to a string that differs from the current version (e.g., `"0.0.0-test-stale"`)
- No prior session file

**Steps**

1. Launch the app
2. Wait for mount
3. Inspect the tab bar, active tab, and `lastSeenVersion` after launch

**Expected Result**

- "What's New" tab is present
- "What's New" is NOT the active tab
- `lastSeenVersion` on disk has been updated to the current version

**Status:** Not Tested

---

### Test 5: No auto-open when versions match

**Type**: E2E Test
**Category**: Functional
**Covers**: US-005, BR-001

**Preconditions**
- `lastSeenVersion` equals the current `app.getVersion()`
- No prior session

**Steps**

1. Launch the app
2. Wait for mount and for any post-mount effects to settle
3. Inspect the tab bar

**Expected Result**

- No "What's New" tab appears
- Tab bar contains only the default empty buffer

**Status:** Not Tested

---

### Test 6: Auto-open does not steal focus from a restored session

**Type**: E2E Test
**Category**: Integration
**Covers**: US-003, BR-002

**Preconditions**
- `lastSeenVersion` is stale (mismatch)
- A session file exists with two real files open and the second one marked active
- (The test harness must allow session restore — the default `E2E_TEST=1` fixture disables it; this test needs a variant fixture that enables restore)

**Steps**

1. Launch the app with the session-enabled fixture
2. Wait for session restore to complete (both file tabs visible)
3. Wait for the auto-open trigger to fire
4. Read the active tab
5. Read the rightmost tab title

**Expected Result**

- Active tab is the second restored file (the one marked active in the session)
- Rightmost tab is "What's New"
- Tab order: file1, file2, What's New

**Status:** Not Tested

---

### Test 7: Tab title is the static string "What's New"

**Type**: E2E Test
**Category**: Functional
**Covers**: US-001

**Preconditions**
- "What's New" tab is open (via either path)

**Steps**

1. Read the visible title of the "What's New" tab in `[data-testid="tabbar"]`

**Expected Result**

- Title is exactly `"What's New"`
- Title does NOT contain a version number, date, or other dynamic text

**Status:** Not Tested

---

### Test 8: Tab body renders "Coming soon" placeholder

**Type**: E2E Test
**Category**: Functional
**Covers**: US-002

**Preconditions**
- "What's New" tab is open and active

**Steps**

1. Inspect the tab body content area
2. Inspect the browser console for errors

**Expected Result**

- The tab body shows the "Coming soon" (or equivalent) placeholder text
- No errors are logged to the console
- The placeholder respects the current theme (visible against both light and dark backgrounds)

**Status:** Not Tested

---

### Test 9: Auto-open is at-most-once across launches (write-on-fire)

**Type**: E2E Test
**Category**: Edge Case
**Covers**: US-005, BR-001, BR-004

**Preconditions**
- `lastSeenVersion` is null
- No session file

**Steps**

1. Launch the app — auto-open fires, "What's New" appears
2. Close the "What's New" tab (click its close button)
3. Quit the app cleanly
4. Re-launch the app with the same fixture (config file persists between launches in this test)
5. Wait for mount
6. Inspect tab bar

**Expected Result**

- After re-launch: no "What's New" tab appears
- `lastSeenVersion` remains the current version

**Status:** Not Tested

---

### Test 10: Tab persists across restarts when left open (session round-trip)

**Type**: E2E Test
**Category**: Integration
**Covers**: US-001 (session persistence), BR-006

**Preconditions**
- `lastSeenVersion` is null
- No session file
- Fixture allows session restore

**Steps**

1. Launch — auto-open creates "What's New" tab
2. Do NOT close the tab
3. Quit cleanly (so session is saved with the virtual tab)
4. Re-launch with session-enabled fixture
5. Inspect tab bar and `lastSeenVersion`

**Expected Result**

- "What's New" tab is restored from `session.json` (kind: `'whatsNew'` round-trips)
- No second auto-open fires (versions now match)
- `lastSeenVersion` unchanged from what was written on the first launch

**Status:** Not Tested

---

### Test 11: Help menu entry is positioned above About

**Type**: E2E Test
**Category**: Functional
**Covers**: US-004

**Preconditions**
- App launched

**Steps**

1. Inspect the Help submenu items in order (via `electronApp.evaluate(() => Menu.getApplicationMenu())` and walk the Help submenu)

**Expected Result**

- "What's New" appears as the first item in the Help submenu
- On Windows/Linux: order is `What's New`, `About NovaPad`, separator, `Toggle Developer Tools`, ...
- On macOS: `What's New` precedes the existing items (no `About` is in Help on macOS — it lives in the App menu — so What's New is at the top of Help, above the `Toggle Developer Tools` separator)
- "What's New" item has no keyboard accelerator displayed

**Status:** Not Tested

---

### Test 12: Auto-open silently no-ops when `app:get-version` IPC fails

**Type**: Unit Test
**Category**: Error Handling
**Covers**: Spec §6 (validation table — IPC rejection branch)

**Preconditions**
- Test harness mocks `window.api.app.getVersion()` to return a rejected promise
- `lastSeenVersion` is null
- `configStore` is in a hydrated state

**Steps**

1. Mount the App (or invoke the auto-open trigger module directly)
2. Allow the rejected promise to settle
3. Read editor store buffers
4. Read `configStore.lastSeenVersion`

**Expected Result**

- No "What's New" buffer is added to the editor store
- `lastSeenVersion` remains `null` (NOT written)
- A `console.warn` was emitted
- Manual open via `openVirtualTab('whatsNew')` still works in the same session

**Status:** Not Tested

---

### Test 13: Malformed `lastSeenVersion` is treated as null (auto-open fires)

**Type**: Unit Test
**Category**: Edge Case
**Covers**: Spec §6 (malformed config branch)

**Preconditions**
- Config file on disk has `lastSeenVersion: 42` (a number, not string/null)
- Standard config-defaults merge runs at config-load time

**Steps**

1. Trigger config load
2. Read `configStore.lastSeenVersion`
3. Run the auto-open trigger logic against current version `"1.4.2"`

**Expected Result**

- `configStore.lastSeenVersion` is `null` after load (defaults merge coerces invalid types)
- Auto-open trigger fires (because `null !== "1.4.2"`)
- `lastSeenVersion` is then written as `"1.4.2"`

**Status:** Not Tested

---

### Test 14: `openVirtualTab('whatsNew', { activate: false })` does not change activeId

**Type**: Unit Test
**Category**: Functional
**Covers**: BR-002, Spec §2.3

**Preconditions**
- Editor store has at least one file buffer that is currently active (`activeId = "buf-1"`)
- No `whatsNew` buffer exists yet

**Steps**

1. Call `useEditorStore.getState().openVirtualTab('whatsNew', { activate: false })`
2. Read `activeId` and the buffers list

**Expected Result**

- A new buffer with `kind: 'whatsNew'` is appended to `buffers`
- `activeId` is still `"buf-1"` (unchanged)
- The returned id is the new buffer's id

**Status:** Not Tested

---

### Test 15: `openVirtualTab('whatsNew')` defaults to `activate: true` (backwards compat)

**Type**: Unit Test
**Category**: Functional
**Covers**: Spec §2.3 (backwards compat for existing call-sites)

**Preconditions**
- Editor store has one file buffer `"buf-1"` that is active
- No `whatsNew` buffer exists

**Steps**

1. Call `openVirtualTab('whatsNew')` with no options argument
2. Read `activeId`

**Expected Result**

- New `whatsNew` buffer is created
- `activeId` is now the new buffer's id (default behavior matches Settings/Shortcuts call-sites)

**Status:** Not Tested

---

### Test 16: `openVirtualTab` dedupes regardless of the activate option

**Type**: Unit Test
**Category**: Edge Case
**Covers**: BR-006

**Preconditions**
- A `whatsNew` buffer already exists in the store (id: `"buf-2"`)
- A different buffer is active (`activeId: "buf-1"`)

**Steps**

1. Call `openVirtualTab('whatsNew', { activate: false })`
2. Read buffers and `activeId`
3. Call `openVirtualTab('whatsNew')` (default activate: true)
4. Read `activeId`

**Expected Result**

- Step 1: no new buffer added; `activeId` still `"buf-1"`
- Step 3: still no duplicate; `activeId` is now `"buf-2"`

**Status:** Not Tested

---

### Test 17: Session round-trip preserves the `whatsNew` kind

**Type**: Unit Test
**Category**: Integration
**Covers**: Spec §2.2

**Preconditions**
- A `Session` object with `virtualTabs: [{ kind: 'whatsNew' }, { kind: 'settings' }]`

**Steps**

1. Pass the object through `SessionManager.normalize()`
2. Pass it back through `JSON.stringify` + `JSON.parse` + `normalize()` again

**Expected Result**

- `'whatsNew'` survives both passes (i.e., `KNOWN_VIRTUAL_KINDS` includes it)
- `virtualTabs` length is preserved
- No `[SessionManager] Skipped N invalid virtualTabs entries` warning is logged

**Status:** Not Tested

---

### Test 18: Config write failure does not crash; auto-open re-fires next launch

**Type**: Unit Test
**Category**: Error Handling
**Covers**: Spec §6 (config write fail branch — fail-safe)

**Preconditions**
- `lastSeenVersion` is null
- `configStore.save()` is mocked to reject

**Steps**

1. Trigger the auto-open logic
2. Allow the rejected save to settle
3. Inspect editor store and `configStore.lastSeenVersion` (in-memory)

**Expected Result**

- `whatsNew` buffer was added (the open call ran before/independent of the save)
- A `console.warn` was logged
- No unhandled promise rejection escapes the trigger
- (Implementation detail validated by Test 9 already covers the across-launch fail-safe)

**Status:** Not Tested

---

### Test 19: Two auto-opens in one session never produce a duplicate tab

**Type**: Unit Test
**Category**: Edge Case
**Covers**: BR-006

**Preconditions**
- `lastSeenVersion` is null
- The auto-open trigger effect can theoretically run twice (e.g., due to React strict-mode double-invocation in dev)

**Steps**

1. Invoke the auto-open trigger function twice in succession
2. Read buffers list

**Expected Result**

- Exactly one `whatsNew` buffer exists
- `lastSeenVersion` was written exactly once (or twice with the same value — both are fine; what matters is no duplicate tab)

**Status:** Not Tested

---

### Test 20: Closing the auto-opened tab in the same session does not re-trigger it

**Type**: E2E Test
**Category**: Edge Case
**Covers**: BR-001, BR-004

**Preconditions**
- `lastSeenVersion` is null
- App launched, auto-open has fired, "What's New" is the rightmost tab

**Steps**

1. Click the close button on the "What's New" tab
2. Wait for the tab to be removed from the bar
3. Wait an additional second for any stray effects
4. Read the tab bar

**Expected Result**

- "What's New" tab is gone and stays gone for the rest of the session
- `lastSeenVersion` on disk equals the current version (was written when auto-open fired, not when the tab closed)

**Status:** Not Tested
