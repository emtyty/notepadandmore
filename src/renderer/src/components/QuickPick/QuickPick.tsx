import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Check } from 'lucide-react'

export interface QuickPickItem {
  value: string
  label: string
  description?: string
}

export interface QuickPickProps {
  items: QuickPickItem[]
  activeValue: string | null
  placeholder?: string
  onSelect: (value: string) => void
  onClose: () => void
}

export const QuickPick: React.FC<QuickPickProps> = ({
  items,
  activeValue,
  placeholder = 'Type to filter...',
  onSelect,
  onClose
}) => {
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [closing, setClosing] = useState(false)
  const pendingAction = useRef<(() => void) | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query) return items
    const q = query.toLowerCase()
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [items, query])

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [filtered])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const el = list.children[highlightedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex])

  const dismiss = useCallback(
    (action?: () => void) => {
      if (closing) return
      pendingAction.current = action ?? null
      setClosing(true)
    },
    [closing]
  )

  const handleAnimationEnd = useCallback(() => {
    if (!closing) return
    pendingAction.current?.()
    onClose()
  }, [closing, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((i) => (i + 1) % filtered.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((i) => (i - 1 + filtered.length) % filtered.length)
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[highlightedIndex]) {
            const value = filtered[highlightedIndex].value
            dismiss(() => onSelect(value))
          }
          break
        case 'Escape':
          e.preventDefault()
          dismiss()
          break
      }
    },
    [filtered, highlightedIndex, onSelect, dismiss]
  )

  const backdropAnim = closing
    ? 'animate-out fade-out-0 duration-100'
    : 'animate-in fade-in-0 duration-100'

  const dialogAnim = closing
    ? 'animate-out fade-out-0 duration-100'
    : 'animate-in fade-in-0 duration-100'

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed top-0 left-0 right-0 bottom-6 z-[9000] bg-black/30 ${backdropAnim}`}
        onClick={() => dismiss()}
        data-testid="quickpick-backdrop"
      />

      {/* Dialog */}
      <div
        className={`fixed z-[9001] left-1/2 -translate-x-1/2 top-[60px] w-[min(400px,90vw)] bg-popover border border-border rounded-lg shadow-2xl flex flex-col ${dialogAnim}`}
        onKeyDown={handleKeyDown}
        onAnimationEnd={handleAnimationEnd}
        data-testid="quickpick"
      >
        {/* Search input */}
        <div className="p-2 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-input border border-border rounded px-2 py-1 text-sm text-popover-foreground outline-none focus:ring-1 focus:ring-ring"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="quickpick-input"
          />
        </div>

        {/* List */}
        <div
          ref={listRef}
          className="max-h-[300px] overflow-y-auto py-1"
          data-testid="quickpick-list"
        >
          {filtered.length === 0 ? (
            <div
              className="px-3 py-2 text-sm text-muted-foreground text-center"
              data-testid="quickpick-empty"
            >
              No matching items
            </div>
          ) : (
            filtered.map((item, index) => {
              const isActive = item.value === activeValue
              const isHighlighted = index === highlightedIndex
              return (
                <div
                  key={item.value}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer ${
                    isHighlighted
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-popover-foreground hover:bg-secondary/50'
                  }`}
                  onClick={() => {
                    const value = item.value
                    dismiss(() => onSelect(value))
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  data-testid="quickpick-item"
                >
                  <span className="w-4 shrink-0">
                    {isActive && <Check size={14} />}
                  </span>
                  <span>{item.label}</span>
                  {item.description && (
                    <span className="text-muted-foreground ml-auto text-xs">
                      {item.description}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
