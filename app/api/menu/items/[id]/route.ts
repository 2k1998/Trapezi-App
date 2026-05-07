import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { translateMenuItem, type TranslationError } from '@/lib/menu/translate'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params

  let body: {
    restaurant_id?: string
    name_el?: string
    name_en?: string
    description_el?: string
    description_en?: string
    category?: string
    category_id?: string
    price?: number
    allergens?: string[]
    dietary?: string[]
    tags?: string[]
    is_available?: boolean
    is_featured?: boolean
    sort_order?: number
    image_url?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, ...fields } = body
  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Verify item belongs to this restaurant and is not deleted
  const { data: existing } = await supabase
    .from('menu_items')
    .select('id, name_el, name_en, description_el, description_en, name, description, image_url')
    .eq('id', id)
    .eq('restaurant_id', restaurant_id)
    .is('deleted_at', null)
    .single()

  if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (fields.image_url !== undefined) {
    if (fields.image_url === null && existing.image_url) {
      const url = existing.image_url as string
      const marker = '/menu-images/'
      const idx = url.indexOf(marker)
      if (idx !== -1) {
        const oldPath = url.slice(idx + marker.length)
        await supabase.storage.from('menu-images').remove([oldPath])
      }
    }
    updates.image_url = fields.image_url
  }

  // Handle name fields
  let newNameEl = fields.name_el
  let newNameEn = fields.name_en

  const nameChanged = newNameEl !== undefined || newNameEn !== undefined
  if (nameChanged) {
    // Re-translate missing side if only one language updated
    if (newNameEl && !newNameEn) {
      try {
        const t = await translateMenuItem(newNameEl)
        newNameEn = t.en
      } catch (err) {
        const tErr = err as TranslationError
        if (tErr?.code === 'TRANSLATION_FAILED') {
          newNameEn = existing.name_en ?? newNameEl
        }
      }
    } else if (newNameEn && !newNameEl) {
      try {
        const t = await translateMenuItem(newNameEn)
        newNameEl = t.el
      } catch (err) {
        const tErr = err as TranslationError
        if (tErr?.code === 'TRANSLATION_FAILED') {
          newNameEl = existing.name_el ?? newNameEn
        }
      }
    }

    if (newNameEl !== undefined) updates.name_el = newNameEl
    if (newNameEn !== undefined) updates.name_en = newNameEn

    // Keep jsonb name in sync
    const mergedName = {
      ...(existing.name as Record<string, string>),
      ...(newNameEl ? { el: newNameEl } : {}),
      ...(newNameEn ? { en: newNameEn } : {}),
    }
    updates.name = mergedName
  }

  // Handle description fields
  let newDescEl = fields.description_el
  let newDescEn = fields.description_en

  const descChanged = newDescEl !== undefined || newDescEn !== undefined
  if (descChanged) {
    if (newDescEl && !newDescEn) {
      try {
        const t = await translateMenuItem(newDescEl)
        newDescEn = t.en
      } catch {
        newDescEn = existing.description_en ?? newDescEl
      }
    } else if (newDescEn && !newDescEl) {
      try {
        const t = await translateMenuItem(newDescEn)
        newDescEl = t.el
      } catch {
        newDescEl = existing.description_el ?? newDescEn
      }
    }

    if (newDescEl !== undefined) updates.description_el = newDescEl
    if (newDescEn !== undefined) updates.description_en = newDescEn

    const mergedDesc = {
      ...(existing.description as Record<string, string>),
      ...(newDescEl ? { el: newDescEl } : {}),
      ...(newDescEn ? { en: newDescEn } : {}),
    }
    updates.description = mergedDesc
  }

  // Scalar fields
  if (fields.category !== undefined) updates.category = fields.category
  if (fields.category_id !== undefined) updates.category_id = fields.category_id
  if (fields.price !== undefined) updates.price = fields.price
  if (fields.allergens !== undefined) updates.allergens = fields.allergens
  if (fields.dietary !== undefined) updates.dietary = fields.dietary
  if (fields.tags !== undefined) updates.tags = fields.tags
  if (fields.is_available !== undefined) updates.is_available = fields.is_available
  if (fields.is_featured !== undefined) updates.is_featured = fields.is_featured
  if (fields.sort_order !== undefined) updates.sort_order = fields.sort_order

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!existing) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // Soft delete — never hard delete
  const { error } = await supabase
    .from('menu_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
