import React, { useRef, useState, useCallback, useEffect } from 'react'
import { X, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../ui/context-menu'
import { useEditorStore } from '../../store/editorStore'
import { cn } from '../../lib/utils'

interface TabBarProps {
  onClose?: (id: string) => void
  onNewFile?: () => void
}

export const TabBar: React.FC<TabBarProps> = ({ onClose, onNewFile }) => {
  const { buffers, activeId, setActive } = useEditorStore()
  const dragRef = useRef<string | null>(null)
  const dragOverRef = useRef<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // --- Scroll logic ---
  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll)
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [buffers.length, checkScroll])

  // Scroll active tab into view
  useEffect(() => {
    if (!activeId || !scrollRef.current) return
    const tab = scrollRef.current.querySelector(`[data-tab-id="${activeId}"]`) as HTMLElement
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeId])

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) scrollRef.current.scrollLeft += e.deltaY
  }

  // --- Drag-reorder ---
  const handleDragStart = (id: string) => { dragRef.current = id }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    dragOverRef.current = id
  }

  const handleDrop = () => {
    const from = dragRef.current
    const to = dragOverRef.current
    if (!from || !to || from === to) return
    useEditorStore.setState((s) => {
      const bufs = [...s.buffers]
      const fromIdx = bufs.findIndex((b) => b.id === from)
      const toIdx = bufs.findIndex((b) => b.id === to)
      const [removed] = bufs.splice(fromIdx, 1)
      bufs.splice(toIdx, 0, removed)
      return { buffers: bufs }
    })
    dragRef.current = null
    dragOverRef.current = null
  }

  // --- Context menu actions ---
  const closeOthers = (id: string) => {
    buffers.filter((b) => b.id !== id).forEach((b) => onClose?.(b.id))
  }

  const closeAll = () => {
    buffers.forEach((b) => onClose?.(b.id))
  }

  const copyPath = (id: string) => {
    const buf = buffers.find((b) => b.id === id)
    if (buf?.filePath) navigator.clipboard.writeText(buf.filePath)
  }

  const revealInExplorer = (id: string) => {
    const buf = buffers.find((b) => b.id === id)
    if (buf?.filePath) window.api.file.reveal(buf.filePath)
  }

  if (buffers.length === 0) return null

  return (
    <div className="h-[34px] bg-tab-inactive border-b border-border flex items-stretch select-none shrink-0 relative" data-testid="tabbar">
      {/* Left scroll arrow */}
      {canScrollLeft && (
        <button
          className="absolute left-0 z-10 h-full px-1 bg-tab-inactive/90 backdrop-blur-sm border-r border-border text-tab-muted hover:text-tab-foreground transition-colors"
          onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
        >
          <ChevronLeft size={14} />
        </button>
      )}

      {/* Scrollable tab container */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-stretch overflow-x-hidden"
        onWheel={handleWheel}
      >
        {buffers.map((buf) => (
          <ContextMenu key={buf.id}>
            <ContextMenuTrigger asChild>
              <div
                data-tab-id={buf.id}
                data-tab-title={buf.title}
                data-tab-dirty={buf.isDirty ? 'true' : 'false'}
                data-testid={buf.id === activeId ? 'active-tab' : undefined}
                className={cn(
                  'group relative flex items-center gap-1.5 pl-3 pr-2 cursor-pointer text-[11px] min-w-0 shrink-0 transition-colors border-r border-border',
                  buf.id === activeId
                    ? 'bg-tab-active text-tab-foreground'
                    : 'bg-tab-inactive text-tab-muted hover:bg-tab-hover',
                  !buf.loaded && 'opacity-55',
                )}
                onClick={() => setActive(buf.id)}
                onAuxClick={(e) => { if (e.button === 1) onClose?.(buf.id) }}
                draggable
                onDragStart={() => handleDragStart(buf.id)}
                onDragOver={(e) => handleDragOver(e, buf.id)}
                onDrop={handleDrop}
                title={buf.filePath ?? buf.title}
              >
                {/* Active indicator — blue top line */}
                {buf.id === activeId && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
                )}

                {/* Tab title */}
                <span className={cn('truncate', buf.missing && 'line-through opacity-50')}>
                  {buf.title}
                </span>

                {/* Modified dot / Close button */}
                <span className="ml-1 w-4 h-4 flex items-center justify-center shrink-0">
                  {buf.isDirty && buf.id !== activeId ? (
                    <span className="w-2 h-2 rounded-full bg-tab-muted" />
                  ) : (
                    <button
                      className="opacity-0 group-hover:opacity-100 hover:bg-secondary rounded-sm transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onClose?.(buf.id) }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={() => onClose?.(buf.id)}>Close</ContextMenuItem>
              <ContextMenuItem onClick={() => closeOthers(buf.id)}>Close Others</ContextMenuItem>
              <ContextMenuItem onClick={() => closeAll()}>Close All</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => copyPath(buf.id)}>Copy File Path</ContextMenuItem>
              <ContextMenuItem onClick={() => revealInExplorer(buf.id)}>Reveal in Explorer</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      {/* Right scroll arrow */}
      {canScrollRight && (
        <button
          className="absolute right-[34px] z-10 h-full px-1 bg-tab-inactive/90 backdrop-blur-sm border-l border-border text-tab-muted hover:text-tab-foreground transition-colors"
          onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* New file button */}
      <button
        className="w-[34px] flex items-center justify-center text-tab-muted hover:text-tab-foreground hover:bg-tab-hover transition-colors shrink-0 border-l border-border"
        onClick={() => onNewFile?.()}
        title="New file"
        data-testid="tabbar-new-btn"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
