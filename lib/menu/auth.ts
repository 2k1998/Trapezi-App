import { createClient } from '@/lib/supabase/server'

export type StaffSession = {
  userId: string
  restaurantId: string
  role: string
}

type AuthResult =
  | { ok: true; session: StaffSession }
  | { ok: false; status: 401 | 403 }

/**
 * Verify the requester is authenticated staff.
 * Pass expectedRestaurantId to also verify they belong to that restaurant.
 * Pass requireOwner = true to additionally enforce role = 'owner'.
 * Pass requireOwnerOrManager = true to enforce role IN ('owner', 'manager').
 */
export async function requireStaff(
  expectedRestaurantId?: string,
  requireOwner = false,
  requireOwnerOrManager = false
): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { ok: false, status: 401 }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('restaurant_id, role')
    .eq('id', user.id)
    .single()

  if (!staffRow) return { ok: false, status: 401 }

  if (expectedRestaurantId && staffRow.restaurant_id !== expectedRestaurantId) {
    return { ok: false, status: 403 }
  }

  if (requireOwner && staffRow.role !== 'owner') {
    return { ok: false, status: 403 }
  }

  if (requireOwnerOrManager && !['owner', 'manager'].includes(staffRow.role as string)) {
    return { ok: false, status: 403 }
  }

  return {
    ok: true,
    session: {
      userId: user.id,
      restaurantId: staffRow.restaurant_id as string,
      role: staffRow.role as string,
    },
  }
}
