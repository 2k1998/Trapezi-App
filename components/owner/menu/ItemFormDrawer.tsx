'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { ALLERGEN_OPTIONS, DIETARY_OPTIONS } from '@/components/owner/constants'
import { apiSendJson, apiPostForm } from '@/lib/menu/client-api'
import type { Category, MenuItemAdmin } from './types'

type TranslateRes = { el: string | null; en: string | null; warning?: string }

type Props = {
  open: boolean
  item: MenuItemAdmin | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
  onTranslationWarning: (msg: string) => void
}

function categoryLabel(c: Category): string {
  return c.name_el || c.name_en
}

function currencySymbolFor(code: string): string {
  try {
    return (
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code.toUpperCase(),
      })
        .formatToParts(0)
        .find(p => p.type === 'currency')?.value ?? '€'
    )
  } catch {
    return '€'
  }
}

export function ItemFormDrawer({
  open,
  item,
  categories,
  onClose,
  onSaved,
  onTranslationWarning,
}: Props) {
  const { restaurantId, currency: currencyCode } = useOwnerRestaurant()
  const currencySymbol = currencySymbolFor(currencyCode)

  const [primaryName, setPrimaryName] = useState('')
  const [nameEl, setNameEl] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [manualName, setManualName] = useState(false)

  const [primaryDesc, setPrimaryDesc] = useState('')
  const [descEl, setDescEl] = useState('')
  const [descEn, setDescEn] = useState('')
  const [manualDesc, setManualDesc] = useState(false)

  const [price, setPrice] = useState('')
  const [type, setType] = useState<'food' | 'drink'>('food')
  const [categoryId, setCategoryId] = useState<string>('')
  const [allergens, setAllergens] = useState<string[]>([])
  const [dietary, setDietary] = useState<string[]>([])

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const resetFromItem = useCallback(
    (row: MenuItemAdmin | null) => {
      if (!row) {
        setPrimaryName('')
        setNameEl('')
        setNameEn('')
        setManualName(false)
        setPrimaryDesc('')
        setDescEl('')
        setDescEn('')
        setManualDesc(false)
        setPrice('')
        setType('food')
        setCategoryId('')
        setAllergens([])
        setDietary([])
        setImageFile(null)
        setImagePreview(null)
        setRemoveImage(false)
        setExistingImageUrl(null)
        return
      }
      const pn = row.name_el || row.name_en || ''
      setPrimaryName(pn)
      setNameEl(row.name_el ?? '')
      setNameEn(row.name_en ?? '')
      setManualName(false)
      setPrimaryDesc(row.description_el || row.description_en || '')
      setDescEl(row.description_el ?? '')
      setDescEn(row.description_en ?? '')
      setManualDesc(false)
      setPrice(String(row.price))
      setType(row.type)
      setCategoryId(row.category_id ?? '')
      setAllergens(row.allergens ?? [])
      setDietary(row.dietary ?? [])
      setImageFile(null)
      setImagePreview(null)
      setRemoveImage(false)
      setExistingImageUrl(row.image_url)
    },
    []
  )

  useEffect(() => {
    if (open) {
      resetFromItem(item)
      setLocalError(null)
    }
  }, [open, item, resetFromItem])

  useEffect(() => {
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const toggleAllergen = (v: string) => {
    setAllergens(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]))
  }

  const toggleDietary = (v: string) => {
    setDietary(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f && f.type.startsWith('image/')) {
      setImageFile(f)
      setRemoveImage(false)
    }
  }

  const save = async () => {
    setLocalError(null)
    const p = parseFloat(price.replace(',', '.'))
    if (!Number.isFinite(p) || p < 0) {
      setLocalError('Enter a valid price')
      return
    }

    setSaving(true)
    try {
      let finalNameEl = nameEl.trim()
      let finalNameEn = nameEn.trim()
      if (!manualName && primaryName.trim()) {
        const tr = await apiSendJson<TranslateRes>('/api/menu/translate', 'POST', {
          text: primaryName.trim(),
        })
        if (tr && (tr.warning || (tr.el == null && tr.en == null))) {
          onTranslationWarning(
            'Auto-translation failed. Please add the translation manually.'
          )
          finalNameEl = primaryName.trim()
          finalNameEn = primaryName.trim()
        } else if (tr) {
          finalNameEl = (tr.el ?? primaryName).trim()
          finalNameEn = (tr.en ?? primaryName).trim()
          setNameEl(finalNameEl)
          setNameEn(finalNameEn)
        }
      } else {
        finalNameEl = nameEl.trim()
        finalNameEn = nameEn.trim()
      }

      if (!finalNameEl && !finalNameEn) {
        setLocalError('Name is required')
        setSaving(false)
        return
      }

      let finalDescEl = descEl
      let finalDescEn = descEn
      if (!manualDesc && primaryDesc.trim()) {
        const trd = await apiSendJson<TranslateRes>('/api/menu/translate', 'POST', {
          text: primaryDesc.trim(),
        })
        if (trd && (trd.warning || (trd.el == null && trd.en == null))) {
          onTranslationWarning(
            'Auto-translation failed. Please add the description translation manually.'
          )
          finalDescEl = primaryDesc.trim()
          finalDescEn = primaryDesc.trim()
        } else if (trd) {
          finalDescEl = (trd.el ?? primaryDesc).trim()
          finalDescEn = (trd.en ?? primaryDesc).trim()
          setDescEl(finalDescEl)
          setDescEn(finalDescEn)
        }
      }

      const cat =
        categoryId === ''
          ? { category_id: null as string | null, category: 'Uncategorized' }
          : (() => {
              const c = categories.find(x => x.id === categoryId)
              return {
                category_id: categoryId,
                category: c ? categoryLabel(c) : 'Uncategorized',
              }
            })()

      const payload = {
        restaurant_id: restaurantId,
        name_el: finalNameEl || finalNameEn,
        name_en: finalNameEn || finalNameEl,
        description_el: finalDescEl || '',
        description_en: finalDescEn || '',
        price: p,
        type,
        category_id: cat.category_id,
        category: cat.category,
        allergens,
        dietary,
      }

      let itemId: string

      if (item) {
        itemId = item.id
        await apiSendJson(`/api/menu/items/${item.id}`, 'PATCH', payload)
        if (removeImage && !imageFile) {
          await apiSendJson(`/api/menu/items/${item.id}`, 'PATCH', {
            restaurant_id: restaurantId,
            image_url: null,
          })
        }
      } else {
        const created = await apiSendJson<MenuItemAdmin>('/api/menu/items', 'POST', payload)
        if (!created?.id) throw new Error('Create failed')
        itemId = created.id
      }

      if (imageFile) {
        const fd = new FormData()
        fd.set('file', imageFile)
        await apiPostForm(
          `/api/menu/items/${itemId}/image?restaurantId=${encodeURIComponent(restaurantId)}`,
          fd
        )
      }

      onSaved()
      onClose()
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const showImage = imagePreview || (existingImageUrl && !removeImage)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 bg-brand-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-drawer-title"
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-brand-200 bg-white shadow-elevated"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          >
            <div className="flex items-center justify-between border-b border-brand-200 px-4 py-3">
              <h2 id="item-drawer-title" className="font-display text-lg font-semibold text-brand-900">
                {item ? 'Edit item' : 'Add item'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-brand-600 hover:bg-brand-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {localError && (
                <p className="mb-3 text-sm text-red-600" role="alert">
                  {localError}
                </p>
              )}

              <label className="mb-1 block text-sm font-medium text-brand-700">Name</label>
              <input
                type="text"
                value={primaryName}
                onChange={e => setPrimaryName(e.target.value)}
                disabled={manualName}
                className="mb-3 w-full rounded-lg border border-brand-200 px-3 py-2 text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:bg-brand-100"
              />

              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-brand-500">Auto-translated</span>
                <button
                  type="button"
                  onClick={() => setManualName(m => !m)}
                  className="text-sm text-accent-600 hover:text-accent-500"
                  aria-label={manualName ? 'Use single name field' : 'Edit translations manually'}
                >
                  ✏️
                </button>
              </div>
              {manualName ? (
                <div className="mb-4 space-y-2">
                  <input
                    type="text"
                    placeholder="Greek (el)"
                    value={nameEl}
                    onChange={e => setNameEl(e.target.value)}
                    className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="English (en)"
                    value={nameEn}
                    onChange={e => setNameEn(e.target.value)}
                    className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-500">
                  <div>EL: {nameEl || '—'}</div>
                  <div>EN: {nameEn || '—'}</div>
                  <p className="mt-1 text-xs text-brand-400">Saved translations appear after save.</p>
                </div>
              )}

              <label className="mb-1 block text-sm font-medium text-brand-700">Description</label>
              <textarea
                value={primaryDesc}
                onChange={e => setPrimaryDesc(e.target.value)}
                disabled={manualDesc}
                rows={3}
                className="mb-3 w-full rounded-lg border border-brand-200 px-3 py-2 text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:bg-brand-100"
              />
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm text-brand-500">Auto-translated</span>
                <button
                  type="button"
                  onClick={() => setManualDesc(m => !m)}
                  className="text-sm text-accent-600 hover:text-accent-500"
                  aria-label="Edit description translations"
                >
                  ✏️
                </button>
              </div>
              {manualDesc ? (
                <div className="mb-4 space-y-2">
                  <textarea
                    placeholder="Greek (el)"
                    value={descEl}
                    onChange={e => setDescEl(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm"
                  />
                  <textarea
                    placeholder="English (en)"
                    value={descEn}
                    onChange={e => setDescEn(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-brand-200 px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <div className="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-500">
                  <div>EL: {descEl || '—'}</div>
                  <div>EN: {descEn || '—'}</div>
                </div>
              )}

              <label className="mb-1 block text-sm font-medium text-brand-700">Price</label>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-brand-600">{currencySymbol}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full rounded-lg border border-brand-200 px-3 py-2"
                />
              </div>

              <div className="mb-4">
                <span className="mb-2 block text-sm font-medium text-brand-700">Type</span>
                <div className="flex gap-2">
                  {(['food', 'drink'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                        type === t
                          ? 'bg-brand-800 text-white'
                          : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mb-1 block text-sm font-medium text-brand-700">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="mb-4 w-full rounded-lg border border-brand-200 px-3 py-2"
              >
                <option value="">Uncategorized</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>

              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium text-brand-700">Allergens</legend>
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map(a => (
                    <label key={a.value} className="flex items-center gap-1 text-sm text-brand-700">
                      <input
                        type="checkbox"
                        checked={allergens.includes(a.value)}
                        onChange={() => toggleAllergen(a.value)}
                      />
                      {a.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium text-brand-700">Dietary</legend>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_OPTIONS.map(d => (
                    <label key={d.value} className="flex items-center gap-1 text-sm text-brand-700">
                      <input
                        type="checkbox"
                        checked={dietary.includes(d.value)}
                        onChange={() => toggleDietary(d.value)}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="mb-2 block text-sm font-medium text-brand-700">Image</label>
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                className="mb-2 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50 px-4 py-8 text-center text-sm text-brand-600"
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  id="item-image-input"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setImageFile(f)
                      setRemoveImage(false)
                    }
                  }}
                />
                <label htmlFor="item-image-input" className="cursor-pointer text-accent-600 underline">
                  Choose file
                </label>
                <span className="text-brand-500"> or drag and drop</span>
              </div>
              {showImage && (
                <div className="mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview || existingImageUrl || ''}
                    alt=""
                    className="h-32 w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null)
                      setImagePreview(null)
                      setRemoveImage(true)
                    }}
                    className="mt-2 text-sm text-red-600 underline"
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-brand-200 p-4">
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="w-full rounded-lg bg-brand-800 py-2.5 font-medium text-white hover:bg-brand-900 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
