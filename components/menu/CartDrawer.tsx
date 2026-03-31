'use client'

import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { CartItem } from '@/lib/hooks/useCart'
import { formatMoney } from '@/lib/formatMoney'

const drawerVariants = {
  hidden: { x: '100%', opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 30 },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.2, ease: 'easeIn' as const },
  },
}

type Props = {
  slug: string
  tableNumber: number
  currency: string
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  subtotal: number
  updateQuantity: (menu_item_id: string, qty: number) => void
  updateNotes: (menu_item_id: string, notes: string) => void
}

export function CartDrawer({
  slug,
  tableNumber,
  currency,
  isOpen,
  onClose,
  items,
  subtotal,
  updateQuantity,
  updateNotes,
}: Props) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  const subtotalLabel = formatMoney(subtotal, currency)

  const goCheckout = () => {
    onClose()
    router.push(`/${slug}/checkout?table=${tableNumber}`)
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <motion.button
            type="button"
            aria-label="Close overlay"
            className="absolute inset-0 bg-black/40"
            initial={reduceMotion ? { opacity: 0.4 } : { opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {reduceMotion ? (
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="cart-drawer-title"
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-elevated min-h-0"
            >
              <DrawerContent
                items={items}
                currency={currency}
                subtotalLabel={subtotalLabel}
                updateQuantity={updateQuantity}
                updateNotes={updateNotes}
                goCheckout={goCheckout}
                onClose={onClose}
              />
            </aside>
          ) : (
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="cart-drawer-title"
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-elevated min-h-0"
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <DrawerContent
                items={items}
                currency={currency}
                subtotalLabel={subtotalLabel}
                updateQuantity={updateQuantity}
                updateNotes={updateNotes}
                goCheckout={goCheckout}
                onClose={onClose}
              />
            </motion.aside>
          )}
        </div>
      ) : null}
    </AnimatePresence>
  )
}

function DrawerContent({
  items,
  currency,
  subtotalLabel,
  updateQuantity,
  updateNotes,
  goCheckout,
  onClose,
}: {
  items: CartItem[]
  currency: string
  subtotalLabel: string
  updateQuantity: (id: string, qty: number) => void
  updateNotes: (id: string, notes: string) => void
  goCheckout: () => void
  onClose: () => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <>
      <header className="flex items-center justify-between border-b border-brand-200 p-4">
        <h2 id="cart-drawer-title" className="text-lg font-medium text-brand-900">
          Your order
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-brand-600 hover:bg-brand-100"
          aria-label="Close cart"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-brand-500">
            <BagIcon className="h-12 w-12 opacity-40" />
            <p className="text-sm">
              Nothing here yet — tap + on any item to add it
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {items.map(item => (
              <motion.div
                key={item.menu_item_id}
                layout
                initial={
                  reduceMotion ? false : { opacity: 0, height: 0 }
                }
                animate={{ opacity: 1, height: 'auto' }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        opacity: 0,
                        height: 0,
                        transition: { duration: 0.25 },
                      }
                }
                className="mb-3 overflow-hidden rounded-lg border border-brand-100 bg-brand-50/50 p-3 last:mb-0"
              >
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-brand-900">{item.name}</p>
                    <input
                      type="text"
                      placeholder="Any notes?"
                      value={item.notes ?? ''}
                      onChange={e =>
                        updateNotes(item.menu_item_id, e.target.value)
                      }
                      className="mt-1 w-full rounded-md border-none bg-brand-50 px-2 py-1.5 text-base text-brand-800 placeholder:text-brand-400"
                    />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex h-9 items-center gap-2 rounded-lg bg-white px-1 shadow-sm">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center text-brand-800"
                        onClick={() =>
                          updateQuantity(
                            item.menu_item_id,
                            item.quantity - 1
                          )
                        }
                        aria-label="Decrease"
                      >
                        −
                      </button>
                      <span className="min-w-[1rem] text-center text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center text-brand-800"
                        onClick={() =>
                          updateQuantity(
                            item.menu_item_id,
                            item.quantity + 1
                          )
                        }
                        aria-label="Increase"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-medium text-brand-800">
                      {formatMoney(item.price * item.quantity, currency)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <footer className="border-t border-brand-200 bg-white p-4">
        <div className="mb-4 flex justify-between text-brand-900">
          <span>Subtotal</span>
          <span className="font-medium tabular-nums">{subtotalLabel}</span>
        </div>
        <button
          type="button"
          disabled={items.length === 0}
          onClick={goCheckout}
          className="w-full rounded-xl bg-brand-800 py-4 text-base font-medium text-white disabled:opacity-50"
        >
          {items.length === 0 ? 'Add items to order' : 'Place Order'}
        </button>
      </footer>
    </>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </svg>
  )
}
