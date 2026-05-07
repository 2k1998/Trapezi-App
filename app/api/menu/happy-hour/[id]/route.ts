import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params

  let body: {
    restaurant_id?: string
    label_el?: string
    label_en?: string
    discount_type?: string
    discount_value?: number
    day_of_week?: number[]
    start_time?: string
    end_time?: string
    item_ids?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, item_ids, ...fields } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Verify rule belongs to this restaurant
  const { data: existing } = await supabase
    .from('happy_hour_rules')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurant_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (fields.label_el !== undefined) updates.label_el = fields.label_el
  if (fields.label_en !== undefined) updates.label_en = fields.label_en
  if (fields.discount_type !== undefined) updates.discount_type = fields.discount_type
  if (fields.discount_value !== undefined) updates.discount_value = fields.discount_value
  if (fields.day_of_week !== undefined) updates.day_of_week = fields.day_of_week
  if (fields.start_time !== undefined) updates.start_time = fields.start_time
  if (fields.end_time !== undefined) updates.end_time = fields.end_time

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from('happy_hour_rules')
      .update(updates)
      .eq('id', id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Replace item assignments if provided
  if (Array.isArray(item_ids)) {
    await supabase.from('happy_hour_item_assignments').delete().eq('rule_id', id)

    if (item_ids.length > 0) {
      const assignments = item_ids.map(mid => ({ rule_id: id, menu_item_id: mid }))
      const { error: insertError } = await supabase
        .from('happy_hour_item_assignments')
        .insert(assignments)
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  const { data: rule, error: fetchError } = await supabase
    .from('happy_hour_rules')
    .select('*, happy_hour_item_assignments(menu_item_id)')
    .eq('id', id)
    .single()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  return NextResponse.json({
    ...rule,
    items: (rule.happy_hour_item_assignments ?? []).map(
      (a: { menu_item_id: string }) => a.menu_item_id
    ),
    happy_hour_item_assignments: undefined,
  })
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
    .from('happy_hour_rules')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })

  // Cascade deletes assignments via FK ON DELETE CASCADE
  const { error } = await supabase.from('happy_hour_rules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
