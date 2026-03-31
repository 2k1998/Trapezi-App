import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { startOfWeek, endOfWeek, subWeeks, getHours } from 'date-fns'
import { renderWeeklyReportEmail } from '@/emails/weekly-report'

export const runtime = 'nodejs'

const ATHENS_TZ = 'Europe/Athens'

const resend = new Resend(process.env.RESEND_API_KEY!)

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Returns the UTC Date representing the start of a given local date boundary
function toUTC(localDate: Date, timezone: string): Date {
  return fromZonedTime(localDate, timezone)
}

function buildWeekRange(weeksAgo: number): { start: Date; end: Date } {
  const nowAthens = toZonedTime(new Date(), ATHENS_TZ)
  // Monday as week start (locale 'en-GB' or weekStartsOn: 1)
  const weekStart = startOfWeek(subWeeks(nowAthens, weeksAgo), { weekStartsOn: 1 })
  const weekEnd = endOfWeek(subWeeks(nowAthens, weeksAgo), { weekStartsOn: 1 })

  // Set to midnight and end of day in Athens time
  weekStart.setHours(0, 0, 0, 0)
  weekEnd.setHours(23, 59, 59, 999)

  return {
    start: toUTC(weekStart, ATHENS_TZ),
    end: toUTC(weekEnd, ATHENS_TZ),
  }
}

function formatWeekDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    timeZone: ATHENS_TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export async function GET(request: NextRequest) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = getServiceClient()
  const { start: weekStart, end: weekEnd } = buildWeekRange(1)
  const { start: prevStart, end: prevEnd } = buildWeekRange(2)

  const weekStartLabel = formatWeekDate(weekStart)
  const weekEndLabel = formatWeekDate(weekEnd)

  // Fetch all pro restaurants
  const { data: restaurants, error: restaurantsError } = await supabase
    .from('restaurants')
    .select('id, name, timezone, logo_url, accent_color')
    .eq('plan', 'pro')
    .eq('is_active', true)

  if (restaurantsError || !restaurants) {
    console.error('[Cron] Failed to fetch pro restaurants:', restaurantsError?.message)
    await logCronFailure(supabase, 'weekly-report', `Failed to fetch restaurants: ${restaurantsError?.message}`)
    return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 })
  }

  const results: { restaurant: string; status: 'sent' | 'skipped' | 'failed'; reason?: string }[] = []

  for (const restaurant of restaurants) {
    try {
      // Fetch closed orders for this restaurant in the target week
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total, created_at')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'closed')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())

      if (ordersError) throw new Error(`Orders fetch failed: ${ordersError.message}`)

      if (!orders || orders.length === 0) {
        results.push({ restaurant: restaurant.name, status: 'skipped', reason: 'no orders' })
        continue
      }

      const totalOrders = orders.length
      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0)
      const averageOrderValue = totalRevenue / totalOrders

      // Peak hours (Athens timezone)
      const hourCounts: Record<number, number> = {}
      for (const order of orders) {
        const athensDate = toZonedTime(new Date(order.created_at), ATHENS_TZ)
        const hour = getHours(athensDate)
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
      }
      const peakHours = Object.entries(hourCounts)
        .map(([h, count]) => ({ hour: Number(h), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Top food and drink items
      const orderIds = orders.map(o => o.id)
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('name_snapshot, type, quantity')
        .in('order_id', orderIds)

      if (itemsError) throw new Error(`Order items fetch failed: ${itemsError.message}`)

      const foodTotals: Record<string, number> = {}
      const drinkTotals: Record<string, number> = {}
      for (const item of orderItems ?? []) {
        if (item.type === 'food') {
          foodTotals[item.name_snapshot] = (foodTotals[item.name_snapshot] ?? 0) + item.quantity
        } else {
          drinkTotals[item.name_snapshot] = (drinkTotals[item.name_snapshot] ?? 0) + item.quantity
        }
      }

      const topFood = Object.entries(foodTotals)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3)

      const topDrinks = Object.entries(drinkTotals)
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 3)

      // Revenue/orders comparison with previous week
      const { data: prevOrders } = await supabase
        .from('orders')
        .select('total')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'closed')
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString())

      let revenueChange: number | null = null
      let ordersChange: number | null = null
      if (prevOrders && prevOrders.length > 0) {
        const prevRevenue = prevOrders.reduce((sum, o) => sum + Number(o.total), 0)
        revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null
        ordersChange = ((totalOrders - prevOrders.length) / prevOrders.length) * 100
      }

      // Fetch owner email
      const { data: owner } = await supabase
        .from('staff')
        .select('email')
        .eq('restaurant_id', restaurant.id)
        .eq('role', 'owner')
        .single()

      if (!owner?.email) {
        results.push({ restaurant: restaurant.name, status: 'skipped', reason: 'no owner email' })
        continue
      }

      const peakHoursForEmail = peakHours.map(h => ({ hour: h.hour, orders: h.count }))

      // Send email via Resend
      const html = renderWeeklyReportEmail({
        restaurantName: restaurant.name,
        restaurantLogo: restaurant.logo_url ?? null,
        accentColor: restaurant.accent_color ?? null,
        weekStart: weekStartLabel,
        weekEnd: weekEndLabel,
        totalRevenue,
        totalOrders,
        averageOrderValue,
        topFood,
        topDrinks,
        peakHours: peakHoursForEmail,
        revenueChange,
        ordersChange,
      })

      await resend.emails.send({
        from: 'Trapezi <reports@trapezi.app>',
        to: owner.email,
        subject: `Your weekly report — ${restaurant.name}`,
        html,
      })

      console.log('[Cron] Weekly report sent to', owner.email, 'for', restaurant.name)
      results.push({ restaurant: restaurant.name, status: 'sent' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[Cron] Failed for restaurant', restaurant.name, message)
      results.push({ restaurant: restaurant.name, status: 'failed', reason: message })
    }
  }

  const sent = results.filter(r => r.status === 'sent').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const failed = results.filter(r => r.status === 'failed').length

  return NextResponse.json({ sent, skipped, failed, results })
}

async function logCronFailure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  jobName: string,
  errorMessage: string
): Promise<void> {
  try {
    await supabase.from('cron_failures').insert({ job_name: jobName, error_message: errorMessage })
  } catch (err) {
    console.error('[Cron] Failed to log cron failure:', err)
  }
}
