import type { OrderWithItems } from '@/lib/cashier/types'
import {
  generateKitchenSlip,
  generateBarSlip,
  generateCashierSlip,
} from './escpos'

export type PrinterConfig = {
  kitchen: string
  bar: string
  cashier: string
}

export type PrintResult = {
  kitchen: 'ok' | 'error'
  bar: 'ok' | 'error'
  cashier: 'ok' | 'error'
}

const QZ_WS_URL = 'ws://localhost:8181'
const CONNECT_TIMEOUT_MS = 3000

export function connectQZTray(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let settled = false

    const socket = new WebSocket(QZ_WS_URL)

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        socket.close()
        reject(new Error(`QZ Tray connection timed out after ${CONNECT_TIMEOUT_MS}ms`))
      }
    }, CONNECT_TIMEOUT_MS)

    socket.onopen = () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(socket)
      }
    }

    socket.onerror = () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject(new Error('QZ Tray WebSocket connection failed — is QZ Tray running on the iPad?'))
      }
    }
  })
}

export function sendPrintJob(
  socket: WebSocket,
  printerIp: string,
  commands: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) {
      reject(new Error(`WebSocket is not open (state: ${socket.readyState})`))
      return
    }

    const payload = JSON.stringify({
      call: 'print',
      params: {
        printer: { name: printerIp },
        data: commands.map(cmd => ({ type: 'raw', format: 'plain', data: cmd })),
      },
    })

    try {
      socket.send(payload)
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

export async function printOrder(
  order: OrderWithItems,
  config: PrinterConfig,
  restaurantName: string,
  tableNumber?: number,
): Promise<PrintResult> {
  const kitchenCommands = generateKitchenSlip(order, restaurantName, tableNumber)
  const barCommands = generateBarSlip(order, restaurantName, tableNumber)
  const cashierCommands = generateCashierSlip(order, restaurantName, tableNumber)

  let socket: WebSocket | null = null

  try {
    socket = await connectQZTray()
  } catch (err) {
    console.error('[printing] Could not connect to QZ Tray:', err)
    return { kitchen: 'error', bar: 'error', cashier: 'error' }
  }

  const [kitchenResult, barResult, cashierResult] = await Promise.allSettled([
    sendPrintJob(socket, config.kitchen, kitchenCommands),
    sendPrintJob(socket, config.bar, barCommands),
    sendPrintJob(socket, config.cashier, cashierCommands),
  ])

  try {
    socket.close()
  } catch {
    // ignore close errors
  }

  return {
    kitchen: kitchenResult.status === 'fulfilled' ? 'ok' : 'error',
    bar: barResult.status === 'fulfilled' ? 'ok' : 'error',
    cashier: cashierResult.status === 'fulfilled' ? 'ok' : 'error',
  }
}
