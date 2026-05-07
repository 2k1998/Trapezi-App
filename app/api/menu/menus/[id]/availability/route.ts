import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

// Cashier OR owner can toggle item availability within a menu
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: menuId } = await params

  let body: { restaurant_id?: string; menu_item_id?: string; available?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, menu_item_id, available } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }
  if (!menu_item_id) {
    return NextResponse.json({ error: 'menu_item_id is required' }, { status: 400 })
  }
  if (typeof available !== 'boolean') {
    return NextResponse.json({ error: 'available must be a boolean' }, { status: 400 })
  }

  // Allow cashier or owner (not requireOwner)
  const auth = await requireStaff(restaurant_id)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  // Enforce: only cashier or owner may call this
  if (auth.session.role !== 'cashier' && auth.session.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceClient()

  // Verify menu belongs to this restaurant
  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('id', menuId)
    .eq('restaurant_id', restaurant_id)
    .single()

  if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('menu_item_assignments')
    .update({ available })
    .eq('menu_id', menuId)
    .eq('menu_item_id', menu_item_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })

  return NextResponse.json(data)
}
