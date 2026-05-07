import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params

  let body: {
    restaurant_id?: string
    name_el?: string
    name_en?: string
    display_order?: number
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

  const { data: existing } = await supabase
    .from('menus')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurant_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Menu not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (fields.name_el !== undefined) updates.name_el = fields.name_el
  if (fields.name_en !== undefined) updates.name_en = fields.name_en
  if (fields.display_order !== undefined) updates.display_order = fields.display_order

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('menus')
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
    .from('menus')
    .select('id, is_default')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Menu not found' }, { status: 404 })

  if (existing.is_default) {
    return NextResponse.json({ error: 'Cannot delete the default menu' }, { status: 400 })
  }

  const { error } = await supabase.from('menus').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
