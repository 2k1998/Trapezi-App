import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { name?: string; display_order?: number; restaurantId?: string }
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
    .from('sections')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (fields.name !== undefined) updates.name = fields.name
  if (fields.display_order !== undefined) updates.display_order = fields.display_order

  const { error } = await supabase.from('sections').update(updates).eq('id', id)
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
    .from('sections')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  // Null out section_id on all tables in this section before deleting
  await supabase.from('tables').update({ section_id: null }).eq('section_id', id)

  const { error } = await supabase.from('sections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
