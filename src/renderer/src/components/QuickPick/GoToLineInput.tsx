import React, { useState, useRef, useEffect, useCallback } from 'react'

interface GoToLineInputProps {
  currentLine: number
  currentCol: number
  onGo: (line: number, column: number) => void
  onClose: () => void
}

export const GoToLineInput: React.FC<GoToLineInputProps> = ({
  currentLine,
  currentCol,
  onGo,
  onClose
}) => {
  const [value, setValue] = useState('')
  const [closing, setClosing] = useState(false)
  const pendingAction = useRef<(() => void) | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) {
      dismiss()
      return
    }
    // Support "line" or "line:column" format
    const parts = trimmed.split(':')
    const line = parseInt(parts[0], 10)
    const col = parts[1] ? parseInt(parts[1], 10) : 1
    if (isNaN(line) || line < 1) {
      dismiss()
      return
    }
    dismiss(() => onGo(line, isNaN(col) || col < 1 ? 1 : col))
  }, [value, onGo, dismiss])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
      }
    },
    [handleSubmit, dismiss]
  )

  const backdropAnim = closing
    ? 'animate-out fade-out-0 duration-100'
    : 'animate-in fade-in-0 duration-100'

  const dialogAnim = closing
    ? 'animate-out fade-out-0 duration-100'
    : 'animate-in fade-in-0 duration-100'

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 bottom-6 z-[9000] bg-black/30 ${backdropAnim}`}
        onClick={() => dismiss()}
        data-testid="gotoline-backdrop"
      />
      <div
        className={`fixed z-[9001] left-1/2 -translate-x-1/2 top-[60px] w-[min(400px,90vw)] bg-popover border border-border rounded-lg shadow-2xl flex flex-col ${dialogAnim}`}
        onAnimationEnd={handleAnimationEnd}
        data-testid="gotoline"
      >
        <div className="p-2">
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-input border border-border rounded px-2 py-1 text-sm text-popover-foreground outline-none focus:ring-1 focus:ring-ring"
            placeholder={`Go to Line:Column (current ${currentLine}:${currentCol})`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="gotoline-input"
          />
        </div>
        <div className="px-3 pb-2 text-xs text-muted-foreground">
          Type a line number or line:column to go to
        </div>
      </div>
    </>
  )
}
