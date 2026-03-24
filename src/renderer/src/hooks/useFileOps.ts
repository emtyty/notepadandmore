import { useCallback } from 'react'
import { useEditorStore, EOLType } from '../store/editorStore'
import { useUIStore } from '../store/uiStore'
import { detectLanguage } from '../utils/languageDetect'

function basename(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p
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
      }
      on: (channel: string, cb: (...args: unknown[]) => void) => void
      send: (channel: string, ...args: unknown[]) => void
    }
  }
}

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
      addBuffer({
        filePath: fp,
        title: basename(fp),
        content: result.content,
        isDirty: false,
        encoding: result.encoding,
        eol: result.eol as EOLType,
        language,
        mtime: result.mtime,
        viewState: null
      })
      window.api.file.addRecent(fp)
    }
  }, [buffers, addBuffer, addToast])

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
    addBuffer({
      filePath: null,
      title: `new ${n}`,
      content: '',
      isDirty: false,
      encoding: 'UTF-8',
      eol: 'LF',
      language: 'plaintext',
      mtime: 0,
      viewState: null
    })
  }, [addBuffer])

  const saveBuffer = useCallback(async (id: string): Promise<boolean> => {
    const buf = useEditorStore.getState().getBuffer(id)
    if (!buf) return false

    let filePath = buf.filePath
    if (!filePath) {
      const res = await window.api.file.saveDialog()
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

    const res = await window.api.file.saveDialog(buf.filePath ?? undefined)
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
    removeBuffer(id)
  }, [removeBuffer])

  const reloadBuffer = useCallback(async (id: string) => {
    const buf = useEditorStore.getState().getBuffer(id)
    if (!buf?.filePath) return
    const result = await window.api.file.read(buf.filePath)
    if (result.error) { addToast(`Reload failed: ${result.error}`, 'error'); return }
    buf.model?.setValue(result.content)
    updateBuffer(id, { content: result.content, isDirty: false, mtime: result.mtime, eol: result.eol as EOLType })
  }, [updateBuffer, addToast])

  return { openFiles, newFile, saveBuffer, saveActiveAs, closeBuffer, reloadBuffer }
}
