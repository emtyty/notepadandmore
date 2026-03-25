import React, { useState, useEffect, useCallback } from 'react'
import * as monaco from 'monaco-editor'
import { useEditorStore } from '../../store/editorStore'
import { editorRegistry } from '../../utils/editorRegistry'
import styles from './FunctionListPanel.module.css'

interface SymbolNode {
  name: string
  detail?: string
  kind: number
  range: monaco.IRange
  children: SymbolNode[]
}

const SYMBOL_ICONS: Record<number, string> = {
  1:  'F',  // File
  2:  'M',  // Module
  3:  'N',  // Namespace
  4:  'P',  // Package
  5:  'C',  // Class
  6:  'm',  // Method
  7:  'p',  // Property
  8:  'f',  // Field
  9:  'c',  // Constructor
  10: 'E',  // Enum
  11: 'I',  // Interface
  12: 'ƒ',  // Function
  13: 'v',  // Variable
  14: 'K',  // Constant
  15: 'S',  // String
  16: '#',  // Number
  17: 'b',  // Boolean
  18: '[]', // Array
  19: '{}', // Object
  20: 'k',  // Key
  21: 'n',  // Null
  22: 'e',  // EnumMember
  23: 'S',  // Struct
  24: 'T',  // TypeParameter
}

function toSymbolNode(sym: monaco.languages.DocumentSymbol): SymbolNode {
  return {
    name: sym.name,
    detail: sym.detail,
    kind: sym.kind,
    range: sym.range,
    children: sym.children?.map(toSymbolNode) ?? []
  }
}

async function getSymbols(model: monaco.editor.ITextModel): Promise<SymbolNode[]> {
  try {
    // Access DocumentSymbolProviderRegistry via internal API
    const registry = (monaco.languages as unknown as Record<string, unknown>)['DocumentSymbolProviderRegistry']
    if (!registry || typeof (registry as Record<string, unknown>)['ordered'] !== 'function') return []
    const providers = (registry as { ordered: (model: monaco.editor.ITextModel) => unknown[] }).ordered(model)
    if (!providers.length) return []
    const cts = new monaco.CancellationTokenSource()
    const result = await (providers[0] as {
      provideDocumentSymbols: (
        model: monaco.editor.ITextModel,
        token: monaco.CancellationToken
      ) => Promise<monaco.languages.DocumentSymbol[] | null>
    }).provideDocumentSymbols(model, cts.token)
    cts.dispose()
    return result?.map(toSymbolNode) ?? []
  } catch {
    return []
  }
}

interface SymbolRowProps {
  node: SymbolNode
  depth: number
  onClick: (node: SymbolNode) => void
}

function SymbolRow({ node, depth, onClick }: SymbolRowProps) {
  return (
    <>
      <div
        className={styles.symbolRow}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => onClick(node)}
        title={`${node.name}${node.detail ? ` — ${node.detail}` : ''} (line ${node.range.startLineNumber})`}
      >
        <span className={styles.symbolIcon}>{SYMBOL_ICONS[node.kind] ?? '·'}</span>
        <span className={styles.symbolName}>{node.name}</span>
        {node.detail && <span className={styles.symbolDetail}>{node.detail}</span>}
      </div>
      {node.children.map((child, i) => (
        <SymbolRow key={i} node={child} depth={depth + 1} onClick={onClick} />
      ))}
    </>
  )
}

export function FunctionListPanel() {
  const [symbols, setSymbols] = useState<SymbolNode[]>([])
  const { activeId, getBuffer } = useEditorStore()

  const refresh = useCallback(async () => {
    const buf = activeId ? getBuffer(activeId) : null
    if (!buf?.model) { setSymbols([]); return }
    const syms = await getSymbols(buf.model)
    setSymbols(syms)
  }, [activeId, getBuffer])

  // Refresh when active buffer changes
  useEffect(() => { refresh() }, [activeId, refresh])

  // Debounced refresh on content change
  useEffect(() => {
    const buf = activeId ? getBuffer(activeId) : null
    if (!buf?.model) return
    let timer: ReturnType<typeof setTimeout>
    const disposable = buf.model.onDidChangeContent(() => {
      clearTimeout(timer)
      timer = setTimeout(refresh, 500)
    })
    return () => {
      clearTimeout(timer)
      disposable.dispose()
    }
  }, [activeId, getBuffer, refresh])

  const handleClick = useCallback((node: SymbolNode) => {
    const editor = editorRegistry.get()
    if (!editor) return
    editor.revealLineInCenter(node.range.startLineNumber)
    editor.setPosition({ lineNumber: node.range.startLineNumber, column: node.range.startColumn })
    editor.focus()
  }, [])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>Functions</span>
        <button className={styles.refreshBtn} onClick={refresh} title="Refresh">↻</button>
      </div>
      <div className={styles.list}>
        {symbols.length === 0 ? (
          <div className={styles.empty}>No symbols found.</div>
        ) : (
          symbols.map((s, i) => (
            <SymbolRow key={i} node={s} depth={0} onClick={handleClick} />
          ))
        )}
      </div>
    </div>
  )
}
