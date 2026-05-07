import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { translateMenuItem, type TranslationError } from '@/lib/menu/translate'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  let body: {
    restaurant_id?: string
    name_el?: string
    name_en?: string
    description_el?: string
    description_en?: string
    source_text?: string
    category_id?: string
    category?: string
    type?: string
    price?: number
    allergens?: string[]
    dietary?: string[]
    tags?: string[]
    is_available?: boolean
    is_featured?: boolean
    sort_order?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, source_text, ...fields } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }
  if (!fields.type || !['food', 'drink'].includes(fields.type)) {
    return NextResponse.json({ error: 'type must be food or drink' }, { status: 400 })
  }
  if (fields.price === undefined || Number(fields.price) < 0) {
    return NextResponse.json({ error: 'price is required and must be non-negative' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  let finalNameEl = fields.name_el ?? null
  let finalNameEn = fields.name_en ?? null
  let translationWarning: string | undefined

  // Auto-translate if source_text provided and at least one language is missing
  if (source_text && (!finalNameEl || !finalNameEn)) {
    try {
      const translated = await translateMenuItem(source_text)
      finalNameEl = finalNameEl ?? translated.el
      finalNameEn = finalNameEn ?? translated.en
    } catch (err) {
      const tErr = err as TranslationError
      if (tErr?.code === 'TRANSLATION_FAILED') {
        translationWarning = 'Translation failed — fill in name_el and name_en manually'
        finalNameEl = finalNameEl ?? source_text
        finalNameEn = finalNameEn ?? source_text
      }
    }
  }

  // Build name/description jsonb from flat fields for backward compatibility
  const nameFallback = finalNameEn ?? finalNameEl ?? ''
  const nameJsonb = { en: finalNameEn ?? nameFallback, el: finalNameEl ?? nameFallback }
  const descJsonb = {
    en: fields.description_en ?? '',
    el: fields.description_el ?? '',
  }

  const supabase = createServiceClient()
  const { data: item, error: itemError } = await supabase
    .from('menu_items')
    .insert({
      restaurant_id,
      name: nameJsonb,
      name_el: finalNameEl,
      name_en: finalNameEn,
      description: descJsonb,
      description_el: fields.description_el ?? null,
      description_en: fields.description_en ?? null,
      category: fields.category ?? 'Uncategorized',
      category_id: fields.category_id ?? null,
      type: fields.type,
      price: fields.price,
      allergens: fields.allergens ?? [],
      dietary: fields.dietary ?? [],
      tags: fields.tags ?? [],
      is_available: fields.is_available ?? true,
      is_featured: fields.is_featured ?? false,
      sort_order: fields.sort_order ?? 0,
    })
    .select()
    .single()

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })

  // Auto-assign to the default menu for this restaurant
  const { data: defaultMenu } = await supabase
    .from('menus')
    .select('id')
    .eq('restaurant_id', restaurant_id)
    .eq('is_default', true)
    .single()

  if (defaultMenu) {
    const { data: lastAssignment } = await supabase
      .from('menu_item_assignments')
      .select('display_order')
      .eq('menu_id', defaultMenu.id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = ((lastAssignment?.display_order as number | null) ?? 0) + 1

    await supabase.from('menu_item_assignments').insert({
      menu_id: defaultMenu.id,
      menu_item_id: item.id,
      available: true,
      display_order: nextOrder,
    })
  }

  return NextResponse.json(
    { ...item, ...(translationWarning ? { warning: translationWarning } : {}) },
    { status: 201 }
  )
}
