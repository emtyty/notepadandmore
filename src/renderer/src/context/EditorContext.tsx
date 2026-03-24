import { createContext, useContext, MutableRefObject } from 'react'
import type * as monaco from 'monaco-editor'

type EditorRef = MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>

export const EditorContext = createContext<EditorRef | null>(null)

export function useEditorRef(): EditorRef {
  const ref = useContext(EditorContext)
  if (!ref) throw new Error('useEditorRef must be used within EditorContext.Provider')
  return ref
}
