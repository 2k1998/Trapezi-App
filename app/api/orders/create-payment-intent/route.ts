import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe, calculatePlatformFee } from '@/lib/stripe/server'

interface RequestItem {
  menu_item_id: string
  quantity: number
  notes?: string
}

interface RequestBody {
  slug: string
  table_number: number
  items: RequestItem[]
  customer_name: string
  customer_phone: string
  session_id?: string
}

// Compute the UTC timestamp for midnight of "today" in a given IANA timezone.
// Uses noon UTC on the local date as an anchor point to derive the offset.
function startOfTodayUTC(timezone: string): Date {
  const now = new Date()
  const localDateStr = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone }).format(now)
  const [year, month, day] = localDateStr.split('-').map(Number)
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const localHourAtNoon = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).format(noonUTC),
    10
  )
  return new Date(noonUTC.getTime() - localHourAtNoon * 3_600_000)
}

export async function POST(request: NextRequest) {
  try {
    let body: RequestBody
    try {
      body = await request.json() as RequestBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { slug, table_number, items, customer_name, customer_phone, session_id } = body

    // Validate required fields
    if (!slug || !customer_name || !customer_phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items array is required and must not be empty' }, { status: 400 })
    }
    if (!Number.isInteger(table_number) || table_number <= 0) {
      return NextResponse.json({ error: 'table_number must be a positive integer' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch restaurant — include timezone for order_number generation
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, is_active, currency, stripe_account_id, timezone')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
    }

    // Stripe Connect: restaurant must have a connected account to accept payments.
    // In development, allow a bypass that charges the platform account directly.
    // This bypass NEVER fires in production.
    const useConnect = !!restaurant.stripe_account_id
    if (!useConnect && process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This restaurant has not connected their payment account yet. Please pay at the counter.' },
        { status: 400 }
      )
    }

    // Fetch table — verify it belongs to this restaurant
    const { data: table } = await supabase
      .from('tables')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('table_number', table_number)
      .eq('is_active', true)
      .single()

    if (!table) {
      return NextResponse.json({ error: 'Invalid table number for this restaurant' }, { status: 400 })
    }

    // Fetch menu items from the database — NEVER trust client prices
    const itemIds = items.map(i => i.menu_item_id)
    const { data: menuItemRows } = await supabase
      .from('menu_items')
      .select('id, price, type, name, is_available')
      .in('id', itemIds)
      .eq('restaurant_id', restaurant.id)
      .eq('is_available', true)

    // Build a lookup map and verify every submitted item exists
    const menuItemMap: Record<string, { price: number; type: string; name: Record<string, string> }> =
      Object.fromEntries(
        (menuItemRows ?? []).map(m => [
          m.id,
          { price: Number(m.price), type: m.type, name: m.name as Record<string, string> },
        ])
      )

    for (const item of items) {
      if (!menuItemMap[item.menu_item_id]) {
        return NextResponse.json({ error: 'One or more items are unavailable' }, { status: 400 })
      }
    }

    // Server-side price calculation — never use client-submitted prices
    let subtotal = 0
    for (const item of items) {
      subtotal += menuItemMap[item.menu_item_id].price * item.quantity
    }
    const total = subtotal // prices are VAT-inclusive; tax column is accounting-only
    const totalInCents = Math.round(total * 100)

    // Platform fee only applies when routing through Stripe Connect
    const platformFeeInCents = useConnect ? calculatePlatformFee(totalInCents) : 0

    const resolvedSessionId = session_id ?? crypto.randomUUID()
    const orderId = crypto.randomUUID()

    // Service role client — needed to generate order_number and write the pending order.
    // This is a server-side API route; the service role key is never exposed to the browser.
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Generate order_number: max for this restaurant today + 1
    const timezone = (restaurant.timezone as string) ?? 'UTC'
    const todayStart = startOfTodayUTC(timezone)

    const { data: maxRow } = await serviceSupabase
      .from('orders')
      .select('order_number')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', todayStart.toISOString())
      .order('order_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const orderNumber = ((maxRow?.order_number as number | null) ?? 0) + 1

    // Create the pending order in Supabase before creating the PaymentIntent.
    // Items are stored in the DB so we never need to put them in Stripe metadata,
    // which has a 500-character value limit that breaks for orders with many items.
    // The webhook finds this order by pending_order_id and confirms it.
    const { error: orderError } = await serviceSupabase.from('orders').insert({
      id: orderId,
      restaurant_id: restaurant.id,
      table_id: table.id,
      order_number: orderNumber,
      status: 'pending',
      payment_status: 'unpaid',
      subtotal,
      tax: 0,
      total,
      customer_name,
      customer_phone,
      session_id: resolvedSessionId,
    })

    if (orderError) {
      throw new Error(`Pending order insert failed: ${orderError.message}`)
    }

    const orderItemsToInsert = items.map(item => {
      const dbItem = menuItemMap[item.menu_item_id]
      const nameEn = dbItem.name['en'] ?? Object.values(dbItem.name)[0] ?? ''
      return {
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        restaurant_id: restaurant.id,
        name_snapshot: nameEn,
        type: dbItem.type,
        quantity: item.quantity,
        unit_price: dbItem.price,
        line_total: dbItem.price * item.quantity,
        notes: item.notes ?? null,
      }
    })

    const { error: itemsError } = await serviceSupabase.from('order_items').insert(orderItemsToInsert)

    if (itemsError) {
      // Clean up the orphaned pending order before surfacing the error
      await serviceSupabase.from('orders').delete().eq('id', orderId)
      throw new Error(`Pending order items insert failed: ${itemsError.message}`)
    }

    // Slim metadata: only what's needed for the webhook to find and confirm the order.
    // Items are in Supabase — never in Stripe metadata.
    const metadata = {
      pending_order_id: orderId,
      restaurant_id: restaurant.id,
      table_number: String(table_number),
      session_id: resolvedSessionId,
      customer_name,
      customer_phone,
    }

    // Connect path: PaymentIntent on the restaurant's account with platform fee.
    // Dev fallback: PaymentIntent on platform account directly, no fee.
    const paymentIntent = useConnect
      ? await stripe.paymentIntents.create(
          {
            amount: totalInCents,
            currency: (restaurant.currency as string).toLowerCase(),
            automatic_payment_methods: { enabled: true },
            application_fee_amount: platformFeeInCents,
            metadata: { ...metadata, platform_fee_cents: String(platformFeeInCents) },
          },
          { stripeAccount: restaurant.stripe_account_id as string }
        )
      : await stripe.paymentIntents.create({
          amount: totalInCents,
          currency: (restaurant.currency as string).toLowerCase(),
          automatic_payment_methods: { enabled: true },
          metadata,
        })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      // null when dev bypass is active — frontend must not pass stripeAccount to loadStripe
      stripeAccountId: useConnect ? (restaurant.stripe_account_id as string) : null,
      total,
      session_id: resolvedSessionId,
    })
  } catch (err) {
    console.error('create-payment-intent error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
