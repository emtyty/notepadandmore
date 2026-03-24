import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useEditorRef } from '../../context/EditorContext'
import { useFindReplace } from '../../hooks/useFindReplace'
import styles from './FindReplace.module.css'

export const FindReplace: React.FC = () => {
  const { showFindReplace, findReplaceMode, openFind, closeFind } = useUIStore()
  const editorRef = useEditorRef()
  const { matches, currentIndex, totalCount, findAll, findNext, findPrev, replaceCurrent, replaceAll, close } = useFindReplace(editorRef)

  const [searchText, setSearchText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [isRegex, setIsRegex] = useState(false)
  const [wrapAround, setWrapAround] = useState(true)

  // Find in Files state
  const [fifDirectory, setFifDirectory] = useState('')
  const [fifFilter, setFifFilter] = useState('*.*')

  const searchInputRef = useRef<HTMLInputElement>(null)
  const mode = findReplaceMode

  // Focus search input when opening
  useEffect(() => {
    if (showFindReplace) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [showFindReplace, mode])

  // Re-search on option change
  useEffect(() => {
    if (showFindReplace && searchText) {
      findAll(searchText, { matchCase, wholeWord, isRegex, wrapAround })
    }
  }, [matchCase, wholeWord, isRegex]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(() => {
    if (searchText) {
      findAll(searchText, { matchCase, wholeWord, isRegex, wrapAround })
    }
  }, [searchText, matchCase, wholeWord, isRegex, wrapAround, findAll])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchText(val)
    if (val) {
      findAll(val, { matchCase, wholeWord, isRegex, wrapAround })
    } else {
      findAll('', { matchCase, wholeWord, isRegex, wrapAround })
    }
  }, [matchCase, wholeWord, isRegex, wrapAround, findAll])

  const handleClose = useCallback(() => {
    close()
    closeFind()
  }, [close, closeFind])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (totalCount > 0) findNext()
      else handleSearch()
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      findPrev()
    }
  }, [handleClose, handleSearch, findNext, findPrev, totalCount])

  const handleReplace = useCallback(() => {
    replaceCurrent(replaceText)
  }, [replaceCurrent, replaceText])

  const handleReplaceAll = useCallback(() => {
    const count = replaceAll(searchText, replaceText, { matchCase, wholeWord, isRegex, wrapAround })
    if (count > 0) {
      useUIStore.getState().addToast(`Replaced ${count} occurrence${count !== 1 ? 's' : ''}`)
    }
  }, [replaceAll, searchText, replaceText, matchCase, wholeWord, isRegex, wrapAround])

  const handleFindInFiles = useCallback(async () => {
    if (!searchText || !fifDirectory) return
    try {
      const results = await window.api.invoke('search:find-in-files', {
        searchText,
        directory: fifDirectory,
        fileFilter: fifFilter,
        matchCase,
        wholeWord,
        isRegex
      })
      // Dispatch results to store
      useUIStore.getState().setFindResults(results)
      useUIStore.getState().setShowFindResults(true)
    } catch {
      useUIStore.getState().addToast('Find in Files failed', 'error')
    }
  }, [searchText, fifDirectory, fifFilter, matchCase, wholeWord, isRegex])

  const handleBrowseDir = useCallback(async () => {
    // Trigger native folder dialog via main process
    try {
      const result = await window.api.invoke('dialog:open-folder')
      if (result) setFifDirectory(result)
    } catch {
      // fallback: user can type path
    }
  }, [])

  if (!showFindReplace) return null

  const statusText = searchText
    ? totalCount > 0
      ? `${currentIndex + 1} of ${totalCount}`
      : 'No matches'
    : ''

  return (
    <div className={styles.container} onKeyDown={handleKeyDown}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'find' ? styles.tabActive : ''}`}
            onClick={() => openFind('find')}
          >
            Find
          </button>
          <button
            className={`${styles.tab} ${mode === 'replace' ? styles.tabActive : ''}`}
            onClick={() => openFind('replace')}
          >
            Replace
          </button>
          <button
            className={`${styles.tab} ${mode === 'findInFiles' ? styles.tabActive : ''}`}
            onClick={() => openFind('findInFiles')}
          >
            Find in Files
          </button>
        </div>
        <button className={styles.closeBtn} onClick={handleClose} title="Close (Escape)">
          ×
        </button>
      </div>

      {/* Search row */}
      <div className={styles.row}>
        <input
          ref={searchInputRef}
          className={styles.input}
          type="text"
          placeholder="Find..."
          value={searchText}
          onChange={handleSearchChange}
        />
        <button className={styles.btn} onClick={() => { handleSearch(); findNext() }}>
          Find Next
        </button>
        <button className={styles.btn} onClick={findPrev}>
          Find Prev
        </button>
      </div>

      {/* Options row */}
      <div className={styles.row}>
        <div className={styles.options}>
          <button
            className={`${styles.toggle} ${matchCase ? styles.toggleActive : ''}`}
            onClick={() => setMatchCase(!matchCase)}
            title="Match Case"
          >
            Aa
          </button>
          <button
            className={`${styles.toggle} ${wholeWord ? styles.toggleActive : ''}`}
            onClick={() => setWholeWord(!wholeWord)}
            title="Whole Word"
          >
            Ab
          </button>
          <button
            className={`${styles.toggle} ${isRegex ? styles.toggleActive : ''}`}
            onClick={() => setIsRegex(!isRegex)}
            title="Regular Expression"
          >
            .*
          </button>
          <button
            className={`${styles.toggle} ${wrapAround ? styles.toggleActive : ''}`}
            onClick={() => setWrapAround(!wrapAround)}
            title="Wrap Around"
          >
            ↻
          </button>
        </div>
        <span className={styles.status}>{statusText}</span>
      </div>

      {/* Replace row */}
      {mode === 'replace' && (
        <div className={styles.row}>
          <input
            className={styles.input}
            type="text"
            placeholder="Replace with..."
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleReplace()
              }
            }}
          />
          <button className={styles.btn} onClick={handleReplace}>
            Replace
          </button>
          <button className={styles.btn} onClick={handleReplaceAll}>
            Replace All
          </button>
        </div>
      )}

      {/* Find in Files rows */}
      {mode === 'findInFiles' && (
        <>
          <div className={styles.fifRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="Directory..."
              value={fifDirectory}
              onChange={(e) => setFifDirectory(e.target.value)}
            />
            <button className={styles.btn} onClick={handleBrowseDir}>
              Browse
            </button>
          </div>
          <div className={styles.fifRow}>
            <input
              className={styles.input}
              type="text"
              placeholder="File filter (e.g. *.ts, *.js)"
              value={fifFilter}
              onChange={(e) => setFifFilter(e.target.value)}
            />
            <button className={styles.btn} onClick={handleFindInFiles}>
              Find All
            </button>
          </div>
        </>
      )}
    </div>
  )
}
