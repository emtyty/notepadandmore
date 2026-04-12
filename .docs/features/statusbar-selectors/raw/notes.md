# Brainstorm Notes: Status Bar Selectors (Encoding, Language, EOL)

## Core Idea

Move Encoding and Language selection out of the top menu bar and into the Status Bar as clickable items with Quick Pick popups — matching VS Code's UX pattern. EOL also gets upgraded from a simple cycler to a proper picker.

## Decisions

### 1. Interaction Pattern — Quick Pick at top center (VS Code style)
Clicking a status bar item (Encoding, Language, EOL) opens a **command palette-style Quick Pick** popup anchored at the top center of the editor area. This is consistent with VS Code behavior and provides room for search/filter.

**Why:** Users familiar with VS Code expect this pattern. A bottom dropdown would feel cramped and non-standard.

### 2. EOL gets a proper picker popup
Currently EOL cycles through LF/CRLF on click. Upgrade to a proper picker popup like Encoding and Language, showing all options (LF, CRLF, CR) with labels.

**Why:** Cycling is discoverable only by accident. A picker shows all options at once and is consistent with the other two selectors.

### 3. Complete removal of Encoding and Language menus
Remove the **Encoding** and **Language** top-level menus from:
- Native Electron menu (`menu.ts`)
- Custom MenuBar (`MenuBar.tsx`)

The status bar becomes the **sole** entry point for these settings.

**Why:** Eliminates redundancy. The status bar is where users look for this info (VS Code trained this behavior). Fewer top-level menus = cleaner menu bar.

### 4. Full encoding list in picker
The picker must include all encodings currently in the menu:
- UTF-8
- UTF-8 with BOM
- UTF-16 LE
- UTF-16 BE
- Windows-1252 (Latin)
- ISO-8859-1 (Latin-1)

(The old status bar only cycled through the first 4.)

### 5. Language picker with search/filter
The language picker includes a text input for filtering. The current ~20 languages are listed, and typing narrows the list. This scales if more languages are added later.

## Scope

### In Scope
- **QuickPick component** — Reusable popup: overlay, search input, scrollable list, keyboard navigation (arrow keys, Enter, Escape)
- **Three status bar triggers** — Encoding, Language, EOL each open their respective QuickPick
- **Remove Encoding menu** from `menu.ts` (native) and `MenuBar.tsx` (custom)
- **Remove Language menu** from `menu.ts` (native) and `MenuBar.tsx` (custom)
- **Status bar visual update** — All three items get hover styling indicating they're clickable
- **Keyboard support** — Arrow keys to navigate, Enter to select, Escape to close, type-to-filter
- **Current selection highlighted** — Active encoding/language/EOL is visually marked in the picker

### Out of Scope
- "Reopen with Encoding" (VS Code has this — save for later)
- Auto-detect encoding on file open (already handled by `chardet` in fileHandlers)
- Adding more languages beyond the current ~20
- Command palette integration (future: could wire into a general command palette)

## Architecture Sketch

```
StatusBar.tsx
  ├── [Ln 1, Col 1]   (left)
  └── [REC] [LF ▾] [UTF-8 ▾] [JavaScript ▾] [Modified]  (right)
                │        │           │
                ▼        ▼           ▼
          QuickPick   QuickPick   QuickPick
          (EOL)      (Encoding)  (Language + search)
```

**QuickPick component:**
- Portal rendered at top-center of editor area
- Backdrop overlay (click to dismiss)
- Optional search input (always shown for Language, hidden for EOL/Encoding since lists are short — or always show for consistency)
- List items with label, optional description, checkmark for active
- Keyboard: Up/Down/Enter/Escape

**Data flow (unchanged):**
StatusBar click → QuickPick selection → `CustomEvent('editor:set-*')` → EditorPane handler → store update → re-render

The existing CustomEvent mechanism in EditorPane already handles both IPC and local events, so the renderer-side plumbing stays the same. We just change the trigger from menu/cycle to QuickPick selection.

## Open Questions

- Should search input be shown for Encoding/EOL pickers too (for consistency), or only for Language? **Decision: show for all three for consistency, even if the list is short.**
- Should the QuickPick animate in (fade/slide)? **Lean yes — subtle fade-in, ~100ms.**
