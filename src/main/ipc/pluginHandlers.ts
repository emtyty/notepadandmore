import { ipcMain } from 'electron'
import { PluginLoader } from '../plugins/PluginLoader'

export function registerPluginHandlers(): void {
  ipcMain.handle('plugin:list', async () => {
    return PluginLoader.getInstance().getPluginList()
  })

  ipcMain.handle('plugin:reload', async () => {
    // Reloading requires app restart in this simple model
    return { message: 'Restart the app to reload plugins.' }
  })

  // Renderer -> main: plugin API calls forwarded from plugin context
  ipcMain.on('plugin:api-call', (_event, pluginName: string, method: string, args: unknown[]) => {
    PluginLoader.getInstance().dispatchAPICall(pluginName, method, args)
  })
}
