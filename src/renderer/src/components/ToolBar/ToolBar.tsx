import React from 'react'
import styles from './ToolBar.module.css'

interface ToolBarProps {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAll: () => void
  onFind: () => void
  onReplace: () => void
  onUndo: () => void
  onRedo: () => void
}

const Btn: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button className={styles.btn} title={title} onClick={onClick}>
    {children}
  </button>
)

const Sep = () => <div className={styles.sep} />

export const ToolBar: React.FC<ToolBarProps> = ({
  onNew, onOpen, onSave, onSaveAll, onFind, onReplace, onUndo, onRedo
}) => {
  return (
    <div className={styles.toolbar}>
      <Btn title="New (Ctrl+N)" onClick={onNew}>📄</Btn>
      <Btn title="Open (Ctrl+O)" onClick={onOpen}>📂</Btn>
      <Btn title="Save (Ctrl+S)" onClick={onSave}>💾</Btn>
      <Btn title="Save All (Ctrl+Alt+S)" onClick={onSaveAll}>🗂️</Btn>
      <Sep />
      <Btn title="Undo (Ctrl+Z)" onClick={onUndo}>↩️</Btn>
      <Btn title="Redo (Ctrl+Y)" onClick={onRedo}>↪️</Btn>
      <Sep />
      <Btn title="Find (Ctrl+F)" onClick={onFind}>🔍</Btn>
      <Btn title="Replace (Ctrl+H)" onClick={onReplace}>🔄</Btn>
    </div>
  )
}
