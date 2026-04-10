import React, { useState, useEffect, useCallback } from 'react'
import { useEditorStore, EOLType } from '../../store/editorStore'
import { useUIStore } from '../../store/uiStore'

const EOL_CYCLE: EOLType[] = ['LF', 'CRLF']
const ENCODING_CYCLE = ['UTF-8', 'UTF-8 BOM', 'UTF-16 LE', 'UTF-16 BE']

export const StatusBar: React.FC = () => {
  const { getActive } = useEditorStore()
  const { isRecording } = useUIStore()
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const buf = getActive()

  useEffect(() => {
    const handler = (e: Event) => {
      const { line, col } = (e as CustomEvent).detail
      setCursor({ line, col })
    }
    window.addEventListener('editor:cursor', handler)
    return () => window.removeEventListener('editor:cursor', handler)
  }, [])

  const cycleEOL = useCallback(() => {
    if (!buf) return
    const current = buf.eol ?? 'LF'
    const idx = EOL_CYCLE.indexOf(current)
    const next = EOL_CYCLE[(idx + 1) % EOL_CYCLE.length]
    window.dispatchEvent(new CustomEvent('editor:set-eol', { detail: next }))
  }, [buf])

  const cycleEncoding = useCallback(() => {
    if (!buf) return
    const current = buf.encoding ?? 'UTF-8'
    const idx = ENCODING_CYCLE.indexOf(current)
    const next = ENCODING_CYCLE[idx >= 0 ? (idx + 1) % ENCODING_CYCLE.length : 0]
    window.dispatchEvent(new CustomEvent('editor:set-encoding', { detail: next }))
  }, [buf])

  return (
    <div className="h-6 bg-statusbar text-statusbar-foreground flex items-center px-2 text-[11px] select-none shrink-0" data-testid="statusbar">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <span data-testid="cursor-position" className="flex items-center gap-1">
          Ln {cursor.line}, Col {cursor.col}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section */}
      <div className="flex items-center gap-4">
        {isRecording && (
          <span className="text-destructive-foreground font-semibold tracking-wider animate-pulse">
            REC
          </span>
        )}

        <span
          className="cursor-pointer hover:underline decoration-dotted"
          onClick={cycleEOL}
          title="Click to cycle EOL type"
        >
          {buf?.eol ?? 'LF'}
        </span>

        <span
          className="cursor-pointer hover:underline decoration-dotted"
          onClick={cycleEncoding}
          title="Click to cycle encoding"
        >
          {buf?.encoding ?? 'UTF-8'}
        </span>

        <span>{buf?.language ?? 'Plain Text'}</span>

        <span className="opacity-70">
          {buf?.isDirty ? 'Modified' : buf?.filePath ? 'Saved' : 'New File'}
        </span>
      </div>
    </div>
  )
}
