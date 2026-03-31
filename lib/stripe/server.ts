import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // '2024-06-20' is the target API version.
  // If TypeScript reports a type error here, update to the latest version
  // string supported by your installed stripe SDK (e.g. '2025-01-27.acacia').
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
  typescript: true,
})

// Stripe Connect: our platform collects 0.25% as an application fee.
// This is automatically deposited into our platform account.
// The rest goes directly into the restaurant's connected Stripe account.
export const PLATFORM_FEE_PERCENTAGE = 0.0025

export function calculatePlatformFee(amountInCents: number): number {
  // Minimum 1 cent to avoid Stripe errors on very small orders
  return Math.max(1, Math.round(amountInCents * PLATFORM_FEE_PERCENTAGE))
}
