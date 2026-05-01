import { useEffect, useRef } from 'react'
import { useEditorStore, Buffer } from '../store/editorStore'
import { useConfigStore } from '../store/configStore'
import { mintBackupFilename } from '../utils/backupNaming'
import { backupApi } from '../utils/backupApi'

function isSnapshottable(b: Buffer): boolean {
  return b.kind === 'file' && b.isDirty && b.model !== null
}

/**
 * Notepad++-style periodic backup of dirty buffer contents. Pairs with the
 * close-flush in App.tsx and the restore-from-backup path in useFileOps.
 *
 * - Writes each dirty buffer's live model contents to
 *   `userData/backup/<title>@<ts>.bak` every `snapshotIntervalMs`.
 * - Mints the backup filename on first dirty write; stored on the buffer so
 *   subsequent snapshots overwrite the same file.
 * - Deletes the backup on dirty→clean (saved) and on buffer removal.
 */
export function useBackupSnapshot(): void {
  const enabled = useConfigStore((s) => s.rememberUnsavedOnExit)
  const intervalMs = useConfigStore((s) => s.snapshotIntervalMs)

  const lastWrittenRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    if (!enabled) {
      lastWrittenRef.current.clear()
      return
    }

    const writeOne = async (id: string): Promise<void> => {
      const buf = useEditorStore.getState().getBuffer(id)
      if (!buf || !isSnapshottable(buf)) return
      const content = buf.model!.getValue()
      if (lastWrittenRef.current.get(id) === content) return

      let filename = buf.backupPath
      if (!filename) {
        filename = mintBackupFilename(buf.title)
        useEditorStore.getState().updateBuffer(id, { backupPath: filename })
      }
      const result = await backupApi().write(filename, content)
      if (!result?.error) {
        lastWrittenRef.current.set(id, content)
      }
    }

    const flushAll = (): void => {
      for (const b of useEditorStore.getState().buffers) {
        if (isSnapshottable(b)) void writeOne(b.id)
      }
    }

    const timer = setInterval(flushAll, Math.max(1000, intervalMs))

    const unsub = useEditorStore.subscribe((state, prev) => {
      const prevById = new Map(prev.buffers.map((b) => [b.id, b]))
      const nextById = new Map(state.buffers.map((b) => [b.id, b]))

      // Dirty → clean: delete the backup, the on-disk file is the source of truth again.
      for (const [id, nb] of nextById) {
        const pb = prevById.get(id)
        if (pb && pb.isDirty && !nb.isDirty && pb.backupPath) {
          void backupApi().delete(pb.backupPath)
          if (nb.backupPath) {
            useEditorStore.getState().updateBuffer(id, { backupPath: null })
          }
          lastWrittenRef.current.delete(id)
        }
      }

      // Removed buffer: drop its backup.
      for (const [id, pb] of prevById) {
        if (!nextById.has(id) && pb.backupPath) {
          void backupApi().delete(pb.backupPath)
          lastWrittenRef.current.delete(id)
        }
      }
    })

    return () => {
      clearInterval(timer)
      unsub()
    }
  }, [enabled, intervalMs])
}
