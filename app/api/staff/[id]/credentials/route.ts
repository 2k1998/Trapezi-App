import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(
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

  const { data, error } = await supabase
    .from('staff')
    .select('display_name, email, role')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  return NextResponse.json({
    name: data.display_name,
    email: data.email,
    role: data.role,
    recoverable: false,
    message: 'Credentials cannot be retrieved after creation. Use reset to generate new ones.',
  })
}
