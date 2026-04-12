# Status Bar Selectors (Encoding, Language, EOL) - Overview

## 1. Description

NovaPad currently offers Encoding and Language selection through top-level menus in both the native Electron menu and the custom MenuBar, while the Status Bar shows these values as static text or simple cyclers. This feature replaces both menu-based selectors with VS Code-style clickable status bar items that open Quick Pick popups — a centered overlay with search/filter, keyboard navigation, and the full list of options. The Encoding and Language top-level menus are removed entirely, making the Status Bar the single entry point for these settings.

> See [Brainstorm Notes](./raw/notes.md) for decision rationale and architecture sketch.

---

## 2. Features

| ID | Feature | Priority | Stories | Description |
|----|---------|----------|---------|-------------|
| F1 | Quick Pick component | Must Have | US-001, US-002 | Reusable overlay popup with search input, scrollable option list, keyboard navigation, and active-item highlighting. Renders at top-center of the editor area. |
| F2 | Encoding status bar selector | Must Have | US-003, US-004 | Clicking the encoding label in the Status Bar opens a Quick Pick with all 6 supported encodings. Selecting one applies it to the active buffer. |
| F3 | Language status bar selector | Must Have | US-005, US-006 | Clicking the language label in the Status Bar opens a Quick Pick with all supported languages and a search filter. Selecting one changes the active buffer's language. |
| F4 | EOL status bar selector | Must Have | US-007, US-008 | Clicking the EOL label in the Status Bar opens a Quick Pick with LF, CRLF, and CR options. Selecting one changes the active buffer's line endings. |
| F5 | Remove Encoding and Language menus | Must Have | US-009 | Remove the Encoding and Language top-level menus from both the native Electron menu and the custom MenuBar component. |

---

## 3. User Stories

### Actors

| Actor | Description |
|-------|-------------|
| User | Anyone using NovaPad to edit files, on any platform (macOS, Windows, Linux) |

### Stories

#### US-001: Quick Pick renders as a centered overlay
> **As a** User, **I want** the picker to appear as a centered overlay at the top of the editor area, **so that** it feels familiar (like VS Code's command palette) and doesn't obscure the status bar.

**Acceptance Criteria:**
- [ ] Quick Pick renders as a portal, centered horizontally at the top of the editor area
- [ ] A semi-transparent backdrop overlay covers the rest of the UI
- [ ] Clicking the backdrop or pressing Escape closes the picker without making a selection
- [ ] The picker appears with a subtle fade-in animation (~100ms)

#### US-002: Quick Pick supports keyboard navigation and search
> **As a** User, **I want** to filter options by typing and navigate with the keyboard, **so that** I can quickly find and select the option I need without using the mouse.

**Acceptance Criteria:**
- [ ] A search/filter text input is focused immediately when the picker opens
- [ ] Typing filters the list in real time (case-insensitive substring match)
- [ ] Up/Down arrow keys move the highlighted item
- [ ] Enter selects the highlighted item and closes the picker
- [ ] Escape closes the picker without selecting
- [ ] The currently active option (matching the buffer's current value) is visually marked (e.g., checkmark icon)

#### US-003: User changes encoding via status bar
> **As a** User, **I want** to click the encoding label in the Status Bar to see all available encodings, **so that** I can switch encoding without navigating menus.

**Acceptance Criteria:**
- [ ] Clicking the encoding label in the Status Bar opens the Encoding Quick Pick
- [ ] The picker lists all 6 encodings: UTF-8, UTF-8 with BOM, UTF-16 LE, UTF-16 BE, Windows-1252 (Latin), ISO-8859-1 (Latin-1)
- [ ] The current buffer's encoding is highlighted/checked in the list
- [ ] Selecting an encoding applies it to the active buffer and closes the picker

#### US-004: Encoding status bar label reflects current state
> **As a** User, **I want** the encoding label in the Status Bar to always show the active buffer's current encoding, **so that** I know at a glance what encoding is in use.

**Acceptance Criteria:**
- [ ] The Status Bar encoding label updates immediately when encoding changes (via picker or any other source)
- [ ] The label shows a human-readable name (e.g., "UTF-8", not "utf8")
- [ ] The label has hover styling (background highlight or underline) indicating it is clickable
- [ ] When no buffer is active, the label shows a sensible default ("UTF-8")

#### US-005: User changes language via status bar
> **As a** User, **I want** to click the language label in the Status Bar to search and select a language, **so that** I can set syntax highlighting quickly.

**Acceptance Criteria:**
- [ ] Clicking the language label in the Status Bar opens the Language Quick Pick
- [ ] The picker lists: Auto Detect, Plain Text, and all ~20 programming languages currently supported
- [ ] Typing in the search input filters the language list in real time
- [ ] The current buffer's language is highlighted/checked in the list
- [ ] Selecting a language applies it to the active buffer and closes the picker

#### US-006: Language status bar label reflects current state
> **As a** User, **I want** the language label in the Status Bar to always show the active buffer's current language, **so that** I know what syntax mode is active.

**Acceptance Criteria:**
- [ ] The Status Bar language label updates immediately when language changes
- [ ] The label shows the display name (e.g., "JavaScript", not "javascript")
- [ ] The label has hover styling indicating it is clickable
- [ ] When no buffer is active, the label shows "Plain Text"

#### US-007: User changes EOL via status bar
> **As a** User, **I want** to click the EOL label in the Status Bar to pick a line ending format, **so that** I can switch between LF, CRLF, and CR with clear labels.

**Acceptance Criteria:**
- [ ] Clicking the EOL label in the Status Bar opens the EOL Quick Pick
- [ ] The picker lists three options with descriptive labels: "LF (Unix)", "CRLF (Windows)", "CR (Classic Mac)"
- [ ] The current buffer's EOL is highlighted/checked in the list
- [ ] Selecting an EOL applies it to the active buffer and closes the picker

#### US-008: EOL status bar label reflects current state
> **As a** User, **I want** the EOL label in the Status Bar to always show the active buffer's current line ending, **so that** I know what format the file uses.

**Acceptance Criteria:**
- [ ] The Status Bar EOL label updates immediately when EOL changes
- [ ] The label shows the short form: "LF", "CRLF", or "CR"
- [ ] The label has hover styling indicating it is clickable
- [ ] When no buffer is active, the label shows "LF"

#### US-009: Encoding and Language menus are removed
> **As a** User, **I want** the menu bar to be cleaner without redundant Encoding and Language menus, **so that** the menu bar only contains items that aren't better served by the status bar.

**Acceptance Criteria:**
- [ ] The "Encoding" top-level menu is removed from the native Electron menu (`menu.ts`)
- [ ] The "Language" top-level menu is removed from the native Electron menu (`menu.ts`)
- [ ] The "Encoding" section is removed from the custom MenuBar component (`MenuBar.tsx`)
- [ ] The "Language" section is removed from the custom MenuBar component (`MenuBar.tsx`)
- [ ] No orphaned IPC handlers or event listeners remain for the removed menu items
- [ ] The menu bar renders correctly with the remaining menus (File, Edit, Search, View, Settings, Macro, Plugins, Window, Help)

---

## 4. Business Rules

| ID | Rule | Description |
|----|------|-------------|
| BR-001 | Status bar is the sole selector | Encoding, Language, and EOL can only be changed via status bar Quick Picks. No menu entries exist for these settings. |
| BR-002 | One picker open at a time | Only one Quick Pick can be open at any time. Opening a new picker closes any currently open picker. |
| BR-003 | Picker requires active buffer | If no buffer is active (e.g., welcome screen), clicking a status bar selector does nothing (no picker opens). |
| BR-004 | Selection dispatches existing events | Quick Pick selections must dispatch the same `CustomEvent` types (`editor:set-encoding`, `editor:set-eol`, `editor:set-language-local`) that the existing EditorPane handlers already listen for. No new IPC channels are needed. |
| BR-005 | Display names vs. internal values | The picker shows human-readable labels (e.g., "UTF-8 with BOM") but dispatches internal values (e.g., "utf8bom") consistent with existing event contracts. |

---

## 5. Dependencies

### Upstream (Required by this feature)

| Dependency | Purpose |
|------------|---------|
| Zustand `editorStore` | Source of truth for active buffer's encoding, language, and EOL |
| Existing `CustomEvent` handlers in `EditorPane.tsx` | Apply encoding/language/EOL changes to the editor and store |
| React Portal API | Render Quick Pick overlay outside the Status Bar's DOM hierarchy |
| Tailwind CSS | Styling for Quick Pick, backdrop, hover states |

### Downstream (Features that depend on this)

| Feature | Impact |
|---------|--------|
| Future Command Palette | Quick Pick component can be reused as the foundation for a general command palette |
| Future "Reopen with Encoding" | Can be added as an additional option in the Encoding Quick Pick |

---

## 6. Out of Scope

- "Reopen with Encoding" option (VS Code feature — deferred to future)
- Auto-detect encoding on file open (already handled by `chardet` in `fileHandlers.ts`)
- Adding more languages beyond the current ~20 supported languages
- Command palette integration (Quick Pick component is reusable, but wiring it into a general command palette is separate work)
- Indentation settings in status bar (VS Code shows "Spaces: 4" — not part of this feature)

---

## 7. Assumptions

- The existing `CustomEvent` dispatch mechanism in the renderer is sufficient — no new IPC channels to the main process are required for encoding/language/EOL changes
- Monaco Editor's `setModelLanguage()` and `setEOL()` APIs will continue to work as they do today
- The ~20 language list is manageable with a simple substring filter; no fuzzy matching is needed
- Users expect VS Code-style interaction patterns since NovaPad targets developers familiar with modern code editors

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Quick Pick | A centered overlay popup with a search input and selectable list of options, inspired by VS Code's Quick Pick / command palette UI |
| Status Bar | The bottom bar of the NovaPad window showing cursor position, encoding, language, EOL, and file state |
| EOL | End-of-line format: LF (Unix), CRLF (Windows), or CR (Classic Mac) |
| Active buffer | The currently visible editor tab's data (content, encoding, language, etc.) stored in Zustand |
| CustomEvent | Browser DOM event used for intra-renderer communication between StatusBar/QuickPick and EditorPane |
