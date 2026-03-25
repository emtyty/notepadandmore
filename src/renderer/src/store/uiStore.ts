import { create } from 'zustand'

type Theme = 'light' | 'dark'
export type BottomPanelId = 'findResults' | 'console'
export type MacroStep =
  | { type: 'type'; value: string }
  | { type: 'command'; value: string }

interface UIState {
  theme: Theme
  showToolbar: boolean
  showStatusBar: boolean
  showSidebar: boolean
  sidebarPanel: 'files' | 'project' | 'docmap' | 'functions'
  workspaceFolder: string | null
  showFindReplace: boolean
  findReplaceMode: 'find' | 'replace' | 'findInFiles'
  showPreferences: boolean
  showPluginManager: boolean
  showUDLEditor: boolean
  showAbout: boolean
  showBottomPanel: boolean
  activeBottomPanel: BottomPanelId
  toasts: Array<{ id: string; message: string; level: 'info' | 'warn' | 'error' }>
  isRecording: boolean
  macroSteps: MacroStep[]
  hasMacro: boolean

  setTheme: (t: Theme) => void
  toggleTheme: () => void
  setShowToolbar: (v: boolean) => void
  setShowStatusBar: (v: boolean) => void
  setShowSidebar: (v: boolean) => void
  setSidebarPanel: (p: UIState['sidebarPanel']) => void
  setWorkspaceFolder: (path: string | null) => void
  openFind: (mode?: UIState['findReplaceMode']) => void
  closeFind: () => void
  setShowPreferences: (v: boolean) => void
  setShowPluginManager: (v: boolean) => void
  setShowUDLEditor: (v: boolean) => void
  setShowAbout: (v: boolean) => void
  setShowBottomPanel: (v: boolean) => void
  setActiveBottomPanel: (p: BottomPanelId) => void
  addToast: (message: string, level?: 'info' | 'warn' | 'error') => void
  removeToast: (id: string) => void
  startRecording: () => void
  stopRecording: (steps: MacroStep[]) => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'dark',
  showToolbar: true,
  showStatusBar: true,
  showSidebar: false,
  sidebarPanel: 'files',
  workspaceFolder: null,
  showFindReplace: false,
  findReplaceMode: 'find',
  showPreferences: false,
  showPluginManager: false,
  showUDLEditor: false,
  showAbout: false,
  showBottomPanel: false,
  activeBottomPanel: 'findResults',
  toasts: [],
  isRecording: false,
  macroSteps: [],
  hasMacro: false,

  setTheme: (t) => set({ theme: t }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setShowToolbar: (v) => set({ showToolbar: v }),
  setShowStatusBar: (v) => set({ showStatusBar: v }),
  setShowSidebar: (v) => set({ showSidebar: v }),
  setSidebarPanel: (p) => set({ sidebarPanel: p }),
  setWorkspaceFolder: (path) => set({ workspaceFolder: path }),
  openFind: (mode = 'find') => set({ showFindReplace: true, findReplaceMode: mode }),
  closeFind: () => set({ showFindReplace: false }),
  setShowPreferences: (v) => set({ showPreferences: v }),
  setShowPluginManager: (v) => set({ showPluginManager: v }),
  setShowUDLEditor: (v) => set({ showUDLEditor: v }),
  setShowAbout: (v) => set({ showAbout: v }),
  setShowBottomPanel: (v) => set({ showBottomPanel: v }),
  setActiveBottomPanel: (p) => set({ activeBottomPanel: p }),

  addToast: (message, level = 'info') => {
    const id = Date.now().toString()
    set((s) => ({ toasts: [...s.toasts, { id, message, level }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  startRecording: () => set({ isRecording: true, macroSteps: [] }),
  stopRecording: (steps) => set({ isRecording: false, macroSteps: steps, hasMacro: steps.length > 0 })
}))
