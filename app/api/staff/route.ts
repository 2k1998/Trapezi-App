import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { generatePassword, generatePIN, hashPIN } from '@/lib/staff/credentials'
import type { StaffCredentials } from '@/lib/types/staff'
import { requirePlan } from '@/lib/plans/gates'
import type { Plan } from '@/lib/plans/gates'

export const runtime = 'nodejs'

const ALLOWED_ROLES = ['owner', 'manager', 'cashier'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('staff')
    .select('id, display_name, email, role, is_active, locked_until, failed_pin_attempts, created_at')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const members = (data ?? []).map(row => ({
    id: row.id,
    name: row.display_name,
    email: row.email,
    role: row.role,
    active: row.is_active,
    locked_until: row.locked_until ?? null,
    failed_pin_attempts: row.failed_pin_attempts ?? 0,
    created_at: row.created_at,
  }))

  return NextResponse.json(members)
}

export async function POST(request: NextRequest) {
  let body: { name?: string; email?: string; role?: string; restaurantId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, email, role, restaurantId } = body

  if (!name || !email || !role || !restaurantId) {
    return NextResponse.json({ error: 'name, email, role, and restaurantId are required' }, { status: 400 })
  }

  if (!ALLOWED_ROLES.includes(role as AllowedRole)) {
    return NextResponse.json({ error: 'role must be owner, manager, or cashier' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const supabase = createServiceClient()

  // Cashier and manager creation requires Pro plan; owners can always be created
  if (role === 'cashier' || role === 'manager') {
    const { data: restaurantRow } = await supabase
      .from('restaurants')
      .select('plan, subscription_status, dunning_day')
      .eq('id', restaurantId)
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
  }

  // Enforce one-per-restaurant limits for cashier and manager
  if (role === 'cashier' || role === 'manager') {
    const { count } = await supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('role', role)
      .is('deleted_at', null)

    if ((count ?? 0) >= 1) {
      const errorCode = role === 'cashier' ? 'CASHIER_LIMIT_REACHED' : 'MANAGER_LIMIT_REACHED'
      return NextResponse.json({ error: errorCode }, { status: 400 })
    }
  }

  const generatedPassword = generatePassword()
  const generatedPin = generatePIN()
  const pinHash = await hashPIN(generatedPin)

  // Create Supabase Auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Failed to create auth user' }, { status: 500 })
  }

  const userId = authUser.user.id

  const { error: insertError } = await supabase.from('staff').insert({
    id: userId,
    restaurant_id: restaurantId,
    display_name: name,
    email,
    role,
    is_active: true,
    pin_hash: pinHash,
  })

  if (insertError) {
    // Rollback auth user creation on DB failure
    await supabase.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const credentials: StaffCredentials = {
    staff_id: userId,
    name,
    email,
    role,
    generated_password: generatedPassword,
    generated_pin: generatedPin,
  }

  return NextResponse.json(credentials, { status: 201 })
}
