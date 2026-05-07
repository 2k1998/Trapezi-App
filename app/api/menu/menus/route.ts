import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { requirePlan } from '@/lib/plans/gates'
import type { Plan } from '@/lib/plans/gates'

export const runtime = 'nodejs'

const MAX_MENUS_PER_RESTAURANT = 10

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('menus')
    .select('*, menu_schedules(*)')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  let body: {
    restaurant_id?: string
    name_el?: string
    name_en?: string
    is_default?: boolean
    display_order?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, name_el, name_en, is_default, display_order } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }
  if (!name_el || !name_en) {
    return NextResponse.json({ error: 'name_el and name_en are required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Creating additional menus requires Pro plan
  const { data: restaurantRow } = await supabase
    .from('restaurants')
    .select('plan, subscription_status, dunning_day')
    .eq('id', restaurant_id)
    .single()

  try {
    requirePlan(
      (restaurantRow?.plan ?? 'free') as Plan,
      (restaurantRow?.subscription_status ?? 'active') as string,
      (restaurantRow?.dunning_day ?? 0) as number,
      'pro'
    )
  } catch {
    return NextResponse.json({ error: 'plan_required', required: 'pro' }, { status: 403 })
  }

  // Guard: max 10 menus per restaurant
  const { count } = await supabase
    .from('menus')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurant_id)

  if ((count ?? 0) >= MAX_MENUS_PER_RESTAURANT) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_MENUS_PER_RESTAURANT} menus per restaurant` },
      { status: 422 }
    )
  }

  const { data, error } = await supabase
    .from('menus')
    .insert({
      restaurant_id,
      name_el,
      name_en,
      is_default: is_default ?? false,
      display_order: display_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
