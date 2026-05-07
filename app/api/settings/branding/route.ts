import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { translateMenuItem } from '@/lib/menu/translate'
import type { BrandingSettings } from '@/lib/types/staff'

export const runtime = 'nodejs'

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

  const branding: BrandingSettings = (data.metadata as Record<string, unknown>)?.branding as BrandingSettings ?? {
    logo_url: null,
    accent_color: null,
    secondary_color: null,
    font: null,
    confirmation_message_el: null,
    confirmation_message_en: null,
    receipt_header: null,
    receipt_footer: null,
  }

  return NextResponse.json(branding)
}

export async function PATCH(request: NextRequest) {
  let body: Partial<BrandingSettings> & { restaurantId?: string }
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
  const existingBranding = (existingMeta.branding as BrandingSettings) ?? {}
  const merged = { ...existingBranding, ...incoming }

  // Auto-translate confirmation_message if only one language is provided
  const hasEl = !!merged.confirmation_message_el
  const hasEn = !!merged.confirmation_message_en
  const elChanged = incoming.confirmation_message_el !== undefined
  const enChanged = incoming.confirmation_message_en !== undefined

  if ((elChanged || enChanged) && hasEl !== hasEn) {
    try {
      const sourceText = merged.confirmation_message_el || merged.confirmation_message_en || ''
      if (sourceText) {
        const translated = await translateMenuItem(sourceText)
        if (!hasEl) merged.confirmation_message_el = translated.el
        if (!hasEn) merged.confirmation_message_en = translated.en
      }
    } catch {
      // Translation failure is non-blocking
    }
  }

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ metadata: { ...existingMeta, branding: merged } })
    .eq('id', restaurantId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json(merged)
}
