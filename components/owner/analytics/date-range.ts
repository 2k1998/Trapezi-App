import {
  endOfDay,
  startOfDay,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'
import type { DatePreset, DateRange } from './types'

export function getDateRangeFromPreset(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string
): DateRange {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  if (preset === 'custom') {
    const from = customFrom ? startOfDay(new Date(customFrom)) : todayStart
    const to = customTo ? endOfDay(new Date(customTo)) : todayEnd
    return { from, to }
  }

  if (preset === 'today') return { from: todayStart, to: todayEnd }
  if (preset === 'last7Days') return { from: startOfDay(subDays(now, 6)), to: todayEnd }
  if (preset === 'last30Days') return { from: startOfDay(subDays(now, 29)), to: todayEnd }
  if (preset === 'last6Months') return { from: startOfDay(subMonths(now, 6)), to: todayEnd }
  if (preset === 'last9Months') return { from: startOfDay(subMonths(now, 9)), to: todayEnd }
  return { from: startOfDay(subYears(now, 1)), to: todayEnd }
}

export function getLastWeekRange(): DateRange {
  const now = new Date()
  const end = endOfDay(subDays(now, 1))
  const start = startOfDay(subDays(end, 6))
  return { from: start, to: end }
}

export function toIso(value: Date): string {
  return value.toISOString()
}
