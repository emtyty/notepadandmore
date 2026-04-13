import { useEffect } from 'react'
import { toast } from '../components/ui/sonner'
import { useUpdateStore } from '../store/updateStore'

/**
 * Subscribes to auto-update events from the main process and drives:
 *   - updateStore status transitions
 *   - sonner toast notifications (manual checks get verbose feedback;
 *     silent startup checks suppress "no update found" and error toasts)
 *   - "Restart now" action toast when the update is downloaded
 */
export function useUpdateEvents(): void {
  const { setStatus, setVersion, setProgress, setError } = useUpdateStore()

  useEffect(() => {
    const CHECKING_TOAST_ID = 'update-checking'
    const DOWNLOADED_TOAST_ID = 'update-downloaded'

    window.api.on('update:checking', (...args) => {
      const { manual } = (args[0] ?? {}) as { manual?: boolean }
      setStatus('checking')
      setError(null)
      if (manual) {
        toast.info('Checking for updates…', { id: CHECKING_TOAST_ID })
      }
    })

    window.api.on('update:available', (...args) => {
      const { version } = (args[0] ?? {}) as { version?: string; manual?: boolean }
      setStatus('available')
      setVersion(version ?? null)
      toast.dismiss(CHECKING_TOAST_ID)
      toast.info(version ? `Update ${version} available — downloading…` : 'Update available — downloading…')
    })

    window.api.on('update:not-available', (...args) => {
      const { manual } = (args[0] ?? {}) as { manual?: boolean }
      setStatus('idle')
      toast.dismiss(CHECKING_TOAST_ID)
      if (manual) {
        toast.success("You're up to date")
      }
    })

    window.api.on('update:downloading', (...args) => {
      const { percent } = (args[0] ?? {}) as { percent?: number }
      setStatus('downloading')
      if (typeof percent === 'number') setProgress(percent)
    })

    window.api.on('update:downloaded', (...args) => {
      const { version } = (args[0] ?? {}) as { version?: string }
      setStatus('downloaded')
      setVersion(version ?? null)
      toast.success(version ? `Update ${version} ready to install` : 'Update ready to install', {
        id: DOWNLOADED_TOAST_ID,
        duration: Infinity,
        action: {
          label: 'Restart now',
          onClick: () => {
            void window.api.update.install()
          }
        }
      })
    })

    window.api.on('update:error', (...args) => {
      const { message, manual } = (args[0] ?? {}) as { message?: string; manual?: boolean }
      setStatus('error')
      setError(message ?? 'Unknown update error')
      toast.dismiss(CHECKING_TOAST_ID)
      if (manual) {
        toast.error(message ? `Update error: ${message}` : 'Update check failed')
      }
    })

    return () => {
      window.api.off('update:checking')
      window.api.off('update:available')
      window.api.off('update:not-available')
      window.api.off('update:downloading')
      window.api.off('update:downloaded')
      window.api.off('update:error')
    }
  }, [setStatus, setVersion, setProgress, setError])
}
