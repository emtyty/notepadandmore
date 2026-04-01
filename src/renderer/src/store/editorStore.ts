import { create } from 'zustand'
import * as monaco from 'monaco-editor'

export type EOLType = 'CRLF' | 'LF' | 'CR'

export interface Buffer {
  id: string
  filePath: string | null      // null = untitled
  title: string                // display name
  content: string
  isDirty: boolean
  encoding: string
  eol: EOLType
  language: string
  mtime: number                // last known on-disk mtime
  viewState: monaco.editor.ICodeEditorViewState | null
  savedViewState: object | null // serialized viewState from session (before model exists)
  model: monaco.editor.ITextModel | null
  bookmarks: number[]          // sorted list of 1-based bookmarked line numbers
  loaded: boolean              // false = ghost buffer (metadata only, no content/model)
  missing: boolean             // true = file no longer exists on disk
}

interface EditorState {
  buffers: Buffer[]
  activeId: string | null
  splitActive: boolean
  splitActiveId: string | null

  // Actions
  addBuffer: (buf: Omit<Buffer, 'id' | 'model'>) => string
  addGhostBuffer: (buf: Omit<Buffer, 'id' | 'model'>) => string
  hydrateBuffer: (id: string, patch: { content: string; encoding: string; eol: EOLType; mtime: number }) => void
  removeBuffer: (id: string) => void
  updateBuffer: (id: string, patch: Partial<Buffer>) => void
  setActive: (id: string) => void
  setSplitActive: (id: string) => void
  toggleSplit: () => void
  getActive: () => Buffer | null
  getBuffer: (id: string) => Buffer | null
}

let _idCounter = 0
function newId(): string {
  return `buf-${++_idCounter}`
}

export const useEditorStore = create<EditorState>((set, get) => ({
  buffers: [],
  activeId: null,
  splitActive: false,
  splitActiveId: null,

  addBuffer: (buf) => {
    const id = newId()
    const model = monaco.editor.createModel(buf.content, buf.language || 'plaintext')
    set((s) => ({
      buffers: [...s.buffers, { ...buf, id, model, loaded: true, missing: false, savedViewState: buf.savedViewState ?? null }],
      activeId: s.activeId ?? id
    }))
    return id
  },

  addGhostBuffer: (buf) => {
    const id = newId()
    set((s) => ({
      buffers: [...s.buffers, { ...buf, id, model: null }],
      activeId: s.activeId ?? id
    }))
    return id
  },

  hydrateBuffer: (id, patch) => {
    const buf = get().buffers.find((b) => b.id === id)
    if (!buf || buf.loaded) return
    const model = monaco.editor.createModel(patch.content, buf.language || 'plaintext')
    set((s) => ({
      buffers: s.buffers.map((b) =>
        b.id === id
          ? { ...b, ...patch, model, content: patch.content, loaded: true }
          : b
      )
    }))
  },

  removeBuffer: (id) => {
    const buf = get().buffers.find((b) => b.id === id)
    buf?.model?.dispose()
    set((s) => {
      const idx = s.buffers.findIndex((b) => b.id === id)
      const buffers = s.buffers.filter((b) => b.id !== id)
      let activeId = s.activeId
      if (activeId === id) {
        activeId = buffers[Math.max(0, idx - 1)]?.id ?? buffers[0]?.id ?? null
      }
      return { buffers, activeId }
    })
  },

  updateBuffer: (id, patch) => {
    set((s) => ({
      buffers: s.buffers.map((b) => (b.id === id ? { ...b, ...patch } : b))
    }))
  },

  setActive: (id) => set({ activeId: id }),
  setSplitActive: (id) => set({ splitActiveId: id }),
  toggleSplit: () => set((s) => ({ splitActive: !s.splitActive })),

  getActive: () => {
    const s = get()
    return s.buffers.find((b) => b.id === s.activeId) ?? null
  },

  getBuffer: (id) => get().buffers.find((b) => b.id === id) ?? null
}))
