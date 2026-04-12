# Status Bar Selectors (Encoding, Language, EOL) - Test Cases

Tests for the Quick Pick-based selectors in the Status Bar that replace the Encoding and Language top-level menus. Tests use the Electron Playwright E2E setup with `data-testid` selectors and the `sendIPC` helper for menu-level actions.

**Test data-testid assumptions** (to be added during implementation):
- `data-testid="statusbar"` — existing
- `data-testid="statusbar-encoding"` — encoding label in status bar
- `data-testid="statusbar-language"` — language label in status bar
- `data-testid="statusbar-eol"` — EOL label in status bar
- `data-testid="quickpick"` — the Quick Pick overlay container
- `data-testid="quickpick-input"` — the search input inside Quick Pick
- `data-testid="quickpick-list"` — the scrollable list container
- `data-testid="quickpick-item"` — individual list items
- `data-testid="quickpick-backdrop"` — the backdrop overlay
- `data-testid="quickpick-empty"` — "No matching items" empty state

---

## Test Scenarios

### Test 1: Encoding picker opens on click

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default "new 1" buffer active
- Status bar is visible

**Steps**

1. Locate the encoding label in the status bar (`data-testid="statusbar-encoding"`)
2. Verify it displays "UTF-8" (default encoding)
3. Click the encoding label

**Expected Result**

- Quick Pick overlay becomes visible (`data-testid="quickpick"`)
- Search input is visible and focused (`data-testid="quickpick-input"`)
- List contains exactly 6 items: "UTF-8", "UTF-8 with BOM", "UTF-16 LE", "UTF-16 BE", "Windows-1252 (Latin)", "ISO-8859-1 (Latin-1)"
- "UTF-8" item has a checkmark indicator (active item)
- A semi-transparent backdrop is visible behind the picker

**Status:** Not Tested

---

### Test 2: Select encoding from picker

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer (encoding: UTF-8)

**Steps**

1. Click the encoding label in the status bar
2. Wait for Quick Pick to appear
3. Click the "UTF-16 LE" item in the list

**Expected Result**

- Quick Pick closes (no longer visible)
- Status bar encoding label now shows "UTF-16 LE"
- The buffer's encoding has changed (verified by re-opening picker and seeing "UTF-16 LE" checked)

**Status:** Not Tested

---

### Test 3: Language picker opens on click with search

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer (language: Plain Text)

**Steps**

1. Locate the language label in the status bar (`data-testid="statusbar-language"`)
2. Verify it displays "Plain Text"
3. Click the language label

**Expected Result**

- Quick Pick overlay becomes visible
- Search input is visible and focused
- List contains all languages: "Auto Detect", "Plain Text", "JavaScript", "TypeScript", "Python", etc. (22 total)
- "Plain Text" item has a checkmark indicator

**Status:** Not Tested

---

### Test 4: Search and select language

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the language label in the status bar
2. Wait for Quick Pick to appear
3. Type "java" in the search input
4. Observe the filtered list
5. Click "JavaScript" in the filtered list

**Expected Result**

- After typing "java", the list shows only items containing "java" (case-insensitive): "JavaScript", "Java"
- After clicking "JavaScript", the Quick Pick closes
- Status bar language label now shows "JavaScript"

**Status:** Not Tested

---

### Test 5: EOL picker opens on click

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer (EOL: LF)

**Steps**

1. Locate the EOL label in the status bar (`data-testid="statusbar-eol"`)
2. Verify it displays "LF"
3. Click the EOL label

**Expected Result**

- Quick Pick overlay becomes visible
- List contains exactly 3 items: "LF (Unix)", "CRLF (Windows)", "CR (Classic Mac)"
- "LF (Unix)" item has a checkmark indicator

**Status:** Not Tested

---

### Test 6: Select EOL from picker

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer (EOL: LF)

**Steps**

1. Click the EOL label in the status bar
2. Wait for Quick Pick to appear
3. Click "CRLF (Windows)" in the list

**Expected Result**

- Quick Pick closes
- Status bar EOL label now shows "CRLF"

**Status:** Not Tested

---

### Test 7: Keyboard navigation — arrow keys and Enter

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the encoding label in the status bar
2. Wait for Quick Pick to appear
3. Press ArrowDown twice
4. Press Enter

**Expected Result**

- After opening, the first item ("UTF-8") is highlighted
- After pressing ArrowDown twice, the third item ("UTF-16 LE") is highlighted
- After pressing Enter, the Quick Pick closes and the encoding changes to "UTF-16 LE"
- Status bar encoding label shows "UTF-16 LE"

**Status:** Not Tested

---

### Test 8: Escape closes picker without change

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer (encoding: UTF-8)

**Steps**

1. Click the encoding label in the status bar
2. Wait for Quick Pick to appear
3. Press Escape

**Expected Result**

- Quick Pick closes (no longer visible)
- Status bar encoding label still shows "UTF-8" (unchanged)

**Status:** Not Tested

---

### Test 9: Backdrop click closes picker without change

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer (encoding: UTF-8)

**Steps**

1. Click the encoding label in the status bar
2. Wait for Quick Pick to appear
3. Click the backdrop area (outside the Quick Pick dialog)

**Expected Result**

- Quick Pick closes (no longer visible)
- Status bar encoding label still shows "UTF-8" (unchanged)

**Status:** Not Tested

---

### Test 10: Active item shows checkmark

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the encoding label in the status bar (encoding is UTF-8)
2. Observe the "UTF-8" item in the list
3. Press Escape to close
4. Click encoding again after changing to UTF-16 LE (via a prior test or setup)

**Expected Result**

- When encoding is UTF-8, the "UTF-8" item has a visible checkmark indicator and other items do not
- When encoding is UTF-16 LE, the "UTF-16 LE" item has the checkmark

**Status:** Not Tested

---

### Test 11: Status bar shows correct display names on startup

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default "new 1" buffer

**Steps**

1. Observe the status bar right section

**Expected Result**

- EOL label (`data-testid="statusbar-eol"`) shows "LF"
- Encoding label (`data-testid="statusbar-encoding"`) shows "UTF-8"
- Language label (`data-testid="statusbar-language"`) shows "Plain Text"
- All three labels have cursor:pointer styling (indicating clickability)

**Status:** Not Tested

---

### Test 12: No picker opens when no buffer is active

**Type**: E2E Test
**Category**: Edge Case

**Preconditions**
- NovaPad is launched with a default buffer
- Close the only open tab (so no buffer is active, welcome screen may show)

**Steps**

1. Close the "new 1" tab via the tab close button
2. Click the encoding label in the status bar
3. Click the language label in the status bar
4. Click the EOL label in the status bar

**Expected Result**

- No Quick Pick overlay appears for any of the three clicks
- Status bar shows default values: "LF", "UTF-8", "Plain Text"

**Status:** Not Tested

---

### Test 13: Only one picker open at a time

**Type**: E2E Test
**Category**: Edge Case

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the encoding label in the status bar
2. Wait for the Encoding Quick Pick to appear
3. Without closing it, click the language label in the status bar

**Expected Result**

- The Encoding Quick Pick closes
- The Language Quick Pick opens
- Only one Quick Pick is visible at any time

**Status:** Not Tested

---

### Test 14: Tab switch closes open picker

**Type**: E2E Test
**Category**: Edge Case

**Preconditions**
- NovaPad is launched
- Two tabs are open (create a new file via Ctrl+N so there are "new 1" and "new 2")

**Steps**

1. Click the encoding label in the status bar to open the Encoding picker
2. Wait for Quick Pick to appear
3. Click the "new 1" tab (switch tabs)

**Expected Result**

- Quick Pick closes automatically
- The "new 1" tab becomes active
- No encoding change was applied

**Status:** Not Tested

---

### Test 15: Search with no matches shows empty state

**Type**: E2E Test
**Category**: Edge Case

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the language label in the status bar
2. Wait for Quick Pick to appear
3. Type "zzzzz" in the search input

**Expected Result**

- The list shows no items
- An empty state message is visible (`data-testid="quickpick-empty"`), e.g., "No matching items"

**Status:** Not Tested

---

### Test 16: Search is case-insensitive

**Type**: E2E Test
**Category**: Edge Case

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the language label in the status bar
2. Wait for Quick Pick to appear
3. Type "PYTHON" (all uppercase) in the search input

**Expected Result**

- The filtered list includes "Python" as a match
- Case of the typed query does not affect filtering

**Status:** Not Tested

---

### Test 17: Encoding menu removed from custom MenuBar

**Type**: E2E Test
**Category**: Integration

**Preconditions**
- NovaPad is launched (on Windows/Linux, or with custom MenuBar visible)

**Steps**

1. Locate the MenuBar (`data-testid="menubar"`)
2. Check for an "Encoding" menu button

**Expected Result**

- No "Encoding" menu button exists in the MenuBar
- The MenuBar shows: File, Edit, Search, View, Settings, Macro, Plugins, Window, Help
- No errors in the console related to missing Encoding menu

**Status:** Not Tested

---

### Test 18: Language menu removed from custom MenuBar

**Type**: E2E Test
**Category**: Integration

**Preconditions**
- NovaPad is launched

**Steps**

1. Locate the MenuBar (`data-testid="menubar"`)
2. Check for a "Language" menu button

**Expected Result**

- No "Language" menu button exists in the MenuBar
- The MenuBar renders correctly with remaining menus

**Status:** Not Tested

---

### Test 19: Encoding change via picker persists and reflects in status bar

**Type**: E2E Test
**Category**: Integration

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the encoding label → select "Windows-1252 (Latin)"
2. Observe the status bar
3. Click the encoding label again to reopen the picker

**Expected Result**

- Status bar encoding label shows "Windows-1252 (Latin)"
- Reopened picker shows "Windows-1252 (Latin)" with a checkmark
- Other items do not have checkmarks

**Status:** Not Tested

---

### Test 20: Language change applies Monaco syntax highlighting

**Type**: E2E Test
**Category**: Integration

**Preconditions**
- NovaPad is launched with a default buffer containing the text `function hello() { return 1; }`

**Steps**

1. Click the Monaco editor textarea and type `function hello() { return 1; }`
2. Verify status bar shows "Plain Text"
3. Click the language label → select "JavaScript"
4. Observe the editor

**Expected Result**

- Status bar language label changes to "JavaScript"
- The Monaco editor applies JavaScript syntax highlighting (tokens are colorized — `function` keyword should have a different color than the default plain text)

**Status:** Not Tested

---

### Test 21: Arrow key wraps around list

**Type**: E2E Test
**Category**: Edge Case

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the EOL label in the status bar (3 items: LF, CRLF, CR)
2. Wait for Quick Pick to appear
3. Press ArrowUp (from first item)

**Expected Result**

- Highlight wraps to the last item ("CR (Classic Mac)")
- Pressing ArrowDown from the last item wraps to the first item ("LF (Unix)")

**Status:** Not Tested

---

### Test 22: Search input auto-focused on picker open

**Type**: E2E Test
**Category**: Functional

**Preconditions**
- NovaPad is launched with a default buffer

**Steps**

1. Click the language label in the status bar
2. Without clicking anything else, immediately start typing "type"

**Expected Result**

- The search input captures the typed text (no need to click the input first)
- The list filters to show "TypeScript"

**Status:** Not Tested
