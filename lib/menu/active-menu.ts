import { createServiceClient } from '@/lib/supabase/server'
import type { MenuItemWithDiscount } from '@/types/menu'

const ATHENS_TZ = 'Europe/Athens'

function getAthensNow(): { dayOfWeek: number; timeStr: string } {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ATHENS_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00'
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00'
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'

  // Map short weekday to 0=Sun, 1=Mon ... 6=Sat
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }

  return {
    dayOfWeek: weekdayMap[weekday] ?? 0,
    timeStr: `${hour}:${minute}`,
  }
}

// Returns true if timeStr (HH:MM) is within [start, end] (both HH:MM:SS or HH:MM)
function isTimeInRange(timeStr: string, start: string, end: string): boolean {
  // Normalise to HH:MM for comparison
  const t = timeStr.slice(0, 5)
  const s = start.slice(0, 5)
  const e = end.slice(0, 5)
  return t >= s && t <= e
}

export async function getActiveMenuItems(
  restaurantId: string,
  plan: string
): Promise<MenuItemWithDiscount[]> {
  const supabase = createServiceClient()
  const { dayOfWeek, timeStr } = getAthensNow()

  // ── 1. Fetch all menus for the restaurant ──────────────────────────────────
  const { data: menus, error: menusError } = await supabase
    .from('menus')
    .select('id, is_default, menu_schedules(id, day_of_week, start_time, end_time)')
    .eq('restaurant_id', restaurantId)

  if (menusError || !menus) {
    throw new Error(`Failed to fetch menus: ${menusError?.message}`)
  }

  // ── 2. Determine which menu IDs to use ────────────────────────────────────
  let activeMenuIds: string[]

  if (plan !== 'pro') {
    // Non-pro: always use the default menu only
    const defaultMenu = menus.find(m => m.is_default)
    activeMenuIds = defaultMenu ? [defaultMenu.id] : []
  } else {
    // Pro: find menus whose schedule matches current day + time
    type ScheduleRow = { id: string; day_of_week: number; start_time: string; end_time: string }
    const scheduledMenuIds = menus
      .filter(m => !m.is_default)
      .filter(m => {
        const schedules = (m.menu_schedules ?? []) as ScheduleRow[]
        return schedules.some(
          s => s.day_of_week === dayOfWeek && isTimeInRange(timeStr, s.start_time, s.end_time)
        )
      })
      .map(m => m.id)

    if (scheduledMenuIds.length > 0) {
      activeMenuIds = scheduledMenuIds
    } else {
      // No schedule matches → merge all menus
      activeMenuIds = menus.map(m => m.id)
    }
  }

  if (activeMenuIds.length === 0) {
    return []
  }

  // ── 3. Fetch item assignments for active menus ────────────────────────────
  const { data: assignments, error: assignmentsError } = await supabase
    .from('menu_item_assignments')
    .select('menu_item_id, available, display_order')
    .in('menu_id', activeMenuIds)

  if (assignmentsError) {
    throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`)
  }

  if (!assignments || assignments.length === 0) {
    return []
  }

  // Deduplicate by menu_item_id — keep first occurrence (lowest display_order wins)
  const seenItems = new Map<string, { available: boolean; display_order: number }>()
  for (const a of assignments) {
    if (!seenItems.has(a.menu_item_id)) {
      seenItems.set(a.menu_item_id, { available: a.available, display_order: a.display_order })
    }
  }

  const itemIds = Array.from(seenItems.keys())

  // ── 4. Fetch menu items (exclude soft-deleted) ────────────────────────────
  const { data: items, error: itemsError } = await supabase
    .from('menu_items')
    .select(
      'id, name_el, name_en, description_el, description_en, price, image_url, type, allergens, dietary, category_id, deleted_at'
    )
    .in('id', itemIds)
    .is('deleted_at', null)

  if (itemsError) {
    throw new Error(`Failed to fetch menu items: ${itemsError.message}`)
  }

  if (!items || items.length === 0) {
    return []
  }

  // ── 5. Fetch happy hour rules + assignments ────────────────────────────────
  const { data: happyHourRules } = await supabase
    .from('happy_hour_rules')
    .select('id, label_el, label_en, discount_type, discount_value, day_of_week, start_time, end_time')
    .eq('restaurant_id', restaurantId)

  // Find rules active right now
  type HHRule = {
    id: string
    label_el: string | null
    label_en: string | null
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    day_of_week: number[]
    start_time: string
    end_time: string
  }

  const activeRules: HHRule[] = (happyHourRules ?? []).filter(
    r =>
      (r.day_of_week as number[]).includes(dayOfWeek) &&
      isTimeInRange(timeStr, r.start_time, r.end_time)
  )

  // Build a map: menu_item_id → best discount rule
  const itemDiscountMap = new Map<
    string,
    { discounted_price: number; label_el: string | null; label_en: string | null }
  >()

  if (activeRules.length > 0) {
    const ruleIds = activeRules.map(r => r.id)
    const { data: hhAssignments } = await supabase
      .from('happy_hour_item_assignments')
      .select('rule_id, menu_item_id')
      .in('rule_id', ruleIds)

    // Build rule lookup
    const ruleMap = new Map(activeRules.map(r => [r.id, r]))

    for (const assignment of hhAssignments ?? []) {
      const rule = ruleMap.get(assignment.rule_id)
      if (!rule) continue

      // Find the item's base price
      const item = items.find(i => i.id === assignment.menu_item_id)
      if (!item) continue

      const basePrice = Number(item.price)
      let discountedPrice: number
      if (rule.discount_type === 'percentage') {
        discountedPrice = Math.round(basePrice * (1 - rule.discount_value / 100) * 100) / 100
      } else {
        discountedPrice = Math.round(Math.max(0, basePrice - rule.discount_value) * 100) / 100
      }

      // Keep whichever discount gives the lower final price
      const existing = itemDiscountMap.get(assignment.menu_item_id)
      if (!existing || discountedPrice < existing.discounted_price) {
        itemDiscountMap.set(assignment.menu_item_id, {
          discounted_price: discountedPrice,
          label_el: rule.label_el,
          label_en: rule.label_en,
        })
      }
    }
  }

  // ── 6. Build result ───────────────────────────────────────────────────────
  return items.map(item => {
    const assignment = seenItems.get(item.id)
    const discount = itemDiscountMap.get(item.id)

    return {
      id: item.id,
      name_el: item.name_el ?? null,
      name_en: item.name_en ?? null,
      description_el: item.description_el ?? null,
      description_en: item.description_en ?? null,
      price: Number(item.price),
      discounted_price: discount?.discounted_price ?? null,
      happy_hour_label_el: discount?.label_el ?? null,
      happy_hour_label_en: discount?.label_en ?? null,
      image_url: item.image_url ?? null,
      type: item.type as 'food' | 'drink',
      allergens: (item.allergens as string[]) ?? [],
      dietary: (item.dietary as string[]) ?? [],
      category_id: item.category_id ?? null,
      available: assignment?.available ?? true,
    }
  })
}
