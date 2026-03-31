import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

function isGreek(locale: string | null): boolean {
  return locale?.startsWith('el') ?? false
}

export async function sendPaymentConfirmedSMS(order: {
  customer_phone: string
  customer_locale: string | null
  restaurant_name: string
}): Promise<void> {
  const body = isGreek(order.customer_locale)
    ? `H παραγγελία σας στο ${order.restaurant_name} επιβεβαιώθηκε. Ευχαριστούμε!`
    : `Your order at ${order.restaurant_name} has been confirmed. Thank you!`

  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: order.customer_phone,
    })
    console.log('[SMS] Payment confirmed sent:', message.sid, 'to', order.customer_phone)
  } catch (err) {
    console.error('[SMS] Failed to send payment confirmed SMS to', order.customer_phone, err)
  }
}

export async function sendOrderReadySMS(order: {
  customer_phone: string
  customer_locale: string | null
  restaurant_name: string
}): Promise<void> {
  const body = isGreek(order.customer_locale)
    ? `H παραγγελία σας στο ${order.restaurant_name} είναι έτοιμη. Καλή απόλαυση!`
    : `Your order at ${order.restaurant_name} is ready. Enjoy!`

  try {
    const message = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: order.customer_phone,
    })
    console.log('[SMS] Order ready sent:', message.sid, 'to', order.customer_phone)
  } catch (err) {
    console.error('[SMS] Failed to send order ready SMS to', order.customer_phone, err)
  }
}
