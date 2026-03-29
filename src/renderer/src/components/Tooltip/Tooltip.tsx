import React, { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import styles from './Tooltip.module.css'

interface TooltipProps {
  text: string
  children: React.ReactElement
  side?: 'top' | 'bottom' | 'right'
}

export const Tooltip: React.FC<TooltipProps> = ({ text, children, side = 'bottom' }) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let x: number
    let y: number
    if (side === 'right') {
      x = rect.right + 8
      y = rect.top + rect.height / 2
    } else if (side === 'top') {
      x = rect.left + rect.width / 2
      y = rect.top - 8
    } else {
      x = rect.left + rect.width / 2
      y = rect.bottom + 8
    }
    timerRef.current = setTimeout(() => setPos({ x, y }), 300)
  }, [side])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPos(null)
  }, [])

  const child = React.cloneElement(children, {
    onMouseEnter: (e: React.MouseEvent) => {
      show(e)
      children.props.onMouseEnter?.(e)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      hide()
      children.props.onMouseLeave?.(e)
    },
  })

  return (
    <>
      {child}
      {pos &&
        createPortal(
          <div
            className={styles.tooltip}
            style={{
              left: side === 'right' ? pos.x : pos.x,
              top: pos.y,
              transform:
                side === 'right'
                  ? 'translateY(-50%)'
                  : side === 'top'
                  ? 'translateX(-50%) translateY(-100%)'
                  : 'translateX(-50%)',
            }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  )
}
