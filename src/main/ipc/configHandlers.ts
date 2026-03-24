import { ipcMain, app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'

function configDir(): string {
  return path.join(app.getPath('userData'), 'config')
}

function ensureConfigDir(): void {
  const dir = configDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function configPath(name: string): string {
  return path.join(configDir(), name)
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: '@_', format: true })

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get-dir', () => configDir())

  ipcMain.handle('config:read', async (_event, name: string) => {
    ensureConfigDir()
    const fp = configPath(name)
    if (!fs.existsSync(fp)) return null
    try {
      const xml = fs.readFileSync(fp, 'utf8')
      return parser.parse(xml)
    } catch {
      return null
    }
  })

  ipcMain.handle('config:write', async (_event, name: string, data: object) => {
    ensureConfigDir()
    try {
      const xml = builder.build(data)
      fs.writeFileSync(configPath(name), xml, 'utf8')
      return { error: null }
    } catch (err: any) {
      return { error: err.message }
    }
  })

  ipcMain.handle('config:read-raw', async (_event, name: string) => {
    ensureConfigDir()
    const fp = configPath(name)
    if (!fs.existsSync(fp)) return null
    return fs.readFileSync(fp, 'utf8')
  })

  ipcMain.handle('config:write-raw', async (_event, name: string, content: string) => {
    ensureConfigDir()
    fs.writeFileSync(configPath(name), content, 'utf8')
  })

  ipcMain.handle('config:list-udl', async () => {
    ensureConfigDir()
    const udlDir = path.join(configDir(), 'userDefineLangs')
    if (!fs.existsSync(udlDir)) fs.mkdirSync(udlDir, { recursive: true })
    return fs.readdirSync(udlDir).filter((f) => f.endsWith('.xml'))
  })

  ipcMain.handle('config:read-udl', async (_event, filename: string) => {
    const fp = path.join(configDir(), 'userDefineLangs', filename)
    if (!fs.existsSync(fp)) return null
    const xml = fs.readFileSync(fp, 'utf8')
    return parser.parse(xml)
  })

  ipcMain.handle('config:write-udl', async (_event, filename: string, data: object) => {
    const udlDir = path.join(configDir(), 'userDefineLangs')
    if (!fs.existsSync(udlDir)) fs.mkdirSync(udlDir, { recursive: true })
    const xml = builder.build(data)
    fs.writeFileSync(path.join(udlDir, filename), xml, 'utf8')
  })
}
