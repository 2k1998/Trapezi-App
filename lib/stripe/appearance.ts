/**
 * Stripe Elements Appearance — hex values mirror tailwind.config.ts brand tokens.
 * Stripe’s API requires hex; keep these in sync when design tokens change.
 */
export const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#1A1916', // brand-800
    colorBackground: '#FAFAF7', // brand-50
    colorText: '#1A1916', // brand-800
    colorDanger: '#dc2626',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '8px',
  },
}
