import { useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useNavigationStore, NavigationEntry } from '../store/navigationStore'
import { editorRegistry } from '../utils/editorRegistry'

export type NavigationDirection = 'back' | 'forward'

/** Budget for waiting on the EditorPane model-swap effect to finish before giving up. */
const MAX_APPLY_ATTEMPTS = 5
const APPLY_RETRY_MS = 16

/**
 * Hook exposing `navigate(direction)` — the one entry point used by the
 * Back/Forward toolbar buttons, the keyboard shortcut listener, and the
 * mouse side-button listener. Per spec §7, it runs the whole pipeline:
 *
 *   begin → capture current pos → goBack/goForward → setActive → setPosition → end
 *
 * `isNavigating` is flipped for the entire pipeline so the tab-switch and
 * cursor-move side effects don't loop back into pushEntry.
 */
export function useNavigation() {
  const navigate = useCallback((direction: NavigationDirection) => {
    const nav = useNavigationStore.getState()
    const editor = editorRegistry.get()
    const editorStore = useEditorStore.getState()

    // Capture the live cursor only if the active buffer is a file — we don't
    // want to stash a "current position" for Settings / Shortcuts into the
    // opposite stack.
    const currentId = editorStore.activeId
    const activeBuf = currentId ? editorStore.getBuffer(currentId) : null
    let currentPosition: NavigationEntry | null = null
    if (editor && currentId && activeBuf?.kind === 'file') {
      const pos = editor.getPosition()
      if (pos) {
        currentPosition = {
          bufferId: currentId,
          line: pos.lineNumber,
          column: pos.column,
          timestamp: Date.now(),
        }
      }
    }

    nav.beginNavigating()

    const destination =
      direction === 'back' ? nav.goBack(currentPosition) : nav.goForward(currentPosition)

    if (!destination) {
      nav.endNavigating()
      return
    }

    // Swap to the destination buffer if needed. This schedules React to
    // re-render EditorPane, which runs its model-swap effect.
    if (editorStore.activeId !== destination.bufferId) {
      editorStore.setActive(destination.bufferId)
    }

    // Place the cursor once EditorPane has completed the model swap.
    applyPosition(destination, 0)
  }, [])

  return { navigate }
}

/**
 * Recursive-with-retry helper. EditorPane's model-swap effect runs after React
 * commits; if we fire `setPosition` too early, Monaco is still on the previous
 * model and our cursor update hits the wrong file. Poll `editor.getModel()`
 * against the target buffer's model and retry up to MAX_APPLY_ATTEMPTS times.
 */
function applyPosition(destination: NavigationEntry, attempt: number): void {
  const editor = editorRegistry.get()
  const targetBuf = useEditorStore.getState().getBuffer(destination.bufferId)
  const nav = useNavigationStore.getState()

  if (!editor || !targetBuf) {
    nav.endNavigating()
    return
  }

  // Model swap not yet complete — EditorPane's viewState restore will land the
  // cursor somewhere reasonable (spec §10); retry a few times then give up.
  if (!targetBuf.model || editor.getModel() !== targetBuf.model) {
    if (attempt < MAX_APPLY_ATTEMPTS) {
      setTimeout(() => applyPosition(destination, attempt + 1), APPLY_RETRY_MS)
    } else {
      nav.endNavigating()
    }
    return
  }

  try {
    editor.setPosition({ lineNumber: destination.line, column: destination.column })
    editor.revealLineInCenter(destination.line)
    editor.focus()
  } catch {
    // Monaco clamps invalid positions on its own; swallow any unexpected throw
    // (e.g., the file was edited and line no longer exists) rather than
    // leaving isNavigating stuck.
  }
  nav.endNavigating()
}
