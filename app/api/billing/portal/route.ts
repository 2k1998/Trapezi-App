import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { stripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  const slug = request.nextUrl.searchParams.get('slug')

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('stripe_customer_id, slug')
    .eq('id', restaurantId)
    .single()

  if (!restaurant?.stripe_customer_id) {
    return NextResponse.json({ error: 'NO_STRIPE_CUSTOMER' }, { status: 400 })
  }

  const restaurantSlug = slug ?? restaurant.slug
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://trapeziapp.com'}/${restaurantSlug}/owner`

  const session = await stripe.billingPortal.sessions.create({
    customer: restaurant.stripe_customer_id,
    return_url: returnUrl,
  })

  return NextResponse.json({ url: session.url }, { headers: { 'Cache-Control': 'no-store' } })
}
