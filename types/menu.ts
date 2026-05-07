export type Category = {
  id: string
  restaurant_id: string
  name_el: string
  name_en: string
  display_order: number
  created_at: string
}

export type Menu = {
  id: string
  restaurant_id: string
  name_el: string
  name_en: string
  is_default: boolean
  display_order: number
  created_at: string
  schedules?: MenuSchedule[]
}

export type MenuSchedule = {
  id: string
  menu_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

export type MenuItemAssignment = {
  id: string
  menu_id: string
  menu_item_id: string
  available: boolean
  display_order: number
}

export type UpsellSuggestion = {
  id: string
  item_id: string
  suggested_item_id: string
  restaurant_id: string
  display_order: number
}

export type HappyHourRule = {
  id: string
  restaurant_id: string
  label_el: string | null
  label_en: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  day_of_week: number[]
  start_time: string
  end_time: string
  created_at: string
  items?: string[] // menu_item_ids
}

export type MenuItemWithDiscount = {
  id: string
  name_el: string | null
  name_en: string | null
  description_el: string | null
  description_en: string | null
  price: number
  discounted_price: number | null
  happy_hour_label_el: string | null
  happy_hour_label_en: string | null
  image_url: string | null
  type: 'food' | 'drink'
  allergens: string[]
  dietary: string[]
  category_id: string | null
  available: boolean
}
