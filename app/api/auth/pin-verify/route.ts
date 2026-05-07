import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyPIN } from '@/lib/staff/credentials'
import { PIN_LOCK_FAILURE_LIMIT, PIN_LOCK_DURATION_MINUTES } from '@/lib/inactivity/config'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: { staffId?: string; pin?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { staffId, pin } = body
  if (!staffId || !pin) {
    return NextResponse.json({ error: 'staffId and pin are required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, role, is_active, pin_hash, failed_pin_attempts, locked_until, deleted_at')
    .eq('id', staffId)
    .single()

  if (error || !staff) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  if (staff.deleted_at || !staff.is_active) {
    return NextResponse.json({ error: 'Account inactive' }, { status: 403 })
  }

  // Check lock
  if (staff.locked_until && new Date(staff.locked_until) > new Date()) {
    return NextResponse.json(
      { error: 'ACCOUNT_LOCKED', locked_until: staff.locked_until },
      { status: 423 }
    )
  }

  if (!staff.pin_hash) {
    return NextResponse.json({ error: 'No PIN set for this account' }, { status: 400 })
  }

  const valid = await verifyPIN(pin, staff.pin_hash)

  if (valid) {
    await supabase
      .from('staff')
      .update({ failed_pin_attempts: 0, locked_until: null })
      .eq('id', staffId)

    return NextResponse.json({ valid: true, role: staff.role })
  }

  // Increment failure count
  const newAttempts = (staff.failed_pin_attempts ?? 0) + 1
  const updates: Record<string, unknown> = { failed_pin_attempts: newAttempts }

  if (newAttempts >= PIN_LOCK_FAILURE_LIMIT) {
    const lockedUntil = new Date(Date.now() + PIN_LOCK_DURATION_MINUTES * 60 * 1000).toISOString()
    updates.locked_until = lockedUntil
  }

  await supabase.from('staff').update(updates).eq('id', staffId)

  const attemptsRemaining = Math.max(0, PIN_LOCK_FAILURE_LIMIT - newAttempts)
  return NextResponse.json({ valid: false, attempts_remaining: attemptsRemaining })
}
