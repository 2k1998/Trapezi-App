import type { Category, HappyHourRule, MenuSchedule, UpsellSuggestion } from '@/types/menu'
import type { MenuItemWithDiscount } from '@/types/menu'

export type MenuItemAdmin = {
  id: string
  restaurant_id: string
  name: Record<string, string>
  name_el: string | null
  name_en: string | null
  description_el: string | null
  description_en: string | null
  category: string
  category_id: string | null
  type: 'food' | 'drink'
  price: number
  image_url: string | null
  allergens: string[] | null
  dietary: string[] | null
  is_available?: boolean
  sort_order?: number
}

export type MenuWithSchedules = {
  id: string
  restaurant_id: string
  name_el: string
  name_en: string
  is_default: boolean
  display_order: number
  created_at: string
  menu_schedules: MenuSchedule[] | null
}

export type HappyHourRuleWithItems = HappyHourRule & { items: string[] }

export type { Category, MenuItemWithDiscount, UpsellSuggestion }
