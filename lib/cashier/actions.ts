'use server'

import { createClient } from '@/lib/supabase/server'
import { sendPushToRestaurant } from '@/lib/push/index.server'

export async function markOrderReady(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status: 'ready' })
    .eq('id', orderId)

  if (error) return { success: false, error: error.message }

  // Fetch order details for notifications — after update, order still exists
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('table_id, restaurant_id')
      .eq('id', orderId)
      .single()

    if (order) {
      const tableResult = await supabase
        .from('tables')
        .select('table_number')
        .eq('id', order.table_id)
        .single()

      const tableNumber = tableResult.data?.table_number

      // Push: order ready notification to cashier (staff) — fire-and-forget
      if (tableNumber !== undefined) {
        sendPushToRestaurant(order.restaurant_id, {
          title: `Order at Table ${tableNumber} marked as ready`,
          body: '',
        }).catch(err => console.error('[Action] Staff push failed for order', orderId, err))
      }
    }
  } catch (notifyErr) {
    // Notification failures must never surface to the cashier
    console.error('[Action] markOrderReady notification error for', orderId, notifyErr)
  }

  return { success: true }
}

export async function closeTab(
  sessionId: string,
  tableId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error: ordersError } = await supabase
    .from('orders')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('session_id', sessionId)

  if (ordersError) return { success: false, error: ordersError.message }

  const { error: tableError } = await supabase
    .from('tables')
    .update({ status: 'available' })
    .eq('id', tableId)

  if (tableError) return { success: false, error: tableError.message }

  // Push: tab closed notification — fire-and-forget
  try {
    const [sessionResult, tableResult] = await Promise.all([
      supabase
        .from('orders')
        .select('restaurant_id, total')
        .eq('session_id', sessionId)
        .limit(50),
      supabase.from('tables').select('table_number').eq('id', tableId).single(),
    ])

    const sessionOrders = sessionResult.data
    const tableNumber = tableResult.data?.table_number

    if (sessionOrders && sessionOrders.length > 0 && tableNumber !== undefined) {
      const restaurantId = sessionOrders[0].restaurant_id
      const sessionTotal = sessionOrders.reduce((sum, o) => sum + Number(o.total), 0)

      sendPushToRestaurant(restaurantId, {
        title: `Tab closed — Table ${tableNumber}`,
        body: `€${sessionTotal.toFixed(2)}`,
      }).catch(err => console.error('[Action] Push failed for closeTab session', sessionId, err))
    }
  } catch (pushErr) {
    console.error('[Action] closeTab push error for session', sessionId, pushErr)
  }

  return { success: true }
}
