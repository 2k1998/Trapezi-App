import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { generatePIN, hashPIN } from '@/lib/staff/credentials'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { restaurantId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurantId } = body
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

  const newPin = generatePIN()
  const pinHash = await hashPIN(newPin)

  const { error } = await supabase
    .from('staff')
    .update({ pin_hash: pinHash, failed_pin_attempts: 0, locked_until: null })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ generated_pin: newPin })
}
