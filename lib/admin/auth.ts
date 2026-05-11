import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requireAdmin(_request: Request): Promise<{ userId: string } | Response> {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (!staffRow || staffRow.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 401 })
  }

  return { userId: session.user.id }
}
