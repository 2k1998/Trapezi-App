import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ALLOWED_ROLES = ['owner', 'manager', 'cashier'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { name?: string; email?: string; role?: string; active?: boolean; restaurantId?: string }
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

  // Load current staff row to validate ownership and get current state
  const { data: existing, error: fetchError } = await supabase
    .from('staff')
    .select('id, role, is_active, restaurant_id')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  // Validate role change: enforce limits
  if (fields.role && fields.role !== existing.role) {
    if (!ALLOWED_ROLES.includes(fields.role as AllowedRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (fields.role === 'cashier' || fields.role === 'manager') {
      const { count } = await supabase
        .from('staff')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('role', fields.role)
        .neq('id', id)
        .is('deleted_at', null)

      if ((count ?? 0) >= 1) {
        const errorCode = fields.role === 'cashier' ? 'CASHIER_LIMIT_REACHED' : 'MANAGER_LIMIT_REACHED'
        return NextResponse.json({ error: errorCode }, { status: 400 })
      }
    }
  }

  const updates: Record<string, unknown> = {}
  if (fields.name !== undefined) updates.display_name = fields.name
  if (fields.email !== undefined) updates.email = fields.email
  if (fields.role !== undefined) updates.role = fields.role
  if (fields.active !== undefined) updates.is_active = fields.active

  const { error: updateError } = await supabase
    .from('staff')
    .update(updates)
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Invalidate sessions when deactivating
  if (fields.active === false && existing.is_active === true) {
    await supabase.auth.admin.signOut(id, 'global')
  }

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
    .from('staff')
    .select('id')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!existing) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  const { error } = await supabase
    .from('staff')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Invalidate all sessions for the deleted user
  await supabase.auth.admin.signOut(id, 'global')

  return NextResponse.json({ success: true })
}
