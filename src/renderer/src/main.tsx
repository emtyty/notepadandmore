import React from 'react'
import ReactDOM from 'react-dom/client'
import 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import App from './App'

// Stub worker for language services we intentionally drop (ts/js/css/scss/less).
// Without `?worker` imports for ts.worker and css.worker, Vite no longer bundles
// those chunks (~13.9 MB saved). The TS/CSS language services still register
// from `monaco-editor` and try to spawn a worker — we hand them this empty
// stub which swallows messages. Their requests pend silently; we lose
// IntelliSense/diagnostics for those languages but Monarch highlighting is
// unaffected because it runs on the main thread.
const stubWorkerUrl = URL.createObjectURL(
  new Blob([''], { type: 'application/javascript' })
)
const makeStubWorker = (): Worker => new Worker(stubWorkerUrl)

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return makeStubWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return makeStubWorker()
    return new editorWorker()
  }
}
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import './styles/tailwind.css'

// Apply dark theme synchronously before first render
document.documentElement.classList.add('dark')

// Suppress Monaco Editor's internal "Canceled" promise rejections.
// These fire when a model is disposed while async operations (IntelliSense,
// validation, etc.) are still pending — completely harmless.
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.message === 'Canceled' || e.reason?.name === 'Canceled') {
    e.preventDefault()
  }
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
