import { useCallback } from 'react'
import { useEditorStore, EOLType } from '../store/editorStore'
import { useUIStore } from '../store/uiStore'
import { detectLanguage } from '../utils/languageDetect'
import { refineLanguageAsync } from '../utils/refineLanguage'
import { languageToExtension } from '../utils/languageToExtension'
import { backupApi } from '../utils/backupApi'

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
}

/** Files above this threshold get large-file optimizations (no syntax highlighting, etc.) */
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024 // 10 MB

export interface SessionData {
  version: number
  files: Array<{
    filePath: string | null
    title?: string | null
    language: string
    encoding: string
    eol: string
    viewState: object | null
    backupPath?: string | null
    originalMtime?: number
    isDirty?: boolean
  }>
  virtualTabs?: Array<{ kind: string; pluginId?: string }>
  activeIndex: number
  workspaceFolder?: string
}

declare global {
  interface Window {
    api: {
      file: {
        read: (p: string) => Promise<{ content: string; encoding: string; eol: string; mtime: number; magikaSample: Uint8Array; error: string | null }>
        write: (p: string, content: string, enc?: string, eol?: string) => Promise<{ error: string | null; magikaSample: Uint8Array }>
        saveDialog: (defaultPath?: string, suggestedExt?: string | null) => Promise<{ canceled: boolean; filePath?: string }>
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
      app: {
        getVersion: () => Promise<string>
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
      // Don't open same file twice — read fresh state to avoid stale closure
      const existing = useEditorStore.getState().buffers.find((b) => b.filePath === fp)
      if (existing) {
        useEditorStore.getState().setActive(existing.id)
        continue
      }

      // Check file size to determine large file mode
      const stat = await window.api.file.stat(fp)
      const isLargeFile = stat.exists && stat.size >= LARGE_FILE_THRESHOLD

      const result = await window.api.file.read(fp)
      if (result.error) {
        addToast(`Failed to open: ${result.error}`, 'error')
        continue
      }

      // Fast extension-based language for immediate highlighting;
      // Magika refines it in the background (WebGL-accelerated TF.js in renderer).
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
        missing: false,
        isLargeFile
      })
      useEditorStore.getState().setActive(id)
      window.api.file.addRecent(fp)
      window.api.watch.add(fp)
      if (result.magikaSample?.byteLength) {
        void refineLanguageAsync(id, result.magikaSample, language)
      }
    }
  }, [buffers, addBuffer, addToast])

  /** Load file content for a ghost buffer on demand */
  const loadBuffer = useCallback(async (id: string): Promise<boolean> => {
    const buf = useEditorStore.getState().getBuffer(id)
    if (!buf || buf.loaded || !buf.filePath) return false
    if (loadingSet.has(id)) return false
    loadingSet.add(id)

    try {
      // Check file size for large file mode
      const stat = await window.api.file.stat(buf.filePath)
      const isLargeFile = stat.exists && stat.size >= LARGE_FILE_THRESHOLD
      if (isLargeFile) {
        useEditorStore.getState().updateBuffer(id, { isLargeFile: true })
      }

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

    // Session v3+ flat order: [...virtualTabs, ...files]. Restore in that order
    // so activeIndex stays meaningful.
    const virtualTabs = session.virtualTabs ?? []
    const virtualIds: string[] = virtualTabs.map((v) => {
      if (v.kind === 'pluginManager') return store.openPluginManagerTab()
      if (v.kind === 'pluginDetail' && v.pluginId) return store.openPluginDetailTab(v.pluginId, v.pluginId)
      // settings, shortcuts, whatsNew
      return store.openVirtualTab(v.kind as 'settings' | 'shortcuts' | 'whatsNew')
    })

    // Batch check on-disk existence for entries that have a filePath. We use
    // this both for ghost-buffer "missing" flagging and to detect
    // backup-vs-disk mtime drift on snapshot-restored entries.
    const filePathsForStat = session.files
      .map((f) => f.filePath)
      .filter((p): p is string => !!p)
    const stats = filePathsForStat.length > 0
      ? await window.api.file.statBatch(filePathsForStat)
      : []
    const existsMap = new Map(stats.map((s) => [s.filePath, s.exists]))

    const fileIds: string[] = []
    const ghostFileIds: string[] = []
    let externallyChangedCount = 0

    for (const file of session.files) {
      // --- Snapshot-restore path: load contents from the backup file. ---
      if (file.backupPath) {
        const content = await backupApi().read(file.backupPath)
        if (content === null) {
          // Backup vanished (user nuked %APPDATA%\notepad-and-more\backup\?).
          // Fall back to ghost-loading the original if we have one.
          if (file.filePath) {
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
              missing: !exists,
              isLargeFile: false
            })
            fileIds.push(id)
            ghostFileIds.push(id)
          }
          // Untitled with missing backup is unrecoverable — drop it.
          continue
        }

        const title = file.filePath ? basename(file.filePath) : (file.title ?? 'untitled')
        const language =
          file.language ||
          (file.filePath ? detectLanguage(file.filePath) : 'plaintext')

        const id = store.addBuffer({
          filePath: file.filePath,
          title,
          content,
          isDirty: true,
          encoding: file.encoding || 'UTF-8',
          eol: (file.eol as EOLType) || 'LF',
          language,
          mtime: file.originalMtime ?? 0,
          viewState: null,
          savedViewState: file.viewState ?? null,
          bookmarks: [],
          loaded: true,
          missing: false,
          isLargeFile: false,
          backupPath: file.backupPath
        })
        fileIds.push(id)

        if (file.filePath) {
          window.api.watch.add(file.filePath)
          // External-change detection: if the on-disk file moved past the mtime
          // we recorded at session-save, the user (or another process) edited
          // it between sessions. Surface a warning toast — keep the backup
          // contents in the buffer; the user can reload manually.
          const stat = stats.find((s) => s.filePath === file.filePath)
          if (
            stat?.exists &&
            file.originalMtime &&
            stat.mtime > file.originalMtime + 1
          ) {
            externallyChangedCount++
          }
        }
        continue
      }

      // --- Normal ghost path (existing v1..v3 behavior). ---
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
        missing: !exists,
        isLargeFile: false
      })
      fileIds.push(id)
      ghostFileIds.push(id)
    }

    const allIds = [...virtualIds, ...fileIds]
    if (allIds.length === 0) return

    // Set active tab
    const activeIdx = Math.min(Math.max(0, session.activeIndex), allIds.length - 1)
    useEditorStore.getState().setActive(allIds[activeIdx])

    if (externallyChangedCount > 0) {
      addToast(
        externallyChangedCount === 1
          ? 'A restored file changed on disk while the app was closed — your unsaved version is shown.'
          : `${externallyChangedCount} restored files changed on disk while the app was closed — your unsaved versions are shown.`,
        'warn'
      )
    }

    // Background preload only the *ghost* file tabs — backup-restored ones
    // are already fully loaded and don't need re-reading from disk.
    schedulePreload(ghostFileIds, 0, loadBuffer)
  }, [loadBuffer, addToast])

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
      missing: false,
      isLargeFile: false
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
      const suggestedExt = languageToExtension(buf.language)
      const res = await window.api.file.saveDialog(buf.title, suggestedExt)
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
    if (result.magikaSample?.byteLength) {
      void refineLanguageAsync(id, result.magikaSample, buf.language)
    }
    return true
  }, [updateBuffer, addToast])

  const saveActiveAs = useCallback(async (): Promise<boolean> => {
    const buf = getActive()
    if (!buf) return false

    const suggestedExt = languageToExtension(buf.language)
    const res = await window.api.file.saveDialog(buf.filePath ?? buf.title, suggestedExt)
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
    if (result.magikaSample?.byteLength) {
      void refineLanguageAsync(buf.id, result.magikaSample, buf.language)
    }
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
