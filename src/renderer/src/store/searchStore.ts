import { create } from 'zustand'

export type SearchMode = 'normal' | 'extended' | 'regex'

export interface SearchOptions {
  pattern: string
  replaceText: string
  searchMode: SearchMode
  isCaseSensitive: boolean
  isWholeWord: boolean
  isWrapAround: boolean
  searchBackward: boolean
  inSelection: boolean
  dotMatchesNewline: boolean
}

export interface FindResultLine {
  lineNumber: number   // 1-based
  column: number       // 1-based
  endColumn: number    // 1-based
  lineText: string
  matchText: string
}

export interface FindResultFile {
  filePath: string | null
  title: string
  bufferId?: string    // set for open docs
  results: FindResultLine[]
}

export interface FindResultSet {
  query: string
  scope: string        // 'currentDoc' | 'allOpenDocs' | 'directory:...'
  totalHits: number
  files: FindResultFile[]
}

const MAX_HISTORY = 20

interface SearchState {
  options: SearchOptions
  patternHistory: string[]
  replaceHistory: string[]
  findResults: FindResultSet | null
  markStyleIndex: number           // 0-4, active mark style for Mark tab
  isSearching: boolean             // for Find in Files loading state

  setOptions: (patch: Partial<SearchOptions>) => void
  pushPatternHistory: (p: string) => void
  pushReplaceHistory: (p: string) => void
  setFindResults: (r: FindResultSet | null) => void
  setMarkStyleIndex: (i: number) => void
  setIsSearching: (v: boolean) => void
}

export const useSearchStore = create<SearchState>((set) => ({
  options: {
    pattern: '',
    replaceText: '',
    searchMode: 'normal',
    isCaseSensitive: false,
    isWholeWord: false,
    isWrapAround: true,
    searchBackward: false,
    inSelection: false,
    dotMatchesNewline: false
  },
  patternHistory: [],
  replaceHistory: [],
  findResults: null,
  markStyleIndex: 0,
  isSearching: false,

  setOptions: (patch) =>
    set((s) => ({ options: { ...s.options, ...patch } })),

  pushPatternHistory: (p) =>
    set((s) => ({
      patternHistory: [p, ...s.patternHistory.filter((x) => x !== p)].slice(0, MAX_HISTORY)
    })),

  pushReplaceHistory: (p) =>
    set((s) => ({
      replaceHistory: [p, ...s.replaceHistory.filter((x) => x !== p)].slice(0, MAX_HISTORY)
    })),

  setFindResults: (r) => set({ findResults: r }),
  setMarkStyleIndex: (i) => set({ markStyleIndex: i }),
  setIsSearching: (v) => set({ isSearching: v })
}))
