import { loadStripe } from '@stripe/stripe-js'

/**
 * Connected-account PaymentIntents must be confirmed with Stripe.js scoped to
 * the same connected account. Always pass the account id from create-payment-intent.
 */
export function getStripePromise(accountId: string) {
  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!, {
    stripeAccount: accountId,
  })
}

/**
 * Dev-mode bypass: PaymentIntent is on the platform account directly.
 * This is returned by create-payment-intent when stripe_account_id is null
 * and NODE_ENV === 'development'. Never used in production.
 */
export function getPlatformStripePromise() {
  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
}
