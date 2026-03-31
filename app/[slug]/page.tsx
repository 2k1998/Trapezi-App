import { notFound } from 'next/navigation'
import { MenuClient } from '@/components/menu/MenuClient'
import type { MenuItemRow } from '@/components/menu/MenuItemCard'
import { createClient } from '@/lib/supabase/server'

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
      'id, name, slug, plan, languages, default_language, accent_color, logo_url, currency'
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

  return (
    <MenuClient
      restaurant={{
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        plan: restaurant.plan,
        languages: restaurant.languages ?? ['en'],
        default_language: restaurant.default_language,
        accent_color: restaurant.accent_color,
        logo_url: restaurant.logo_url,
        currency: restaurant.currency,
      }}
      groupedItems={groupedItems}
      tableNumber={tableNumber}
      tableError={tableError}
    />
  )
}
