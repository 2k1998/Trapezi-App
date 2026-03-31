'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CartDrawer } from './CartDrawer'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MenuItemCard, type MenuItemRow } from './MenuItemCard'
import { useCart } from '@/lib/hooks/useCart'
import { formatMoney } from '@/lib/formatMoney'

export type RestaurantPublic = {
  id: string
  name: string
  slug: string
  plan: string
  languages: string[]
  default_language: string
  accent_color: string | null
  logo_url: string | null
  currency: string
}

export type GroupedMenuItems = { category: string; items: MenuItemRow[] }[]

type Props = {
  restaurant: RestaurantPublic
  groupedItems: GroupedMenuItems
  tableNumber: number | null
  tableError: boolean
}

function TableErrorQR() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-brand-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center text-brand-600">
          <QrIcon />
        </div>
        <h1 className="font-display text-2xl text-brand-900">
          Scan the QR code on your table
        </h1>
        <p className="mt-3 text-sm text-brand-500">
          Make sure you scan the code on your specific table
        </p>
      </div>
    </div>
  )
}

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-14 w-14">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h6v2h-6z" />
    </svg>
  )
}

export function MenuClient({
  restaurant,
  groupedItems,
  tableNumber,
  tableError,
}: Props) {
  const slug = restaurant.slug
  const [lang, setLang] = useState(restaurant.default_language)
  const [cartOpen, setCartOpen] = useState(false)
  const [activeCat, setActiveCat] = useState(0)
  const [fabReady, setFabReady] = useState(false)
  const [mounted, setMounted] = useState(false)
  const reduceMotion = useReducedMotion()

  const cart = useCart(slug, tableError ? null : tableNumber)

  const {
    addItem,
    updateQuantity,
    getQuantity,
    items,
    subtotal,
    itemCount,
    updateNotes,
  } = cart

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`lang_${slug}`)
      if (stored && restaurant.languages.includes(stored)) {
        setLang(stored)
        return
      }
    } catch {
      /* empty */
    }
    const nav =
      typeof navigator !== 'undefined'
        ? navigator.language.split('-')[0] ?? 'en'
        : 'en'
    if (restaurant.languages.includes(nav)) {
      setLang(nav)
      return
    }
    setLang(restaurant.default_language)
  }, [slug, restaurant])

  const scrollSpy = useCallback(() => {
    const offset = 120
    const y = window.scrollY + offset
    let current = 0
    groupedItems.forEach((_, i) => {
      const el = document.getElementById(`section-cat-${i}`)
      if (el && el.offsetTop <= y) current = i
    })
    setActiveCat(current)
  }, [groupedItems])

  useEffect(() => {
    if (tableError) return
    window.addEventListener('scroll', scrollSpy, { passive: true })
    scrollSpy()
    return () => window.removeEventListener('scroll', scrollSpy)
  }, [scrollSpy, tableError])

  useEffect(() => {
    if (tableError) return
    const id = requestAnimationFrame(() => setFabReady(true))
    return () => cancelAnimationFrame(id)
  }, [tableError])

  const containerVariants = {
    hidden: {},
    visible: {
      transition: reduceMotion ? {} : { staggerChildren: 0.04 },
    },
  }

  const itemVariants = reduceMotion
    ? {
        hidden: { opacity: 1, y: 0 },
        visible: { opacity: 1, y: 0, transition: { duration: 0 } },
      }
    : {
        hidden: { opacity: 0, y: 16 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: 'easeOut' as const },
        },
      }

  if (tableError) {
    return <TableErrorQR />
  }

  const tn = tableNumber as number
  const subtotalLabel = formatMoney(subtotal, restaurant.currency)

  const scrollToCat = (index: number) => {
    document
      .getElementById(`section-cat-${index}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-brand-200 bg-brand-50/90 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt=""
              className="h-10 w-auto max-w-[140px] object-contain"
            />
          ) : (
            <span className="truncate font-display text-lg text-brand-900">
              {restaurant.name}
            </span>
          )}
        </div>
        <LanguageSwitcher
          slug={slug}
          languages={restaurant.languages}
          lang={lang}
          onLangChange={setLang}
        />
      </header>

      <nav
        className="sticky top-16 z-20 border-b border-brand-100 bg-brand-50/95 backdrop-blur-sm animate-slide-right"
        aria-label="Categories"
      >
        <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {groupedItems.map((g, i) => (
            <button
              key={g.category}
              type="button"
              onClick={() => scrollToCat(i)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCat === i
                  ? 'bg-accent-400 text-white'
                  : 'bg-brand-100 text-brand-600 hover:bg-brand-200'
              }`}
            >
              {g.category}
            </button>
          ))}
        </div>
      </nav>

      <main className="px-4">
        {groupedItems.map((group, gi) => (
          <section
            key={`${group.category}-${gi}`}
            id={`section-cat-${gi}`}
            className="scroll-mt-32"
          >
            <h2 className="mb-4 mt-8 font-display text-xl text-brand-900">
              {group.category}
            </h2>
            <motion.div
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              variants={containerVariants}
              initial={reduceMotion ? false : 'hidden'}
              animate="visible"
            >
              {group.items.map(item => (
                <motion.div key={item.id} variants={itemVariants}>
                  <MenuItemCard
                    item={item}
                    lang={lang}
                    currency={restaurant.currency}
                    addItem={addItem}
                    updateQuantity={updateQuantity}
                    getQuantity={getQuantity}
                  />
                </motion.div>
              ))}
            </motion.div>
          </section>
        ))}
      </main>

      {mounted && itemCount > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className={`fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-2xl bg-brand-800 px-5 py-4 text-white shadow-elevated transition-opacity ${
            fabReady ? 'animate-scale-in opacity-100' : 'opacity-0'
          }`}
        >
          <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-accent-400 px-2 text-sm font-semibold text-brand-900">
            {itemCount}
          </span>
          <span className="text-sm font-medium tabular-nums">{subtotalLabel}</span>
        </button>
      )}

      <CartDrawer
        slug={slug}
        tableNumber={tn}
        currency={restaurant.currency}
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={items}
        subtotal={subtotal}
        updateQuantity={updateQuantity}
        updateNotes={updateNotes}
      />
    </div>
  )
}
