/**
 * VAT-inclusive display; currency from restaurant row (e.g. EUR).
 */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `€${amount.toFixed(2)}`
  }
}
