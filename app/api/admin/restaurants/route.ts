import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe/server'
import type { NewRestaurantPayload, NewRestaurantResult } from '@/lib/types/admin'
import type { Plan } from '@/lib/types/billing'
import { generatePassword } from '@/lib/staff/credentials'

export const runtime = 'nodejs'

const RESERVED_SLUGS = ['dashboard', 'admin', 'login', 'signup', 'settings', 'billing', 'api', 'health', 'static', 'assets', 'null', 'undefined']

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  const { data: restaurants, error } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const summaries = await Promise.all(
    (restaurants ?? []).map(async (r) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [staffRes, menuRes, tablesRes, ordersCountRes, revenueRes] = await Promise.allSettled([
        supabaseAdmin
          .from('staff')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', r.id)
          .is('deleted_at', null),
        supabaseAdmin
          .from('menu_items')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', r.id)
          .is('deleted_at', null),
        supabaseAdmin
          .from('tables')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', r.id)
          .is('deleted_at', null),
        supabaseAdmin
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('restaurant_id', r.id)
          .gte('created_at', thirtyDaysAgo),
        supabaseAdmin
          .from('orders')
          .select('total')
          .eq('restaurant_id', r.id)
          .gte('created_at', thirtyDaysAgo),
      ])

      const staffCount = staffRes.status === 'fulfilled' ? (staffRes.value.count ?? 0) : 0
      const menuCount = menuRes.status === 'fulfilled' ? (menuRes.value.count ?? 0) : 0
      const tablesCount = tablesRes.status === 'fulfilled' ? (tablesRes.value.count ?? 0) : 0
      const ordersCount = ordersCountRes.status === 'fulfilled' ? (ordersCountRes.value.count ?? 0) : 0
      const revenue30d =
        revenueRes.status === 'fulfilled'
          ? (revenueRes.value.data ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0)
          : 0

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        plan: r.plan as Plan,
        subscription_status: r.subscription_status ?? 'active',
        dunning_day: r.dunning_day ?? 0,
        contract_start_date: r.contract_start_date ?? null,
        current_period_end: r.current_period_end ?? null,
        stripe_customer_id: r.stripe_customer_id ?? null,
        stripe_subscription_id: r.stripe_subscription_id ?? null,
        created_at: r.created_at,
        metadata: r.metadata ?? {},
        staff_count: staffCount,
        menu_items_count: menuCount,
        tables_count: tablesCount,
        orders_count_30d: ordersCount,
        revenue_30d: revenue30d,
      }
    })
  )

  return NextResponse.json(summaries)
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof Response) return auth

  let body: NewRestaurantPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { name, slug, owner_email, plan, printer_ips } = body

  if (!name || !slug || !owner_email || !plan) {
    return NextResponse.json({ error: 'name, slug, owner_email, and plan are required' }, { status: 400 })
  }

  // Validate slug format: lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug must be lowercase alphanumeric with hyphens only' }, { status: 400 })
  }

  if (RESERVED_SLUGS.includes(slug)) {
    return NextResponse.json({ error: `Slug "${slug}" is reserved` }, { status: 400 })
  }

  // Check slug not already taken
  const { data: existingRestaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingRestaurant) {
    return NextResponse.json({ error: 'Slug is already taken' }, { status: 409 })
  }

  // Check email not already in use
  const { data: existingStaff } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('email', owner_email)
    .maybeSingle()

  if (existingStaff) {
    return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })
  }

  // Insert restaurant
  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .insert({
      name,
      slug,
      plan,
      owner_email,
      is_active: true,
      subscription_status: 'active',
      metadata: {
        printers: (printer_ips ?? []).map((ip) => ({ ip, name: 'Printer' })),
      },
    })
    .select('*')
    .single()

  if (restaurantError || !restaurant) {
    return NextResponse.json({ error: restaurantError?.message ?? 'Failed to create restaurant' }, { status: 500 })
  }

  // Generate owner password and create auth user
  const generatedPassword = generatePassword()

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: owner_email,
    password: generatedPassword,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    // Roll back restaurant row
    await supabaseAdmin.from('restaurants').delete().eq('id', restaurant.id)
    return NextResponse.json({ error: authError?.message ?? 'Failed to create auth user' }, { status: 500 })
  }

  // Insert owner staff row
  const { error: staffError } = await supabaseAdmin.from('staff').insert({
    id: authData.user.id,
    email: owner_email,
    display_name: 'Owner',
    role: 'owner',
    restaurant_id: restaurant.id,
  })

  if (staffError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    await supabaseAdmin.from('restaurants').delete().eq('id', restaurant.id)
    return NextResponse.json({ error: staffError.message }, { status: 500 })
  }

  // Activate Stripe subscription for paid plans
  if (plan !== 'free') {
    const priceId = plan === 'basic' ? process.env.STRIPE_PRICE_BASIC : process.env.STRIPE_PRICE_PRO

    if (priceId) {
      try {
        const customer = await stripe.customers.create({
          email: owner_email,
          metadata: { restaurant_id: restaurant.id },
        })

        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: priceId }],
        }) as any

        const currentPeriodEnd = subscription.current_period_end
          ? new Date((subscription.current_period_end as number) * 1000).toISOString()
          : null

        await supabaseAdmin
          .from('restaurants')
          .update({
            stripe_customer_id: customer.id,
            stripe_subscription_id: subscription.id,
            contract_start_date: new Date().toISOString(),
            current_period_end: currentPeriodEnd,
          })
          .eq('id', restaurant.id)
      } catch (stripeError: any) {
        // Non-fatal: restaurant is created, Stripe can be wired up manually
        console.error('Stripe setup failed:', stripeError?.message)
      }
    }
  }

  const result: NewRestaurantResult = {
    restaurant_id: restaurant.id,
    owner_email,
    generated_password: generatedPassword,
    slug,
  }

  return NextResponse.json(result, { status: 201 })
}
