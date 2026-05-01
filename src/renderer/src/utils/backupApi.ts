export interface BackupApi {
  write: (filename: string, content: string) => Promise<{ error: string | null }>
  read: (filename: string) => Promise<string | null>
  delete: (filename: string) => Promise<void>
  getDir: () => Promise<string>
  list: () => Promise<string[]>
  cleanup: (keep: string[]) => Promise<void>
}

export function backupApi(): BackupApi {
  return (window.api as unknown as { backup: BackupApi }).backup
}
