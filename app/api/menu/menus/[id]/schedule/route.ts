import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { requirePlan } from '@/lib/plans/gates'
import type { Plan } from '@/lib/plans/gates'

export const runtime = 'nodejs'

type ScheduleInput = {
  day_of_week: number
  start_time: string
  end_time: string
}

type Params = { params: Promise<{ id: string }> }

// PUT replaces all schedules for this menu
export async function PUT(request: NextRequest, { params }: Params) {
  const { id: menuId } = await params

  let body: { restaurant_id?: string; schedules?: ScheduleInput[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, schedules } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }
  if (!Array.isArray(schedules)) {
    return NextResponse.json({ error: 'schedules must be an array' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Scheduling requires Pro plan
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

  // Verify menu belongs to this restaurant
  const { data: menu } = await supabase
    .from('menus')
    .select('id')
    .eq('id', menuId)
    .eq('restaurant_id', restaurant_id)
    .single()

  if (!menu) return NextResponse.json({ error: 'Menu not found' }, { status: 404 })

  // Validate schedule entries
  for (const s of schedules) {
    if (typeof s.day_of_week !== 'number' || s.day_of_week < 0 || s.day_of_week > 6) {
      return NextResponse.json({ error: 'day_of_week must be 0–6' }, { status: 400 })
    }
    if (!s.start_time || !s.end_time) {
      return NextResponse.json({ error: 'start_time and end_time are required' }, { status: 400 })
    }
  }

  // Replace: delete existing then insert new
  const { error: deleteError } = await supabase
    .from('menu_schedules')
    .delete()
    .eq('menu_id', menuId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (schedules.length > 0) {
    const toInsert = schedules.map(s => ({
      menu_id: menuId,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    }))

    const { data, error: insertError } = await supabase
      .from('menu_schedules')
      .insert(toInsert)
      .select()

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json([])
}
