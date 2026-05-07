export type AnalyticsTabId = 'overview' | 'orderHistory' | 'payouts' | 'reports'

export type DatePreset =
  | 'today'
  | 'last7Days'
  | 'last30Days'
  | 'last6Months'
  | 'last9Months'
  | 'lastYear'
  | 'custom'

export type DateRange = {
  from: Date
  to: Date
}

export type StatusFilter = 'all' | 'paid' | 'ready' | 'closed'
