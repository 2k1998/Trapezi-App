import { NextRequest, NextResponse } from 'next/server'
import { translateMenuItem, type TranslationError } from '@/lib/menu/translate'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let body: { text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { text } = body
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  try {
    const result = await translateMenuItem(text.trim())
    return NextResponse.json(result)
  } catch (err) {
    const translationErr = err as TranslationError
    if (translationErr?.code === 'TRANSLATION_FAILED') {
      // Non-blocking: caller shows a warning, item still saves
      return NextResponse.json({ el: null, en: null, warning: 'Translation failed' })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
