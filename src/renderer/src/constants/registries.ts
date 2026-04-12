import type { EOLType } from '../store/editorStore'

// ── Encoding Registry ────────────────────────────────────────────────────────

export interface EncodingEntry {
  value: string
  label: string
}

export const ENCODINGS: EncodingEntry[] = [
  { value: 'UTF-8', label: 'UTF-8' },
  { value: 'UTF-8 BOM', label: 'UTF-8 with BOM' },
  { value: 'UTF-16 LE', label: 'UTF-16 LE' },
  { value: 'UTF-16 BE', label: 'UTF-16 BE' },
  { value: 'windows-1252', label: 'Windows-1252 (Latin)' },
  { value: 'ISO-8859-1', label: 'ISO-8859-1 (Latin-1)' }
]

const encodingMap = new Map(ENCODINGS.map((e) => [e.value, e.label]))

export function getEncodingLabel(value: string): string {
  return encodingMap.get(value) ?? value
}

// ── Language Registry ────────────────────────────────────────────────────────

export interface LanguageEntry {
  value: string
  label: string
}

export const LANGUAGES: LanguageEntry[] = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'csharp', label: 'C#' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell Script' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'yaml', label: 'YAML' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' }
]

const languageMap = new Map(LANGUAGES.map((l) => [l.value, l.label]))

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function getLanguageLabel(value: string): string {
  return languageMap.get(value) ?? titleCase(value)
}

// ── EOL Registry ─────────────────────────────────────────────────────────────

export interface EOLEntry {
  value: EOLType
  label: string
  short: string
}

export const EOLS: EOLEntry[] = [
  { value: 'LF', label: 'LF (Unix)', short: 'LF' },
  { value: 'CRLF', label: 'CRLF (Windows)', short: 'CRLF' },
  { value: 'CR', label: 'CR (Classic Mac)', short: 'CR' }
]

const eolMap = new Map(EOLS.map((e) => [e.value, e.short]))

export function getEOLShort(value: string): string {
  return eolMap.get(value as EOLType) ?? value
}
