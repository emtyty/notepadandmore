import { useRef, useCallback } from 'react'
import * as monaco from 'monaco-editor'
import { useUIStore } from '../store/uiStore'

type MacroAction =
  | { type: 'type'; text: string }
  | { type: 'command'; id: string }

export function useMacros(
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
) {
  const actionsRef = useRef<MacroAction[]>([])
  const recordingRef = useRef(false)
  const typeDisposableRef = useRef<monaco.IDisposable | null>(null)
  const commandInterceptRef = useRef<((cmd: string) => void) | null>(null)

  const startRecording = useCallback(() => {
    const editor = editorRef.current
    if (!editor || recordingRef.current) return

    recordingRef.current = true
    actionsRef.current = []
    useUIStore.getState().setIsRecording(true)

    // Listen for typed text
    typeDisposableRef.current = editor.onDidType((text) => {
      if (recordingRef.current) {
        actionsRef.current.push({ type: 'type', text })
      }
    })

    // Set up command intercept — EditorPane will call this
    commandInterceptRef.current = (cmd: string) => {
      if (recordingRef.current) {
        actionsRef.current.push({ type: 'command', id: cmd })
      }
    }
  }, [editorRef])

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return

    recordingRef.current = false
    typeDisposableRef.current?.dispose()
    typeDisposableRef.current = null
    commandInterceptRef.current = null
    useUIStore.getState().setIsRecording(false)
  }, [])

  const playback = useCallback(() => {
    const editor = editorRef.current
    if (!editor || recordingRef.current || actionsRef.current.length === 0) return

    for (const action of actionsRef.current) {
      if (action.type === 'type') {
        editor.trigger('macro', 'type', { text: action.text })
      } else if (action.type === 'command') {
        // Re-dispatch the command through the editor:command IPC simulation
        window.dispatchEvent(new CustomEvent('macro:replay-command', { detail: { command: action.id } }))
      }
    }
  }, [editorRef])

  const recordCommand = useCallback((cmd: string) => {
    commandInterceptRef.current?.(cmd)
  }, [])

  return { startRecording, stopRecording, playback, recordCommand, isRecording: recordingRef }
}
