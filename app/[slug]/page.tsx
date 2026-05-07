import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MenuClient } from '@/components/menu/MenuClient'
import type { MenuItemRow } from '@/components/menu/MenuItemCard'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('name')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !restaurant) {
    notFound()
  }

  const name =
    typeof restaurant.name === 'string'
      ? restaurant.name
      : 'Restaurant'

  return {
    title: `${name} — Trapezi`,
  }
}

function parseTable(raw: string | undefined): {
  tableNumber: number | null
  tableError: boolean
} {
  if (raw === undefined || raw === '') {
    return { tableNumber: null, tableError: true }
  }
  const t = parseInt(raw, 10)
  if (!Number.isInteger(t) || t <= 0) {
    return { tableNumber: null, tableError: true }
  }
  return { tableNumber: t, tableError: false }
}

export default async function MenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ table?: string }>
}) {
  const { slug } = await params
  const { table: tableParam } = await searchParams
  const { tableNumber, tableError } = parseTable(tableParam)

  const supabase = await createClient()
  const { data: restaurant, error: restError } = await supabase
    .from('restaurants')
    .select(
      'id, name, slug, plan, languages, default_language, accent_color, logo_url, currency, metadata'
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (restError || !restaurant) {
    notFound()
  }

  const { data: rows } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('is_available', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  const categoryOrder: string[] = []
  const byCategory = new Map<string, MenuItemRow[]>()

  for (const row of rows ?? []) {
    const cat = row.category as string
    if (!byCategory.has(cat)) {
      byCategory.set(cat, [])
      categoryOrder.push(cat)
    }
    const name = row.name as Record<string, string>
    const desc = row.description as Record<string, string> | null
    byCategory.get(cat)!.push({
      id: row.id,
      name,
      description: desc,
      category: cat,
      type: row.type as 'food' | 'drink',
      price: Number(row.price),
      image_url: row.image_url as string | null,
      is_featured: Boolean(row.is_featured),
    })
  }

  const groupedItems = categoryOrder.map(category => ({
    category,
    items: byCategory.get(category)!,
  }))

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000'
  const brandingRes = await fetch(
    `${base}/api/settings/branding?restaurantId=${encodeURIComponent(restaurant.id)}`,
    { cache: 'no-store' }
  )
  const branding = brandingRes.ok
    ? ((await brandingRes.json()) as Record<string, unknown>)
    : {}

  // Pro plan: use branding overrides; other plans: use direct columns only
  const isPro = restaurant.plan === 'pro' || restaurant.plan === 'enterprise'
  const accentColor = (branding.accent_color as string | null) ?? restaurant.accent_color
  const logoUrl = (branding.logo_url as string | null) ?? restaurant.logo_url
  const brandingFont = isPro ? ((branding.font as string | null) ?? null) : null
  const secondaryColor = isPro ? ((branding.secondary_color as string | null) ?? null) : null
  const confirmationMessageEl = isPro ? ((branding.confirmation_message_el as string | null) ?? null) : null
  const confirmationMessageEn = isPro ? ((branding.confirmation_message_en as string | null) ?? null) : null

  const fontHrefMap: Record<string, string> = {
    Inter: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap',
    Lora: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
    Montserrat: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
    Raleway: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap',
  }
  const fontHref = brandingFont ? fontHrefMap[brandingFont] : null

  return (
    <>
      {isPro && fontHref ? <link rel="stylesheet" href={fontHref} /> : null}
      <MenuClient
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          plan: restaurant.plan,
          languages: restaurant.languages ?? ['en'],
          default_language: restaurant.default_language,
          accent_color: accentColor,
          secondary_color: secondaryColor,
          logo_url: logoUrl,
          currency: restaurant.currency,
          branding_font: brandingFont,
          confirmation_message_el: confirmationMessageEl,
          confirmation_message_en: confirmationMessageEn,
        }}
        groupedItems={groupedItems}
        tableNumber={tableNumber}
        tableError={tableError}
      />
    </>
  )
}
