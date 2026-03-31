/** HTML weekly digest for Resend / email clients. Inline styles only; accent hex is email-only. */

const DEFAULT_ACCENT = '#2E4A7A'
const GREEN = '#16a34a'
const RED = '#dc2626'

export type WeeklyReportEmailProps = {
  restaurantName: string
  restaurantLogo: string | null
  accentColor: string | null
  weekStart: string
  weekEnd: string
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  topFood: Array<{ name: string; quantity: number }>
  topDrinks: Array<{ name: string; quantity: number }>
  peakHours: Array<{ hour: number; orders: number }>
  revenueChange: number | null
  ordersChange: number | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`
}

function changeColor(change: number): string {
  return change >= 0 ? GREEN : RED
}

function formatChangeLine(label: string, change: number | null): string {
  if (change === null) {
    return `<span style="font-size:13px;color:#666">${label} — no prior week to compare</span>`
  }
  const sign = change >= 0 ? '+' : ''
  const color = changeColor(change)
  return `<span style="font-size:13px;color:${color};font-weight:600">${sign}${change.toFixed(1)}%</span> <span style="font-size:13px;color:#666">vs previous week (${label})</span>`
}

function peakHoursBars(
  peakHours: Array<{ hour: number; orders: number }>,
  barColor: string
): string {
  if (peakHours.length === 0) return ''
  const max = Math.max(...peakHours.map(h => h.orders), 1)
  const bar = (n: number) => '█'.repeat(Math.max(1, Math.round((n / max) * 20)))

  return peakHours
    .map(h => {
      const hh = String(h.hour).padStart(2, '0')
      return `<tr>
  <td style="padding:6px 8px 6px 0;white-space:nowrap;font-size:14px;color:#333;width:56px">${hh}:00</td>
  <td style="padding:6px 0;font-size:14px;color:${barColor};font-family:ui-monospace,monospace;letter-spacing:1px">${bar(h.orders)}</td>
  <td style="padding:6px 0 6px 8px;font-size:13px;color:#666;white-space:nowrap">${h.orders} orders</td>
</tr>`
    })
    .join('')
}

export function renderWeeklyReportEmail(data: WeeklyReportEmailProps): string {
  const accent =
    data.accentColor && /^#[0-9A-Fa-f]{3,8}$/i.test(data.accentColor.trim())
      ? data.accentColor.trim()
      : DEFAULT_ACCENT
  const name = escapeHtml(data.restaurantName)

  const topItemsRows = (items: Array<{ name: string; quantity: number }>) =>
    items
      .map(
        i =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${i.quantity}</td></tr>`
      )
      .join('')

  const logoUrl = data.restaurantLogo?.trim() ?? ''
  const safeLogo =
    logoUrl !== '' && /^https?:\/\//i.test(logoUrl) ? escapeHtml(logoUrl) : ''
  const logoBlock =
    safeLogo !== ''
      ? `<div style="margin-bottom:20px;text-align:center">
  <img src="${safeLogo}" alt="${name}" style="max-height:56px;max-width:200px;height:auto;width:auto" />
</div>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Weekly report — ${name}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .stat-cell { display: block !important; width: 100% !important; padding: 8px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,system-ui,-apple-system,sans-serif;color:#1a1a1a">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f4f4f5">
    <tr>
      <td style="padding:16px 12px">
        <table role="presentation" style="max-width:600px;margin:0 auto;width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
          <tr>
            <td style="background-color:${accent};padding:20px 24px">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:rgba(255,255,255,0.85)">Weekly performance</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.25">${name}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9)">${escapeHtml(data.weekStart)} — ${escapeHtml(data.weekEnd)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px">
              ${logoBlock}
              <p style="margin:0 0 20px;font-size:13px;color:#666;line-height:1.5">All amounts below are <strong>VAT-inclusive</strong> totals for the week.</p>

              <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:8px">
                <tr>
                  <td class="stat-cell" style="vertical-align:top;width:33.33%;padding:8px 4px 8px 0">
                    <div style="background-color:#f9fafb;border-radius:8px;padding:14px 10px;text-align:center;border:1px solid #eee">
                      <div style="font-size:24px;font-weight:700;color:#111;line-height:1.2">${formatCurrency(data.totalRevenue)}</div>
                      <div style="font-size:12px;color:#666;margin-top:6px">Total revenue</div>
                      <div style="margin-top:8px">${formatChangeLine('revenue', data.revenueChange)}</div>
                    </div>
                  </td>
                  <td class="stat-cell" style="vertical-align:top;width:33.33%;padding:8px 4px">
                    <div style="background-color:#f9fafb;border-radius:8px;padding:14px 10px;text-align:center;border:1px solid #eee">
                      <div style="font-size:24px;font-weight:700;color:#111;line-height:1.2">${data.totalOrders}</div>
                      <div style="font-size:12px;color:#666;margin-top:6px">Orders</div>
                      <div style="margin-top:8px">${formatChangeLine('orders', data.ordersChange)}</div>
                    </div>
                  </td>
                  <td class="stat-cell" style="vertical-align:top;width:33.33%;padding:8px 0 8px 4px">
                    <div style="background-color:#f9fafb;border-radius:8px;padding:14px 10px;text-align:center;border:1px solid #eee">
                      <div style="font-size:24px;font-weight:700;color:#111;line-height:1.2">${formatCurrency(data.averageOrderValue)}</div>
                      <div style="font-size:12px;color:#666;margin-top:6px">Average order value</div>
                    </div>
                  </td>
                </tr>
              </table>

              ${
                data.topFood.length > 0
                  ? `<h2 style="margin:28px 0 10px;font-size:16px;font-weight:700;color:${accent}">Top food</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:8px">${topItemsRows(data.topFood)}</table>`
                  : ''
              }

              ${
                data.topDrinks.length > 0
                  ? `<h2 style="margin:28px 0 10px;font-size:16px;font-weight:700;color:${accent}">Top drinks</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:8px">${topItemsRows(data.topDrinks)}</table>`
                  : ''
              }

              ${
                data.peakHours.length > 0
                  ? `<h2 style="margin:28px 0 10px;font-size:16px;font-weight:700;color:${accent}">Peak hours</h2>
              <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:4px">${peakHoursBars(data.peakHours, accent)}</table>`
                  : ''
              }

              <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#9ca3af;text-align:center">Powered by Trapezi</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
