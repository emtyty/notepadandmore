import { useCallback } from 'react'
import { useEditorStore, EOLType } from '../store/editorStore'
import { useUIStore } from '../store/uiStore'
import { detectLanguage } from '../utils/languageDetect'

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

export interface SessionData {
  version: number
  files: Array<{
    filePath: string
    language: string
    encoding: string
    eol: string
    viewState: object | null
  }>
  activeIndex: number
  workspaceFolder?: string
}

declare global {
  interface Window {
    api: {
      file: {
        read: (p: string) => Promise<{ content: string; encoding: string; eol: string; mtime: number; error: string | null }>
        write: (p: string, content: string, enc?: string, eol?: string) => Promise<{ error: string | null }>
        saveDialog: (defaultPath?: string) => Promise<{ canceled: boolean; filePath?: string }>
        checkMtime: (p: string, mtime: number) => Promise<{ changed: boolean; mtime: number }>
        reveal: (p: string) => Promise<void>
        addRecent: (p: string) => void
        stat: (p: string) => Promise<{ exists: boolean; size: number; mtime: number; isDir: boolean }>
        statBatch: (paths: string[]) => Promise<Array<{ filePath: string; exists: boolean; mtime: number }>>
        listDir: (p: string) => Promise<Array<{ name: string; path: string; isDir: boolean }>>
        create: (p: string) => Promise<{ error: string | null }>
        delete: (p: string) => Promise<{ error: string | null }>
        rename: (oldPath: string, newPath: string) => Promise<{ error: string | null }>
        mkdir: (p: string) => Promise<{ error: string | null }>
        openDirDialog: () => Promise<string | null>
        getRecents: () => Promise<string[]>
      }
      watch: {
        add: (p: string) => Promise<void>
        remove: (p: string) => Promise<void>
      }
      on: (channel: string, cb: (...args: unknown[]) => void) => void
      off: (channel: string) => void
      send: (channel: string, ...args: unknown[]) => void
      platform: string
    }
  }
}

/** Set of buffer IDs currently being loaded (prevents double-load on rapid clicks) */
const loadingSet = new Set<string>()

/** Preload timer handle for cleanup */
let preloadTimer: ReturnType<typeof setTimeout> | null = null

export function useFileOps() {
  const { addBuffer, updateBuffer, removeBuffer, buffers, activeId, getActive } = useEditorStore()
  const { addToast } = useUIStore()

  const openFiles = useCallback(async (filePaths: string[]) => {
    for (const fp of filePaths) {
      // Don't open same file twice
      const existing = buffers.find((b) => b.filePath === fp)
      if (existing) {
        useEditorStore.getState().setActive(existing.id)
        continue
      }

      const result = await window.api.file.read(fp)
      if (result.error) {
        addToast(`Failed to open: ${result.error}`, 'error')
        continue
      }

      const language = detectLanguage(fp)
      const id = addBuffer({
        filePath: fp,
        title: basename(fp),
        content: result.content,
        isDirty: false,
        encoding: result.encoding,
        eol: result.eol as EOLType,
        language,
        mtime: result.mtime,
        viewState: null,
        savedViewState: null,
        bookmarks: [],
        loaded: true,
        missing: false
      })
      useEditorStore.getState().setActive(id)
      window.api.file.addRecent(fp)
      window.api.watch.add(fp)
    }
  }, [buffers, addBuffer, addToast])

  /** Load file content for a ghost buffer on demand */
  const loadBuffer = useCallback(async (id: string): Promise<boolean> => {
    const buf = useEditorStore.getState().getBuffer(id)
    if (!buf || buf.loaded || !buf.filePath) return false
    if (loadingSet.has(id)) return false
    loadingSet.add(id)

    try {
      const result = await window.api.file.read(buf.filePath)
      if (result.error) {
        useEditorStore.getState().updateBuffer(id, { missing: true, loaded: true })
        addToast(`File not found: ${buf.title}`, 'warn')
        return false
      }

      useEditorStore.getState().hydrateBuffer(id, {
        content: result.content,
        encoding: result.encoding,
        eol: result.eol as EOLType,
        mtime: result.mtime
      })

      window.api.watch.add(buf.filePath)
      window.api.file.addRecent(buf.filePath)
      return true
    } finally {
      loadingSet.delete(id)
    }
  }, [addToast])

  /** Restore session using 2-phase lazy loading (VSCode pattern) */
  const restoreSession = useCallback(async (session: SessionData) => {
    const store = useEditorStore.getState()

    // Batch check file existence — single IPC call
    const filePaths = session.files.map((f) => f.filePath).filter(Boolean)
    const stats = await window.api.file.statBatch(filePaths)
    const existsMap = new Map(stats.map((s) => [s.filePath, s.exists]))

    // Phase 1: Create ghost buffers for all files (no content, no Monaco model)
    const ids: string[] = []
    for (const file of session.files) {
      if (!file.filePath) continue
      const exists = existsMap.get(file.filePath) ?? false
      const id = store.addGhostBuffer({
        filePath: file.filePath,
        title: basename(file.filePath),
        content: '',
        isDirty: false,
        encoding: file.encoding || 'UTF-8',
        eol: (file.eol as EOLType) || 'LF',
        language: file.language || detectLanguage(file.filePath),
        mtime: 0,
        viewState: null,
        savedViewState: file.viewState ?? null,
        bookmarks: [],
        loaded: false,
        missing: !exists
      })
      ids.push(id)
    }

    if (ids.length === 0) return

    // Set active tab (tab bar renders immediately)
    // EditorPane will detect the ghost buffer and trigger loadBuffer on mount
    const activeIdx = Math.min(Math.max(0, session.activeIndex), ids.length - 1)
    useEditorStore.getState().setActive(ids[activeIdx])

    // Phase 3: Background preload non-active tabs (neighbors first)
    // Active tab is loaded by EditorPane; skip it in the preload queue
    const preloadIds = ids.filter((_, i) => i !== activeIdx)
    schedulePreload(preloadIds, 0, loadBuffer)
  }, [loadBuffer])

  const newFile = useCallback(() => {
    const currentBuffers = useEditorStore.getState().buffers
    const usedNumbers = new Set(
      currentBuffers
        .filter((b) => !b.filePath)
        .map((b) => {
          const m = b.title.match(/^new (\d+)$/)
          return m ? parseInt(m[1], 10) : null
        })
        .filter((n): n is number => n !== null)
    )
    let n = 1
    while (usedNumbers.has(n)) n++
    const id = addBuffer({
      filePath: null,
      title: `new ${n}`,
      content: '',
      isDirty: false,
      encoding: 'UTF-8',
      eol: 'LF',
      language: 'plaintext',
      mtime: 0,
      viewState: null,
      savedViewState: null,
      bookmarks: [],
      loaded: true,
      missing: false
    })
    useEditorStore.getState().setActive(id)
  }, [addBuffer])

  const saveBuffer = useCallback(async (id: string): Promise<boolean> => {
    const buf = useEditorStore.getState().getBuffer(id)
    if (!buf) return false

    // Can't save a ghost buffer that hasn't been loaded yet
    if (!buf.loaded) return false

    let filePath = buf.filePath
    if (!filePath) {
      const res = await window.api.file.saveDialog(buf.title)
      if (res.canceled || !res.filePath) return false
      filePath = res.filePath
    }

    const content = buf.model?.getValue() ?? buf.content
    const result = await window.api.file.write(filePath, content, buf.encoding, buf.eol)
    if (result.error) {
      addToast(`Save failed: ${result.error}`, 'error')
      return false
    }

    updateBuffer(id, {
      filePath,
      title: basename(filePath),
      isDirty: false,
      content
    })
    window.api.file.addRecent(filePath)
    return true
  }, [updateBuffer, addToast])

  const saveActiveAs = useCallback(async (): Promise<boolean> => {
    const buf = getActive()
    if (!buf) return false

    const res = await window.api.file.saveDialog(buf.filePath ?? buf.title)
    if (res.canceled || !res.filePath) return false

    const content = buf.model?.getValue() ?? buf.content
    const result = await window.api.file.write(res.filePath, content, buf.encoding, buf.eol)
    if (result.error) {
      addToast(`Save failed: ${result.error}`, 'error')
      return false
    }

    updateBuffer(buf.id, {
      filePath: res.filePath,
      title: basename(res.filePath),
      isDirty: false,
      content
    })
    window.api.file.addRecent(res.filePath)
    return true
  }, [getActive, updateBuffer, addToast])

  const closeBuffer = useCallback((id: string) => {
    const buf = useEditorStore.getState().getBuffer(id)
    if (!buf) return
    if (buf.isDirty) {
      if (!confirm(`'${buf.title}' has unsaved changes. Close anyway?`)) return
    }
    if (buf.filePath) window.api.watch.remove(buf.filePath)
    removeBuffer(id)
  }, [removeBuffer])

  const reloadBuffer = useCallback(async (id: string) => {
    const buf = useEditorStore.getState().getBuffer(id)
    if (!buf?.filePath) return
    // Skip reload for ghost buffers — file will be loaded fresh on tab click
    if (!buf.loaded) return
    const result = await window.api.file.read(buf.filePath)
    if (result.error) { addToast(`Reload failed: ${result.error}`, 'error'); return }
    buf.model?.setValue(result.content)
    updateBuffer(id, { content: result.content, isDirty: false, mtime: result.mtime, eol: result.eol as EOLType })
  }, [updateBuffer, addToast])

  return { openFiles, newFile, saveBuffer, saveActiveAs, closeBuffer, reloadBuffer, loadBuffer, restoreSession }
}

/** Background preload: load neighbor tabs first, then outward, with small delay between each */
function schedulePreload(
  ids: string[],
  activeIdx: number,
  loadBufferFn: (id: string) => Promise<boolean>
): void {
  if (preloadTimer) clearTimeout(preloadTimer)

  const queue: string[] = []
  for (let offset = 1; offset < ids.length; offset++) {
    if (activeIdx + offset < ids.length) queue.push(ids[activeIdx + offset])
    if (activeIdx - offset >= 0) queue.push(ids[activeIdx - offset])
  }

  let i = 0
  const loadNext = (): void => {
    if (i >= queue.length) return
    const id = queue[i++]
    const buf = useEditorStore.getState().getBuffer(id)
    if (buf && !buf.loaded && !buf.missing) {
      loadBufferFn(id).then(() => {
        preloadTimer = setTimeout(loadNext, 50)
      })
    } else {
      preloadTimer = setTimeout(loadNext, 0)
    }
  }
  // Start preloading after UI settles
  preloadTimer = setTimeout(loadNext, 500)
}
