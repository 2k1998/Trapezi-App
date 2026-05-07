// Run with: npx tsx scripts/stripe-setup.ts
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
})

async function findOrCreateProduct(name: string): Promise<string> {
  const existing = await stripe.products.list({ limit: 100 })
  const found = existing.data.find(p => p.name === name && p.active)
  if (found) {
    console.log(`Product "${name}" already exists: ${found.id}`)
    return found.id
  }
  const created = await stripe.products.create({ name })
  console.log(`Created product "${name}": ${created.id}`)
  return created.id
}

async function findOrCreatePrice(
  productId: string,
  unitAmount: number,
  nickname: string
): Promise<string> {
  const existing = await stripe.prices.list({ product: productId, limit: 100, active: true })
  const found = existing.data.find(
    p => p.unit_amount === unitAmount && p.currency === 'eur' && p.recurring?.interval === 'month'
  )
  if (found) {
    console.log(`Price for ${nickname} already exists: ${found.id}`)
    return found.id
  }
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: unitAmount,
    currency: 'eur',
    recurring: { interval: 'month' },
    nickname,
  })
  console.log(`Created price for ${nickname}: ${created.id}`)
  return created.id
}

async function main() {
  const basicProductId = await findOrCreateProduct('Trapezi Basic')
  const proProductId = await findOrCreateProduct('Trapezi Pro')

  const basicPriceId = await findOrCreatePrice(basicProductId, 6900, 'Trapezi Basic Monthly')
  const proPriceId = await findOrCreatePrice(proProductId, 12900, 'Trapezi Pro Monthly')

  console.log('')
  console.log('Add these to your .env.local and Vercel:')
  console.log(`STRIPE_PRICE_BASIC=${basicPriceId}`)
  console.log(`STRIPE_PRICE_PRO=${proPriceId}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
