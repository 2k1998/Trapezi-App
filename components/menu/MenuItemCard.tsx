'use client'

import { useEffect, useState } from 'react'
import type { CartItem } from '@/lib/hooks/useCart'
import { formatMoney } from '@/lib/formatMoney'
import { pickLocalized } from '@/lib/i18n/pickLocalized'

export type MenuItemRow = {
  id: string
  name: Record<string, string>
  description: Record<string, string> | null
  category: string
  type: 'food' | 'drink'
  price: number
  image_url: string | null
  is_featured: boolean
}

type Props = {
  item: MenuItemRow
  lang: string
  currency: string
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  updateQuantity: (menu_item_id: string, qty: number) => void
  getQuantity: (menu_item_id: string) => number
}

export function MenuItemCard({
  item,
  lang,
  currency,
  addItem,
  updateQuantity,
  getQuantity,
}: Props) {
  const qty = getQuantity(item.id)
  const name = pickLocalized(item.name, lang)
  const desc = pickLocalized(item.description ?? undefined, lang)
  const nameEn = pickLocalized(item.name, 'en')
  const priceLabel = formatMoney(item.price, currency)

  const body = (
    <>
      {item.is_featured ? (
        <span className="mb-1 inline-block text-xs text-accent-400">Chef&apos;s pick</span>
      ) : null}
      <span className="font-display text-lg text-brand-900">{name}</span>
      {desc ? (
        <p className="text-sm text-brand-500 line-clamp-2">{desc}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-medium text-brand-800">{priceLabel}</span>
        <QtyOrAdd
          qty={qty}
          onAdd={() =>
            addItem({
              menu_item_id: item.id,
              name,
              name_en: nameEn,
              type: item.type,
              price: item.price,
            })
          }
          onDelta={d => updateQuantity(item.id, qty + d)}
        />
      </div>
    </>
  )

  return (
    <div
      className={`overflow-hidden rounded-xl ${
        item.image_url ? 'bg-white shadow-card' : 'bg-brand-100'
      } ${item.is_featured ? 'border-l-2 border-accent-400' : ''}`}
    >
      {item.image_url ? (
        <>
          <img
            src={item.image_url}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover rounded-t-xl"
          />
          <div className="flex flex-col gap-1 p-4">{body}</div>
        </>
      ) : (
        <div className="flex flex-col gap-1 p-4">{body}</div>
      )}
    </div>
  )
}

function QtyOrAdd({
  qty,
  onAdd,
  onDelta,
}: {
  qty: number
  onAdd: () => void
  onDelta: (d: number) => void
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Until the component has mounted on the client, always render
  // the non-interactive "Add" button so the server and client
  // initial renders match and avoid hydration mismatches.
  if (!mounted) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white"
      >
        Add
      </button>
    )
  }

  if (qty <= 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white"
      >
        Add
      </button>
    )
  }

  return (
    <div className="flex h-9 items-center gap-3 rounded-lg bg-brand-100 px-2">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-medium text-brand-800"
        onClick={() => onDelta(-1)}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-sm font-medium tabular-nums">
        {qty}
      </span>
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-medium text-brand-800"
        onClick={() => onDelta(1)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}
