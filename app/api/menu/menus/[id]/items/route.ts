import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: menuId } = await params
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('id', menuId)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('menu_item_assignments')
    .select('*')
    .eq('menu_id', menuId)
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: menuId } = await params

  let body: { restaurant_id?: string; menu_item_id?: string; display_order?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, menu_item_id, display_order } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }
  if (!menu_item_id) {
    return NextResponse.json({ error: 'menu_item_id is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Verify menu belongs to restaurant
  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('id', menuId)
    .eq('restaurant_id', restaurant_id)
    .single()

  if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 })

  // Verify item belongs to restaurant and is not deleted
  const { data: item } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', menu_item_id)
    .eq('restaurant_id', restaurant_id)
    .is('deleted_at', null)
    .single()

  if (!item) return NextResponse.json({ error: 'Menu item not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('menu_item_assignments')
    .insert({ menu_id: menuId, menu_item_id, available: true, display_order: display_order ?? 0 })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Item is already assigned to this menu' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id: menuId } = await params

  let body: { restaurant_id?: string; menu_item_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, menu_item_id } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }
  if (!menu_item_id) {
    return NextResponse.json({ error: 'menu_item_id is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('id', menuId)
    .eq('restaurant_id', restaurant_id)
    .single()

  if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 })

  const { error } = await supabase
    .from('menu_item_assignments')
    .delete()
    .eq('menu_id', menuId)
    .eq('menu_item_id', menu_item_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
