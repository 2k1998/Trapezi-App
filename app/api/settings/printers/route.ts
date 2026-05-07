import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'
import type { PrinterSettings } from '@/lib/types/staff'

export const runtime = 'nodejs'

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

function isValidIPv4(ip: string): boolean {
  if (!IPV4_REGEX.test(ip)) return false
  return ip.split('.').every(octet => {
    const n = parseInt(octet, 10)
    return n >= 0 && n <= 255
  })
}

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('metadata')
    .eq('id', restaurantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const printers: PrinterSettings = (data.metadata as Record<string, unknown>)?.printers as PrinterSettings ?? {
    kitchen: null,
    bar: null,
    cashier: null,
  }

  return NextResponse.json(printers)
}

export async function PATCH(request: NextRequest) {
  let body: Partial<PrinterSettings> & { restaurantId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurantId, ...incoming } = body
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  // Validate IPs
  for (const [key, ip] of Object.entries(incoming)) {
    if (ip !== null && ip !== undefined && ip !== '') {
      if (!isValidIPv4(ip as string)) {
        return NextResponse.json(
          { error: `Invalid IPv4 address for ${key}: ${ip}` },
          { status: 400 }
        )
      }
    }
  }

  const supabase = createServiceClient()
  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('metadata')
    .eq('id', restaurantId)
    .single()

  if (fetchError || !restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const existingMeta = (restaurant.metadata as Record<string, unknown>) ?? {}
  const existingPrinters = (existingMeta.printers as PrinterSettings) ?? {}
  const merged = { ...existingPrinters, ...incoming }

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ metadata: { ...existingMeta, printers: merged } })
    .eq('id', restaurantId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json(merged)
}
