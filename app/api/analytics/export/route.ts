import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/menu/auth'
import { getOrdersForExport } from '@/lib/analytics/queries'
import ExcelJS from 'exceljs'
import { toZonedTime } from 'date-fns-tz'
import { format } from 'date-fns'
import { requirePlan } from '@/lib/plans/gates'
import type { Plan } from '@/lib/plans/gates'

export const runtime = 'nodejs'

const ATHENS_TZ = 'Europe/Athens'

function fmtDate(isoString: string): string {
  return format(toZonedTime(new Date(isoString), ATHENS_TZ), 'dd/MM/yyyy HH:mm')
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const restaurantId = params.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const auth = await requireStaff(restaurantId, false, true)
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status })

  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('plan, subscription_status, dunning_day')
    .eq('id', restaurantId)
    .single()

  try {
    requirePlan(
      (restaurant?.plan ?? 'free') as Plan,
      (restaurant?.subscription_status ?? 'active') as string,
      (restaurant?.dunning_day ?? 0) as number,
      'pro'
    )
  } catch {
    return NextResponse.json({ error: 'plan_required', required: 'pro' }, { status: 403 })
  }

  const rawFrom = params.get('from')
  const rawTo = params.get('to')
  if (!rawFrom || !rawTo) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }

  const from = new Date(rawFrom)
  const to = new Date(rawTo)
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
  }

  let exportData: Awaited<ReturnType<typeof getOrdersForExport>>
  try {
    exportData = await getOrdersForExport(supabase, restaurantId, { from, to })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { orders, orderItems } = exportData

  const workbook = new ExcelJS.Workbook()

  // ── Sheet 1: Orders ────────────────────────────────────────────────────────
  const ordersSheet = workbook.addWorksheet('Orders')

  ordersSheet.columns = [
    { header: 'Order ID',       key: 'id',             width: 15 },
    { header: 'Table',          key: 'table_number',   width: 8  },
    { header: 'Customer Name',  key: 'customer_name',  width: 20 },
    { header: 'Customer Phone', key: 'customer_phone', width: 18 },
    { header: 'Total (€)',      key: 'total',          width: 14 },
    { header: 'Status',         key: 'status',         width: 12 },
    { header: 'Date/Time',      key: 'date_time',      width: 18 },
  ]

  ordersSheet.getRow(1).font = { bold: true }
  ordersSheet.views = [{ state: 'frozen', ySplit: 1 }]

  for (const o of orders) {
    const row = ordersSheet.addRow({
      id:             o.id,
      table_number:   o.table_number,
      customer_name:  o.customer_name,
      customer_phone: o.customer_phone,
      total:          o.total,
      status:         o.status,
      date_time:      fmtDate(o.created_at),
    })
    row.getCell('total').numFmt = '#,##0.00'
  }

  // ── Sheet 2: Order Items ───────────────────────────────────────────────────
  const itemsSheet = workbook.addWorksheet('Order Items')

  itemsSheet.columns = [
    { header: 'Order ID',       key: 'order_id',      width: 15 },
    { header: 'Table',          key: 'table_number',  width: 8  },
    { header: 'Item Name',      key: 'name_snapshot', width: 25 },
    { header: 'Qty',            key: 'quantity',      width: 6  },
    { header: 'Unit Price (€)', key: 'unit_price',    width: 14 },
    { header: 'Item Total (€)', key: 'subtotal',      width: 14 },
    { header: 'Date/Time',      key: 'date_time',     width: 18 },
  ]

  itemsSheet.getRow(1).font = { bold: true }
  itemsSheet.views = [{ state: 'frozen', ySplit: 1 }]

  for (const i of orderItems) {
    const row = itemsSheet.addRow({
      order_id:      i.order_id,
      table_number:  i.table_number,
      name_snapshot: i.name_snapshot,
      quantity:      i.quantity,
      unit_price:    i.unit_price,
      subtotal:      i.subtotal,
      date_time:     fmtDate(i.created_at),
    })
    row.getCell('unit_price').numFmt = '#,##0.00'
    row.getCell('subtotal').numFmt = '#,##0.00'
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const dateStr = format(toZonedTime(new Date(), ATHENS_TZ), 'yyyy-MM-dd')

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="trapezi-export-${dateStr}.xlsx"`,
    },
  })
}
