import type { Plan, SubscriptionStatus } from './billing'

export interface AdminRestaurantSummary {
  id: string
  name: string
  slug: string
  plan: Plan
  subscription_status: SubscriptionStatus
  dunning_day: number
  contract_start_date: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  metadata: Record<string, unknown>
  // computed
  staff_count: number
  menu_items_count: number
  tables_count: number
  orders_count_30d: number
  revenue_30d: number
}

export interface AdminRestaurantDetail {
  restaurant: AdminRestaurantSummary
  staff: AdminStaffMember[]
  tables: AdminTable[]
  sections: AdminSection[]
  categories: AdminCategory[]
  menu_items: AdminMenuItem[]
  menus: AdminMenu[]
  recent_orders: AdminOrder[]
  push_subscriptions_count: number
}

export interface AdminStaffMember {
  id: string
  display_name: string
  email: string
  role: string
  created_at: string
  pin_hash: string | null
  deleted_at: string | null
}

export interface AdminTable {
  id: string
  number: number
  name: string | null
  capacity: number | null
  section_id: string | null
  deleted_at: string | null
}

export interface AdminSection {
  id: string
  name: string
  display_order: number
}

export interface AdminCategory {
  id: string
  name_el: string
  name_en: string | null
  position: number
}

export interface AdminMenuItem {
  id: string
  name_el: string
  name_en: string | null
  price: number
  type: string
  available: boolean
  category_id: string | null
  image_url: string | null
  deleted_at: string | null
}

export interface AdminMenu {
  id: string
  name: string
  is_default: boolean
  created_at: string
}

export interface AdminOrder {
  id: string
  table_number: number | null
  status: string
  total: number
  created_at: string
  customer_name: string | null
  items: AdminOrderItem[]
}

export interface AdminOrderItem {
  id: string
  name_snapshot: string
  quantity: number
  price: number
}

export interface NewRestaurantPayload {
  name: string
  slug: string
  owner_email: string
  plan: Plan
  printer_ips?: string[]
}

export interface NewRestaurantResult {
  restaurant_id: string
  owner_email: string
  generated_password: string
  slug: string
}
