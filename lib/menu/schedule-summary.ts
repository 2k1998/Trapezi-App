import type { MenuSchedule } from '@/types/menu'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Row = Pick<MenuSchedule, 'day_of_week' | 'start_time' | 'end_time'>

function fmtTime(t: string): string {
  return t.slice(0, 5)
}

function sortDaysMonFirst(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => {
    const order = (d: number) => (d === 0 ? 7 : d)
    return order(a) - order(b)
  })
}

/** Human-readable schedule summary for owner UI */
export function summarizeMenuSchedules(schedules: Row[]): string {
  if (!schedules.length) return 'No schedule'

  const groups = new Map<string, number[]>()
  for (const s of schedules) {
    const windowKey = `${fmtTime(s.start_time)}–${fmtTime(s.end_time)}`
    const arr = groups.get(windowKey) ?? []
    arr.push(s.day_of_week)
    groups.set(windowKey, arr)
  }

  return [...groups.entries()]
    .map(([windowKey, days]) => {
      const sorted = sortDaysMonFirst(days)
      const dayPart = sorted.map(d => DAY_SHORT[d] ?? `D${d}`).join(', ')
      return `${dayPart} ${windowKey}`
    })
    .join('; ')
}

/** Happy hour / rule day list */
export function formatDayList(days: number[]): string {
  if (!days.length) return ''
  const sorted = sortDaysMonFirst(days)
  return sorted.map(d => DAY_SHORT[d] ?? String(d)).join(', ')
}
