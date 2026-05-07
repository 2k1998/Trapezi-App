import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('tables')
    .select('id, restaurant_id, table_number, name, capacity, section_id, status, deleted_at, sections(name)')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('table_number', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []).map(row => ({
    id: row.id,
    restaurant_id: row.restaurant_id,
    number: row.table_number,
    name: row.name ?? null,
    capacity: row.capacity ?? null,
    section_id: row.section_id ?? null,
    section_name: row.sections
      ? (Array.isArray(row.sections) ? (row.sections[0] as { name: string })?.name : (row.sections as unknown as { name: string }).name) ?? null
      : null,
    status: row.status,
    deleted_at: row.deleted_at ?? null,
  }))

  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  let body: {
    number?: number
    name?: string
    capacity?: number
    section_id?: string
    restaurantId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { number, name, capacity, section_id, restaurantId } = body
  if (!restaurantId || number === undefined) {
    return NextResponse.json({ error: 'restaurantId and number are required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Validate uniqueness
  const { count } = await supabase
    .from('tables')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('table_number', number)
    .is('deleted_at', null)

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'TABLE_NUMBER_EXISTS' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tables')
    .insert({
      restaurant_id: restaurantId,
      table_number: number,
      name: name ?? null,
      capacity: capacity ?? null,
      section_id: section_id ?? null,
      status: 'available',
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    {
      id: data.id,
      restaurant_id: data.restaurant_id,
      number: data.table_number,
      name: data.name ?? null,
      capacity: data.capacity ?? null,
      section_id: data.section_id ?? null,
      status: data.status,
      deleted_at: null,
    },
    { status: 201 }
  )
}
