import { create } from 'zustand'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

interface UpdateState {
  status: UpdateStatus
  version: string | null
  progressPercent: number
  error: string | null

  setStatus: (status: UpdateStatus) => void
  setVersion: (version: string | null) => void
  setProgress: (percent: number) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: 'idle',
  version: null,
  progressPercent: 0,
  error: null,

  setStatus: (status) => set({ status }),
  setVersion: (version) => set({ version }),
  setProgress: (percent) => set({ progressPercent: percent }),
  setError: (error) => set({ error }),
  reset: () =>
    set({ status: 'idle', version: null, progressPercent: 0, error: null })
}))
