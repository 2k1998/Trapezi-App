import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'

export const runtime = 'nodejs'

const MAX_UPSELLS_PER_ITEM = 2

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('upsell_suggestions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('item_id')
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  let body: {
    restaurant_id?: string
    item_id?: string
    suggested_item_id?: string
    display_order?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, item_id, suggested_item_id, display_order } = body

  if (!restaurant_id || !item_id || !suggested_item_id) {
    return NextResponse.json(
      { error: 'restaurant_id, item_id, and suggested_item_id are required' },
      { status: 400 }
    )
  }
  if (item_id === suggested_item_id) {
    return NextResponse.json({ error: 'item_id and suggested_item_id must differ' }, { status: 400 })
  }
  if (display_order !== undefined && ![1, 2].includes(display_order)) {
    return NextResponse.json({ error: 'display_order must be 1 or 2' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Guard: max 2 suggestions per item_id
  const { count } = await supabase
    .from('upsell_suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', item_id)
    .eq('restaurant_id', restaurant_id)

  if ((count ?? 0) >= MAX_UPSELLS_PER_ITEM) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_UPSELLS_PER_ITEM} upsell suggestions per item` },
      { status: 422 }
    )
  }

  // Resolve display_order if not provided
  const resolvedOrder = display_order ?? ((count ?? 0) + 1)

  const { data, error } = await supabase
    .from('upsell_suggestions')
    .insert({ restaurant_id, item_id, suggested_item_id, display_order: resolvedOrder })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This upsell suggestion already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  let body: { restaurant_id?: string; id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, id } = body

  if (!restaurant_id || !id) {
    return NextResponse.json({ error: 'restaurant_id and id are required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('upsell_suggestions')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
