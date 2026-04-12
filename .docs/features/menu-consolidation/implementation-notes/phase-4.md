# Phase 4: Feature-Parity MenuBar — Completion Note

**Status:** Completed
**Date:** 2026-04-12

## What was done
- 4.1: Extended MenuItem interface with `disabled`, `checked`, `submenu` fields
- 4.2: Added submenu rendering with hover-to-expand and ChevronRight indicator
- 4.3: Added disabled item styling (opacity-40, pointer-events-none)
- 4.4: Added `onOpenFolder` prop with openDirDialog integration
- 4.5: Upgraded File menu (added Open Folder)
- 4.6: Upgraded Edit menu (Line Operations submenu, Convert Case submenu, Toggle Comment, Block Comment, Trim Whitespace, Indent/Outdent)
- 4.7: Upgraded Search menu (Go to Line, Bookmarks disabled)
- 4.8: Upgraded View menu (Word Wrap, Show Whitespace, Indent Guides, Column Select, Zoom, Split View disabled)
- 4.9: Added Encoding menu (6 encodings + EOL Format submenu)
- 4.10: Added Language menu (22 languages)
- 4.11: Added Settings menu (Preferences, Dark Mode toggle, 3 disabled items)
- 4.12: Added Macro menu (all disabled)
- 4.13: Added Plugins menu (Plugin Manager disabled)
- 4.14: Added Window menu (Minimize, Zoom, Next/Previous Tab)
- 4.15: Added Help menu (About NovaPad, Open DevTools)
- 4.16: Updated topMenus to 11 entries
- Added CustomEvent listeners in EditorPane for editor:set-option-local and editor:set-language-local
- Added tab:next-local/tab:prev-local listeners in App.tsx

## Verification results
- [x] `npm run build` compiles with no errors

## Commits
| Commit | Message |
|--------|---------|
| `35ebe5c` | feat(core): feature-parity MenuBar with 11 menus, submenus, disabled items |

## Pending / Known issues
- Window > Minimize and Window > Zoom dispatch CustomEvents that aren't yet handled (would need Electron `ipcRenderer.invoke` for window control). Low priority since keyboard shortcuts work via native menu.
- Help > Open DevTools dispatches `dev:toggle-devtools` CustomEvent — not yet wired to `webContents.toggleDevTools()`. F12 accelerator on native menu handles this on all platforms.
