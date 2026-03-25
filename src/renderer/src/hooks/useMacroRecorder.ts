import { useCallback, useRef } from 'react'
import * as monaco from 'monaco-editor'
import { useUIStore, MacroStep } from '../store/uiStore'

export function useMacroRecorder() {
  const { startRecording, stopRecording, addToast } = useUIStore()
  const stepsRef = useRef<MacroStep[]>([])
  const disposableRef = useRef<monaco.IDisposable | null>(null)

  const recordStep = useCallback((step: MacroStep) => {
    stepsRef.current.push(step)
  }, [])

  const start = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor) => {
      stepsRef.current = []
      disposableRef.current = editor.onDidType((text) => {
        stepsRef.current.push({ type: 'type', value: text })
      })
      startRecording()
      addToast('Macro recording started.', 'info')
    },
    [startRecording, addToast]
  )

  const stop = useCallback(() => {
    disposableRef.current?.dispose()
    disposableRef.current = null
    const steps = [...stepsRef.current]
    stopRecording(steps)
    addToast(`Macro recorded: ${steps.length} step${steps.length !== 1 ? 's' : ''}.`, 'info')
  }, [stopRecording, addToast])

  const playback = useCallback(
    async (editor: monaco.editor.IStandaloneCodeEditor) => {
      const steps = useUIStore.getState().macroSteps
      if (steps.length === 0) {
        addToast('No macro recorded.', 'warn')
        return
      }

      for (const step of steps) {
        if (step.type === 'type') {
          const selection = editor.getSelection()
          if (!selection) continue
          editor.executeEdits('macro-playback', [
            { range: selection, text: step.value, forceMoveMarkers: true }
          ])
        } else if (step.type === 'command') {
          window.dispatchEvent(new CustomEvent('macro:replay-command', { detail: step.value }))
        }
        // Yield to let Monaco process each edit
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
      }
    },
    [addToast]
  )

  return { start, stop, playback, recordStep }
}
