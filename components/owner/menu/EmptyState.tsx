'use client'

export function EmptyState({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string
  hint: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-300 bg-white px-8 py-16 text-center shadow-card">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl text-brand-400" aria-hidden>
        ◇
      </div>
      <p className="font-display text-lg font-semibold text-brand-900">{title}</p>
      <p className="mt-2 max-w-md text-sm text-brand-600">{hint}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
