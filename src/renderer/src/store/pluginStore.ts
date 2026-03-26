import { create } from 'zustand'

export interface PluginInfo {
  name: string
  version: string
  description?: string
  author?: string
  dirPath: string
  entryPath: string
  enabled: boolean
  error?: string
}

interface PluginState {
  plugins: PluginInfo[]
  dynamicMenuItems: Array<{ pluginName: string; label: string }>

  fetchPlugins: () => Promise<void>
  addDynamicMenuItem: (item: { pluginName: string; label: string }) => void
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  dynamicMenuItems: [],

  fetchPlugins: async () => {
    const list = await window.api.plugin.list()
    set({ plugins: list as PluginInfo[] })
  },

  addDynamicMenuItem: (item) =>
    set((s) => ({ dynamicMenuItems: [...s.dynamicMenuItems, item] }))
}))
