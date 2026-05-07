'use client'

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 font-medium text-red-700 underline hover:text-red-900"
      >
        Dismiss
      </button>
    </div>
  )
}

export function WarningBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-accent-500/40 bg-brand-100 px-4 py-3 text-sm text-brand-800">
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 font-medium text-brand-700 underline hover:text-brand-900"
      >
        Dismiss
      </button>
    </div>
  )
}
