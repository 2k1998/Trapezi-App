import type { OrderWithItems } from '@/lib/cashier/types'

const PAPER_WIDTH = 32

const ESC_INIT = '\x1B\x40'
const ESC_CENTER = '\x1B\x61\x01'
const ESC_LEFT = '\x1B\x61\x00'
const ESC_BOLD_ON = '\x1B\x45\x01'
const ESC_BOLD_OFF = '\x1B\x45\x00'
const ESC_CUT = '\x1D\x56\x41'

export function formatLine(left: string, right: string, width: number): string {
  const combined = left.length + right.length
  if (combined >= width) {
    const maxLeft = width - right.length - 1
    const truncated = left.slice(0, Math.max(0, maxLeft))
    const gap = Math.max(0, width - truncated.length - right.length)
    return truncated + ' '.repeat(gap) + right
  }
  return left + ' '.repeat(width - combined) + right
}

function formatTimestamp(isoString: string): string {
  const d = new Date(isoString)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

function buildHeader(
  label: string,
  order: OrderWithItems,
  restaurantName: string,
  tableNumber?: number,
): string[] {
  const tableDisplay = tableNumber != null ? String(tableNumber) : order.table_id.slice(0, 8)
  return [
    ESC_INIT,
    ESC_CENTER,
    ESC_BOLD_ON,
    restaurantName.slice(0, PAPER_WIDTH) + '\n',
    ESC_BOLD_OFF,
    label + '\n',
    ESC_LEFT,
    '-'.repeat(PAPER_WIDTH) + '\n',
    formatLine('ORDER #', String(order.order_number), PAPER_WIDTH) + '\n',
    formatLine('TABLE:', tableDisplay, PAPER_WIDTH) + '\n',
    formatLine('TIME:', formatTimestamp(order.created_at), PAPER_WIDTH) + '\n',
    '-'.repeat(PAPER_WIDTH) + '\n',
  ]
}

function buildItemLines(items: OrderWithItems['order_items']): string[] {
  const lines: string[] = []
  for (const item of items) {
    lines.push(
      ESC_LEFT +
        formatLine(item.name_snapshot.slice(0, PAPER_WIDTH - 4), `x${item.quantity}`, PAPER_WIDTH) +
        '\n',
    )
    if (item.notes) {
      lines.push(`  > ${item.notes.slice(0, PAPER_WIDTH - 4)}\n`)
    }
  }
  return lines
}

function buildReceiptHeader(text: string): string[] {
  const lines = text.split('\n').map(line => ESC_CENTER + line.slice(0, PAPER_WIDTH) + '\n')
  return [...lines, ESC_LEFT, '-'.repeat(PAPER_WIDTH) + '\n']
}

function buildReceiptFooter(text: string): string[] {
  const lines = text.split('\n').map(line => ESC_CENTER + line.slice(0, PAPER_WIDTH) + '\n')
  return ['-'.repeat(PAPER_WIDTH) + '\n', ...lines]
}

function buildFooter(): string[] {
  return ['\n', '\n', ESC_CUT]
}

export type SlipBranding = {
  receipt_header?: string | null
  receipt_footer?: string | null
  isPro?: boolean
}

export function generateKitchenSlip(
  order: OrderWithItems,
  restaurantName: string,
  tableNumber?: number,
  branding?: SlipBranding,
): string[] {
  const items = order.order_items.filter(i => i.type === 'food')
  const header = branding?.isPro && branding.receipt_header ? buildReceiptHeader(branding.receipt_header) : []
  const footer = branding?.isPro && branding.receipt_footer ? buildReceiptFooter(branding.receipt_footer) : []
  return [
    ...header,
    ...buildHeader('*** KITCHEN ***', order, restaurantName, tableNumber),
    ...buildItemLines(items),
    ...footer,
    ...buildFooter(),
  ]
}

export function generateBarSlip(
  order: OrderWithItems,
  restaurantName: string,
  tableNumber?: number,
  branding?: SlipBranding,
): string[] {
  const items = order.order_items.filter(i => i.type === 'drink')
  const header = branding?.isPro && branding.receipt_header ? buildReceiptHeader(branding.receipt_header) : []
  const footer = branding?.isPro && branding.receipt_footer ? buildReceiptFooter(branding.receipt_footer) : []
  return [
    ...header,
    ...buildHeader('*** BAR ***', order, restaurantName, tableNumber),
    ...buildItemLines(items),
    ...footer,
    ...buildFooter(),
  ]
}

export function generateCashierSlip(
  order: OrderWithItems,
  restaurantName: string,
  tableNumber?: number,
  branding?: SlipBranding,
): string[] {
  const totalLine = formatLine('TOTAL:', order.total.toFixed(2), PAPER_WIDTH)
  const header = branding?.isPro && branding.receipt_header ? buildReceiptHeader(branding.receipt_header) : []
  const footer = branding?.isPro && branding.receipt_footer ? buildReceiptFooter(branding.receipt_footer) : []
  return [
    ...header,
    ...buildHeader('*** CASHIER ***', order, restaurantName, tableNumber),
    ...buildItemLines(order.order_items),
    '-'.repeat(PAPER_WIDTH) + '\n',
    ESC_BOLD_ON,
    totalLine + '\n',
    ESC_BOLD_OFF,
    ...footer,
    ...buildFooter(),
  ]
}
