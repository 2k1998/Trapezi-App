import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'

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
    .from('happy_hour_rules')
    .select('*, happy_hour_item_assignments(menu_item_id)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten item assignments into a simple array of IDs
  const result = (data ?? []).map(rule => ({
    ...rule,
    items: (rule.happy_hour_item_assignments ?? []).map(
      (a: { menu_item_id: string }) => a.menu_item_id
    ),
    happy_hour_item_assignments: undefined,
  }))

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
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

  const {
    restaurant_id,
    label_el,
    label_en,
    discount_type,
    discount_value,
    day_of_week,
    start_time,
    end_time,
    item_ids,
  } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }
  if (!discount_type || !['percentage', 'fixed'].includes(discount_type)) {
    return NextResponse.json({ error: 'discount_type must be percentage or fixed' }, { status: 400 })
  }
  if (discount_value === undefined || Number(discount_value) < 0) {
    return NextResponse.json({ error: 'discount_value is required and must be non-negative' }, { status: 400 })
  }
  if (!Array.isArray(day_of_week) || day_of_week.length === 0) {
    return NextResponse.json({ error: 'day_of_week must be a non-empty array of 0–6' }, { status: 400 })
  }
  if (!start_time || !end_time) {
    return NextResponse.json({ error: 'start_time and end_time are required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: rule, error: ruleError } = await supabase
    .from('happy_hour_rules')
    .insert({
      restaurant_id,
      label_el: label_el ?? null,
      label_en: label_en ?? null,
      discount_type,
      discount_value,
      day_of_week,
      start_time,
      end_time,
    })
    .select()
    .single()

  if (ruleError) return NextResponse.json({ error: ruleError.message }, { status: 500 })

  // Insert item assignments
  if (Array.isArray(item_ids) && item_ids.length > 0) {
    const assignments = item_ids.map(mid => ({ rule_id: rule.id, menu_item_id: mid }))
    const { error: assignError } = await supabase
      .from('happy_hour_item_assignments')
      .insert(assignments)
    if (assignError) {
      return NextResponse.json({ error: assignError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ...rule, items: item_ids ?? [] }, { status: 201 })
}
