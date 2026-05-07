import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params

  let body: { restaurant_id?: string; name_el?: string; name_en?: string; display_order?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, ...updates } = body
  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Verify category belongs to this restaurant
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurant_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

  const allowed: Record<string, unknown> = {}
  if (updates.name_el !== undefined) allowed.name_el = updates.name_el
  if (updates.name_en !== undefined) allowed.name_en = updates.name_en
  if (updates.display_order !== undefined) allowed.display_order = updates.display_order

  const { data, error } = await supabase
    .from('categories')
    .update(allowed)
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

  // Verify category belongs to this restaurant
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

  // Unlink items before deleting the category
  await supabase.from('menu_items').update({ category_id: null }).eq('category_id', id)

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
