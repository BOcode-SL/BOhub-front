import { toast } from '@/components/ui/toast'
import { apiErrorMessage } from '@/lib/api'

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  )
}

export function toastSuccess(title: string, description?: string): void {
  toast.add({
    title,
    description,
    type: 'success',
  })
}

/** `err` string → title; Error → `apiErrorMessage`; else `fallback` / genérico. AbortError → no-op. */
export function toastError(err: unknown, fallback?: string): void {
  if (isAbortError(err)) return
  const title =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? apiErrorMessage(err)
        : (fallback ?? apiErrorMessage(err))
  toast.add({ title, type: 'error' })
}
