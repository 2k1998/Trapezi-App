import { createClient } from '@/lib/supabase/server'
import { InactivityProvider } from '@/components/providers/InactivityProvider'

export default async function CashierLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, metadata')
    .eq('slug', slug)
    .single()

  const logo = ((restaurant?.metadata as Record<string, unknown> | null)?.branding ??
    {}) as { logo_url?: string | null }

  let staffRole: string = 'cashier'
  let staffId = user?.id ?? ''
  if (user && restaurant?.id) {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, role')
      .eq('id', user.id)
      .eq('restaurant_id', restaurant.id)
      .single()

    if (staff?.id) staffId = staff.id
    if (staff?.role) staffRole = staff.role
  }

  const firstName =
    typeof user?.email === 'string' && user.email.length > 0 ? user.email.split('@')[0] : 'Staff'

  if (!restaurant?.id || !staffId) return children

  return (
    <InactivityProvider
      restaurantId={restaurant.id}
      slug={slug}
      staffId={staffId}
      role={staffRole}
      firstName={firstName}
      logoUrl={logo.logo_url ?? null}
    >
      {children}
    </InactivityProvider>
  )
}
