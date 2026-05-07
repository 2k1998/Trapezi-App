import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/menu/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { getPalette } from 'colorthief'

export const runtime = 'nodejs'

const MAX_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const BUCKET = 'restaurant-assets'

function isNearWhite(r: number, g: number, b: number) {
  return r > 240 && g > 240 && b > 240
}

function isNearBlack(r: number, g: number, b: number) {
  return r < 20 && g < 20 && b < 20
}

function isTooSimilar(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
) {
  return Math.abs(r1 - r2) < 30 && Math.abs(g1 - g2) < 30 && Math.abs(b1 - b2) < 30
}

async function extractColors(buffer: Buffer): Promise<{
  accent_color: string
  secondary_color: string | null
}> {
  const palette = await getPalette(buffer, { colorCount: 5, quality: 10 })
  if (!palette || palette.length === 0) throw new Error('Empty palette')

  const colors = palette.map(c => ({ hex: c.hex(), ...c.rgb() }))

  const validColors = colors.filter(c => !isNearWhite(c.r, c.g, c.b) && !isNearBlack(c.r, c.g, c.b))

  const accent = validColors[0] ?? colors[0]

  let secondary: (typeof colors)[number] | null = null
  for (const c of validColors.slice(1)) {
    if (!isTooSimilar(accent.r, accent.g, accent.b, c.r, c.g, c.b)) {
      secondary = c
      break
    }
  }

  return {
    accent_color: accent.hex,
    secondary_color: secondary?.hex ?? null,
  }
}

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const restaurantId = formData.get('restaurantId')
  if (!restaurantId || typeof restaurantId !== 'string') {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  const file = formData.get('logo')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const mimeType = file.type || 'application/octet-stream'

  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Only jpg, png, and webp images are allowed' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Logo must be 2MB or smaller' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Ensure bucket exists — ignore error if it already exists
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => undefined)

  // Fetch current logo URL to delete the old file
  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('metadata')
    .eq('id', restaurantId)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const existingMeta = (restaurant?.metadata as Record<string, unknown>) ?? {}
  const existingBranding = (existingMeta.branding as Record<string, unknown>) ?? {}
  const oldLogoUrl = typeof existingBranding.logo_url === 'string' ? existingBranding.logo_url : null

  if (oldLogoUrl) {
    const marker = `/${BUCKET}/`
    const idx = oldLogoUrl.indexOf(marker)
    if (idx !== -1) {
      const oldPath = decodeURIComponent(oldLogoUrl.slice(idx + marker.length).split('?')[0])
      await supabase.storage.from(BUCKET).remove([oldPath])
    }
  }

  const ext = EXT_MAP[mimeType]
  const uploadPath = `${restaurantId}/logo/${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(uploadPath, buffer, { contentType: mimeType, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(uploadPath)
  const logo_url = urlData.publicUrl

  // Extract dominant colors — non-blocking, never fails the upload
  let extractedColors: { accent_color: string; secondary_color: string | null } | null = null
  try {
    extractedColors = await extractColors(buffer)
  } catch (e) {
    console.error('[logo/upload] color extraction failed (non-fatal):', e)
  }

  const updatedBranding: Record<string, unknown> = {
    ...existingBranding,
    logo_url,
    ...(extractedColors && {
      accent_color: extractedColors.accent_color,
      ...(extractedColors.secondary_color && { secondary_color: extractedColors.secondary_color }),
    }),
  }

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ metadata: { ...existingMeta, branding: updatedBranding } })
    .eq('id', restaurantId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    logo_url,
    ...(extractedColors
      ? {
          accent_color: extractedColors.accent_color,
          secondary_color: extractedColors.secondary_color,
          colors_extracted: true,
        }
      : { colors_extracted: false }),
  })
}
