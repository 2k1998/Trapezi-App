import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getActiveMenuItems } from '@/lib/menu/active-menu'

export const runtime = 'nodejs'

// Public endpoint — customers call this on every menu page load.
// No auth required. Uses service client to bypass RLS.
export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  const tableNumber = request.nextUrl.searchParams.get('tableNumber') // logged only

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch restaurant to get plan
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, plan, is_active')
    .eq('id', restaurantId)
    .single()

  if (error || !restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  if (!restaurant.is_active) {
    return NextResponse.json({ error: 'Restaurant is not active' }, { status: 403 })
  }

  console.log('[menu/active] restaurantId:', restaurantId, 'tableNumber:', tableNumber, 'plan:', restaurant.plan)

  try {
    const items = await getActiveMenuItems(restaurantId, restaurant.plan as string)
    return NextResponse.json(items)
  } catch (err) {
    console.error('[menu/active] Error:', err)
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 })
  }
}
