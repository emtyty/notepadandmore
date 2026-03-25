import * as monaco from 'monaco-editor'

/** Module-level singleton to share Monaco editor instance between EditorPane and search hooks */
let _editor: monaco.editor.IStandaloneCodeEditor | null = null

export const editorRegistry = {
  set(editor: monaco.editor.IStandaloneCodeEditor | null): void {
    _editor = editor
  },
  get(): monaco.editor.IStandaloneCodeEditor | null {
    return _editor
  }
}
