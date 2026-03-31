'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export interface CartItem {
  menu_item_id: string
  name: string
  name_en: string
  type: 'food' | 'drink'
  price: number
  quantity: number
  notes?: string
}

function storageKey(slug: string, tableNumber: number | null): string {
  if (tableNumber === null) return ''
  return `cart_${slug}_${tableNumber}`
}

function readStorage(key: string): CartItem[] {
  if (typeof window === 'undefined' || !key) return []
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as CartItem[]
  } catch {
    return []
  }
}

function writeStorage(key: string, items: CartItem[]): void {
  if (typeof window === 'undefined' || !key) return
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // ignore quota / private mode
  }
}

export function useCart(slug: string, tableNumber: number | null) {
  const key = storageKey(slug, tableNumber)
  const [items, setItems] = useState<CartItem[]>(() =>
    readStorage(storageKey(slug, tableNumber))
  )

  useEffect(() => {
    if (!key) {
      setItems([])
      return
    }
    setItems(readStorage(key))
  }, [key])

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity'>) => {
      if (!key) return
      setItems(prev => {
        const idx = prev.findIndex(i => i.menu_item_id === item.menu_item_id)
        let next: CartItem[]
        if (idx >= 0) {
          next = [...prev]
          next[idx] = {
            ...next[idx],
            quantity: next[idx].quantity + 1,
          }
        } else {
          next = [...prev, { ...item, quantity: 1 }]
        }
        writeStorage(key, next)
        return next
      })
    },
    [key]
  )

  const removeItem = useCallback(
    (menu_item_id: string) => {
      if (!key) return
      setItems(prev => {
        const next = prev.filter(i => i.menu_item_id !== menu_item_id)
        writeStorage(key, next)
        return next
      })
    },
    [key]
  )

  const updateQuantity = useCallback(
    (menu_item_id: string, qty: number) => {
      if (!key) return
      if (qty <= 0) {
        removeItem(menu_item_id)
        return
      }
      setItems(prev => {
        const next = prev.map(i =>
          i.menu_item_id === menu_item_id ? { ...i, quantity: qty } : i
        )
        writeStorage(key, next)
        return next
      })
    },
    [key, removeItem]
  )

  const updateNotes = useCallback(
    (menu_item_id: string, notes: string) => {
      if (!key) return
      setItems(prev => {
        const next = prev.map(i =>
          i.menu_item_id === menu_item_id ? { ...i, notes } : i
        )
        writeStorage(key, next)
        return next
      })
    },
    [key]
  )

  const clearCart = useCallback(() => {
    if (!key) return
    try {
      localStorage.removeItem(key)
    } catch {
      /* empty */
    }
    setItems([])
  }, [key])

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.quantity, 0),
    [items]
  )

  const itemCount = useMemo(
    () => items.reduce((n, i) => n + i.quantity, 0),
    [items]
  )

  const hasItem = useCallback(
    (menu_item_id: string) => items.some(i => i.menu_item_id === menu_item_id),
    [items]
  )

  const getQuantity = useCallback(
    (menu_item_id: string) =>
      items.find(i => i.menu_item_id === menu_item_id)?.quantity ?? 0,
    [items]
  )

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    updateNotes,
    clearCart,
    subtotal,
    itemCount,
    hasItem,
    getQuantity,
  }
}
