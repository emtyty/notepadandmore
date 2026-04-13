import { create } from 'zustand'
import * as monaco from 'monaco-editor'

export type EOLType = 'CRLF' | 'LF' | 'CR'

export type BufferKind = 'file' | 'settings' | 'shortcuts' | 'whatsNew'

export interface Buffer {
  id: string
  kind: BufferKind             // 'file' for normal file/untitled buffers; virtual tabs otherwise
  filePath: string | null      // null = untitled or virtual
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
  isLargeFile: boolean         // true = file exceeds large file threshold (disables expensive features)
}

interface EditorState {
  buffers: Buffer[]
  activeId: string | null
  splitActive: boolean
  splitActiveId: string | null

  // Actions
  addBuffer: (buf: Omit<Buffer, 'id' | 'model' | 'kind'> & { kind?: BufferKind }) => string
  addGhostBuffer: (buf: Omit<Buffer, 'id' | 'model' | 'kind'> & { kind?: BufferKind }) => string
  hydrateBuffer: (id: string, patch: { content: string; encoding: string; eol: EOLType; mtime: number }) => void
  removeBuffer: (id: string) => void
  updateBuffer: (id: string, patch: Partial<Buffer>) => void
  setActive: (id: string) => void
  setSplitActive: (id: string) => void
  toggleSplit: () => void
  getActive: () => Buffer | null
  getBuffer: (id: string) => Buffer | null
  findVirtualBuffer: (kind: BufferKind) => Buffer | null
  openVirtualTab: (
    kind: 'settings' | 'shortcuts' | 'whatsNew',
    options?: { activate?: boolean }
  ) => string
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
    // Force plaintext for large files to skip expensive tokenization
    const lang = buf.isLargeFile ? 'plaintext' : (buf.language || 'plaintext')
    const model = monaco.editor.createModel(buf.content, lang)
    set((s) => ({
      buffers: [...s.buffers, { ...buf, kind: buf.kind ?? 'file', id, model, loaded: true, missing: false, savedViewState: buf.savedViewState ?? null }],
      activeId: s.activeId ?? id
    }))
    return id
  },

  addGhostBuffer: (buf) => {
    const id = newId()
    set((s) => ({
      buffers: [...s.buffers, { ...buf, kind: buf.kind ?? 'file', id, model: null }],
      activeId: s.activeId ?? id
    }))
    return id
  },

  hydrateBuffer: (id, patch) => {
    const buf = get().buffers.find((b) => b.id === id)
    if (!buf || buf.loaded) return
    const lang = buf.isLargeFile ? 'plaintext' : (buf.language || 'plaintext')
    const model = monaco.editor.createModel(patch.content, lang)
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

  getBuffer: (id) => get().buffers.find((b) => b.id === id) ?? null,

  findVirtualBuffer: (kind) => get().buffers.find((b) => b.kind === kind) ?? null,

  openVirtualTab: (kind, options) => {
    const activate = options?.activate ?? true
    const existing = get().buffers.find((b) => b.kind === kind)
    if (existing) {
      if (activate) set({ activeId: existing.id })
      return existing.id
    }
    const id = newId()
    const title =
      kind === 'settings' ? 'Settings'
      : kind === 'shortcuts' ? 'Keyboard Shortcuts'
      : "What's New"
    set((s) => ({
      buffers: [
        ...s.buffers,
        {
          id,
          kind,
          filePath: null,
          title,
          content: '',
          isDirty: false,
          encoding: 'UTF-8',
          eol: 'LF',
          language: 'plaintext',
          mtime: 0,
          viewState: null,
          savedViewState: null,
          model: null,
          bookmarks: [],
          loaded: true,
          missing: false,
          isLargeFile: false
        }
      ],
      ...(activate ? { activeId: id } : {})
    }))
    return id
  }
}))
