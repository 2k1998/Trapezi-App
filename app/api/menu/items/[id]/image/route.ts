import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'

export const runtime = 'nodejs'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, true)
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: auth.status })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'file field is required' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 413 })
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only jpg, png, webp files are allowed' }, { status: 415 })
  }

  const supabase = createServiceClient()

  // Verify item belongs to this restaurant
  const { data: item } = await supabase
    .from('menu_items')
    .select('id, image_url')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // Delete old image if one exists
  if (item.image_url) {
    // Extract storage path from the public URL
    // Public URL format: .../storage/v1/object/public/menu-images/<path>
    const url = item.image_url as string
    const marker = '/menu-images/'
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      const oldPath = url.slice(idx + marker.length)
      await supabase.storage.from('menu-images').remove([oldPath])
    }
  }

  const ext = EXT_MAP[file.type]
  const storagePath = `${restaurantId}/${id}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from('menu-images')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  const { data: publicUrlData } = supabase.storage
    .from('menu-images')
    .getPublicUrl(storagePath)

  const imageUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from('menu_items')
    .update({ image_url: imageUrl })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ image_url: imageUrl })
}
