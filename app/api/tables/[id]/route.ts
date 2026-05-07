import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: {
    number?: number
    name?: string
    capacity?: number
    section_id?: string | null
    restaurantId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurantId, ...fields } = body
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('tables')
    .select('id, table_number')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!existing) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

  // Validate number uniqueness if changing
  if (fields.number !== undefined && fields.number !== existing.table_number) {
    const { count } = await supabase
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('table_number', fields.number)
      .neq('id', id)
      .is('deleted_at', null)

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'TABLE_NUMBER_EXISTS' }, { status: 400 })
    }
  }

  const updates: Record<string, unknown> = {}
  if (fields.number !== undefined) updates.table_number = fields.number
  if (fields.name !== undefined) updates.name = fields.name
  if (fields.capacity !== undefined) updates.capacity = fields.capacity
  if ('section_id' in fields) updates.section_id = fields.section_id ?? null

  const { error } = await supabase.from('tables').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('tables')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!existing) return NextResponse.json({ error: 'Table not found' }, { status: 404 })

  // Block deletion if open orders exist
  const { count: openCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', id)
    .neq('status', 'closed')

  if ((openCount ?? 0) > 0) {
    return NextResponse.json({ error: 'TABLE_HAS_OPEN_TAB' }, { status: 400 })
  }

  const { error } = await supabase
    .from('tables')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
