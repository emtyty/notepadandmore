export function sanitizeBackupName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 64) || 'untitled'
}

export function mintBackupFilename(title: string): string {
  return `${sanitizeBackupName(title)}@${Date.now()}.bak`
}
