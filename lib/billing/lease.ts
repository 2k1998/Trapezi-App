import { differenceInMonths } from 'date-fns'

const LEASE_MONTHLY_EX_VAT = 17
const VAT_RATE = 0.24
export const LEASE_MONTHLY_WITH_VAT = parseFloat(
  (LEASE_MONTHLY_EX_VAT * (1 + VAT_RATE)).toFixed(2)
) // 21.08

export function earlyExitFee(contractStartDate: Date, now = new Date()): number {
  const monthsElapsed = differenceInMonths(now, contractStartDate)
  const monthsRemaining = Math.max(0, 12 - monthsElapsed)
  return parseFloat((monthsRemaining * LEASE_MONTHLY_WITH_VAT).toFixed(2))
}

export function contractEndDate(contractStartDate: Date): Date {
  const end = new Date(contractStartDate)
  end.setFullYear(end.getFullYear() + 1)
  return end
}
