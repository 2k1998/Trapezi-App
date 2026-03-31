import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let orderId: string | undefined

  try {
    const body: unknown = await request.json()
    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as Record<string, unknown>).orderId !== 'string'
    ) {
      return NextResponse.json({ success: false }, { status: 400 })
    }
    orderId = (body as { orderId: string }).orderId
  } catch {
    return NextResponse.json({ success: false }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ printed_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) {
    console.error('[mark-printed] Supabase error:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
