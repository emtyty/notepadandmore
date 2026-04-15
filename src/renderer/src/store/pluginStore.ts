import { create } from 'zustand'
import { useEditorStore } from './editorStore'

export interface PluginInfo {
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  dirPath: string
  entryPath: string
  enabled: boolean
  error?: string
  hasReadme: boolean
  hasChangelog: boolean
  hasIcon: boolean
  hasSettings: boolean
}

export interface PluginDetail {
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  license?: string
  readme: string | null
  changelog: string | null
  iconDataUrl: string | null
}

export interface PluginSettingField {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'select'
  default: unknown
  description?: string
  options?: Array<{ label: string; value: string | number }>
  min?: number
  max?: number
}

export interface PluginSettingsSchema {
  fields: PluginSettingField[]
}

let saveTimers: Record<string, ReturnType<typeof setTimeout>> = {}

interface PluginState {
  plugins: PluginInfo[]
  pluginSettings: Record<string, PluginSettingsSchema>
  pluginConfigs: Record<string, Record<string, unknown>>
  dynamicMenuItems: Array<{ pluginName: string; label: string }>

  fetchPlugins: () => Promise<void>
  fetchDetail: (pluginName: string) => Promise<PluginDetail | null>
  enablePlugin: (pluginName: string) => Promise<void>
  disablePlugin: (pluginName: string) => Promise<void>
  reloadPlugin: (pluginName: string) => Promise<void>
  installPlugin: () => Promise<PluginInfo | null>
  uninstallPlugin: (pluginName: string) => Promise<void>
  fetchPluginSettings: () => Promise<void>
  setPluginConfig: (pluginName: string, key: string, value: unknown) => void
  loadPluginConfig: (pluginName: string) => Promise<void>
  addDynamicMenuItem: (item: { pluginName: string; label: string }) => void
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  pluginSettings: {},
  pluginConfigs: {},
  dynamicMenuItems: [],

  fetchPlugins: async () => {
    const list = await window.api.plugin.list()
    set({ plugins: list as PluginInfo[] })
  },

  fetchDetail: async (pluginName) => {
    const detail = await window.api.plugin.detail(pluginName)
    return detail as PluginDetail | null
  },

  enablePlugin: async (pluginName) => {
    await window.api.plugin.enable(pluginName)
    await get().fetchPlugins()
  },

  disablePlugin: async (pluginName) => {
    await window.api.plugin.disable(pluginName)
    await get().fetchPlugins()
  },

  reloadPlugin: async (pluginName) => {
    await window.api.plugin.reloadOne(pluginName)
    await get().fetchPlugins()
  },

  installPlugin: async () => {
    const result = await window.api.plugin.install()
    if (result) {
      await get().fetchPlugins()
      return result as PluginInfo
    }
    return null
  },

  uninstallPlugin: async (pluginName) => {
    await window.api.plugin.uninstall(pluginName)
    useEditorStore.getState().closePluginDetailTab(pluginName)
    await get().fetchPlugins()
  },

  fetchPluginSettings: async () => {
    const schemas = await window.api.plugin.settingsSchemas()
    set({ pluginSettings: schemas as Record<string, PluginSettingsSchema> })

    // Load config for each plugin that has settings
    for (const name of Object.keys(schemas)) {
      await get().loadPluginConfig(name)
    }
  },

  setPluginConfig: (pluginName, key, value) => {
    set((s) => ({
      pluginConfigs: {
        ...s.pluginConfigs,
        [pluginName]: {
          ...(s.pluginConfigs[pluginName] || {}),
          [key]: value
        }
      }
    }))

    // Debounced save per plugin
    if (saveTimers[pluginName]) clearTimeout(saveTimers[pluginName])
    saveTimers[pluginName] = setTimeout(async () => {
      const config = get().pluginConfigs[pluginName]
      if (config) {
        try {
          await window.api.config.writeRaw(
            `plugin-settings/${pluginName}.json`,
            JSON.stringify(config, null, 2)
          )
        } catch (e) {
          console.error(`Failed to save plugin config for ${pluginName}:`, e)
        }
      }
    }, 500)
  },

  loadPluginConfig: async (pluginName) => {
    try {
      const raw = await window.api.config.readRaw(`plugin-settings/${pluginName}.json`)
      if (raw) {
        const config = JSON.parse(raw)
        set((s) => ({
          pluginConfigs: {
            ...s.pluginConfigs,
            [pluginName]: config
          }
        }))
      }
    } catch {
      // No config yet — use defaults
    }
  },

  addDynamicMenuItem: (item) =>
    set((s) => ({ dynamicMenuItems: [...s.dynamicMenuItems, item] }))
}))
