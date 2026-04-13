import { create } from 'zustand'
import { useEditorStore } from './editorStore'

/**
 * A single location remembered in the navigation history — one line + column
 * inside a specific buffer. The `timestamp` is diagnostic; dedupe and ordering
 * use the arrays directly, not the timestamps.
 */
export interface NavigationEntry {
  bufferId: string
  line: number
  column: number
  timestamp: number
}

const MAX_ENTRIES = 50

interface NavigationState {
  /** Past positions. Oldest at index 0, most-recent at the end (top). */
  back: NavigationEntry[]
  /** Positions that were popped off `back` via Back and can be replayed. Top at the end. */
  forward: NavigationEntry[]
  /**
   * True while a goBack/goForward pipeline is resolving (tab swap + cursor set).
   * Entry-capture sites (tab-switch observer, cursor-change handler) must
   * short-circuit pushEntry while this is set — otherwise the navigation we
   * just initiated would re-push itself into history.
   */
  isNavigating: boolean

  // --- actions -------------------------------------------------------------

  /**
   * Record a new navigation point.
   *
   * Ignored when:
   *  - isNavigating is true (we're mid-navigation),
   *  - the entry's buffer is virtual (kind !== 'file'),
   *  - the entry's {bufferId, line} matches the current top of `back` (dedupe;
   *    column differences are ignored for dedupe).
   *
   * On push, `forward` is cleared (standard browser semantics) and the oldest
   * entry is dropped if the stack would exceed 50.
   */
  pushEntry: (entry: NavigationEntry) => void

  /**
   * Navigate backward. If `currentPosition` is provided it is pushed onto
   * `forward` before popping `back`, so a subsequent goForward() can return.
   * Returns the target entry (a live file buffer) or null if the stack is
   * empty or every remaining entry is stale.
   */
  goBack: (currentPosition?: NavigationEntry | null) => NavigationEntry | null

  /** Symmetric with goBack. */
  goForward: (currentPosition?: NavigationEntry | null) => NavigationEntry | null

  /** True iff at least one entry in `back` points at a live file buffer. */
  canGoBack: () => boolean

  /** True iff at least one entry in `forward` points at a live file buffer. */
  canGoForward: () => boolean

  /** Set by the navigation pipeline before it starts swapping tabs / cursors. */
  beginNavigating: () => void

  /** Clear at the end of the navigation pipeline. */
  endNavigating: () => void

  /**
   * Placeholder for a future eager cleanup strategy (§2.4 option A). In v1 we
   * skip stale entries lazily during goBack/goForward, so this is a no-op.
   */
  clearForBuffer: (bufferId: string) => void
}

/** True if the given bufferId is an open buffer of kind 'file'. */
function isLiveFileBuffer(bufferId: string): boolean {
  const buf = useEditorStore.getState().getBuffer(bufferId)
  return !!buf && buf.kind === 'file'
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  back: [],
  forward: [],
  isNavigating: false,

  pushEntry: (entry) => {
    const state = get()
    if (state.isNavigating) return

    // Virtual tabs are never recorded as destinations (BR-006).
    const buf = useEditorStore.getState().getBuffer(entry.bufferId)
    if (!buf || buf.kind !== 'file') return

    // Dedupe against the current top of `back` (BR-003).
    const top = state.back[state.back.length - 1]
    if (top && top.bufferId === entry.bufferId && top.line === entry.line) return

    // Append + cap + truncate forward.
    const nextBack = [...state.back, entry]
    if (nextBack.length > MAX_ENTRIES) nextBack.shift()
    set({ back: nextBack, forward: [] })
  },

  goBack: (currentPosition) => {
    // Pop entries off `back` until we find one that still points at a live file
    // buffer. Stale entries are discarded.
    const state = get()
    const back = [...state.back]
    const forward = [...state.forward]

    if (currentPosition) forward.push(currentPosition)

    let destination: NavigationEntry | null = null
    while (back.length > 0) {
      const candidate = back.pop() as NavigationEntry
      if (isLiveFileBuffer(candidate.bufferId)) {
        destination = candidate
        break
      }
      // else: drop it, loop.
    }

    // If we never found a live entry, the popped `currentPosition` we pushed
    // onto `forward` would be orphaned — undo that so the user isn't left with
    // a forward stack they can't actually reach.
    if (!destination && currentPosition) forward.pop()

    // Cap forward too, just in case pathological usage fills it.
    while (forward.length > MAX_ENTRIES) forward.shift()

    set({ back, forward })
    return destination
  },

  goForward: (currentPosition) => {
    const state = get()
    const back = [...state.back]
    const forward = [...state.forward]

    if (currentPosition) back.push(currentPosition)

    let destination: NavigationEntry | null = null
    while (forward.length > 0) {
      const candidate = forward.pop() as NavigationEntry
      if (isLiveFileBuffer(candidate.bufferId)) {
        destination = candidate
        break
      }
    }

    if (!destination && currentPosition) back.pop()

    while (back.length > MAX_ENTRIES) back.shift()

    set({ back, forward })
    return destination
  },

  canGoBack: () => {
    const { back } = get()
    for (let i = back.length - 1; i >= 0; i--) {
      if (isLiveFileBuffer(back[i].bufferId)) return true
    }
    return false
  },

  canGoForward: () => {
    const { forward } = get()
    for (let i = forward.length - 1; i >= 0; i--) {
      if (isLiveFileBuffer(forward[i].bufferId)) return true
    }
    return false
  },

  beginNavigating: () => set({ isNavigating: true }),
  endNavigating: () => set({ isNavigating: false }),

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  clearForBuffer: (_bufferId) => {
    // v1: lazy-skip at navigation time instead. Intentionally a no-op — the
    // method exists in the interface so we can swap strategies later without a
    // breaking API change.
  }
}))
