import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { translateMenuItem, type TranslationError } from '@/lib/menu/translate'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  let body: { restaurant_id?: string; name_el?: string; name_en?: string; source_text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { restaurant_id, name_el, name_en, source_text } = body

  if (!restaurant_id) {
    return NextResponse.json({ error: 'restaurant_id is required' }, { status: 400 })
  }
  if (!name_el && !name_en && !source_text) {
    return NextResponse.json(
      { error: 'At least one of name_el, name_en, or source_text is required' },
      { status: 400 }
    )
  }

  const auth = await requireStaff(restaurant_id, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  let finalNameEl = name_el ?? null
  let finalNameEn = name_en ?? null
  let translationWarning: string | undefined

  // Auto-translate if only one language provided via source_text
  if (source_text && (!finalNameEl || !finalNameEn)) {
    try {
      const translated = await translateMenuItem(source_text)
      finalNameEl = finalNameEl ?? translated.el
      finalNameEn = finalNameEn ?? translated.en
    } catch (err) {
      const tErr = err as TranslationError
      if (tErr?.code === 'TRANSLATION_FAILED') {
        translationWarning = 'Translation failed — provide both name_el and name_en manually'
        finalNameEl = finalNameEl ?? source_text
        finalNameEn = finalNameEn ?? source_text
      }
    }
  }

  if (!finalNameEl || !finalNameEn) {
    return NextResponse.json({ error: 'Both name_el and name_en are required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('categories')
    .insert({ restaurant_id, name_el: finalNameEl, name_en: finalNameEn })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    { ...data, ...(translationWarning ? { warning: translationWarning } : {}) },
    { status: 201 }
  )
}
