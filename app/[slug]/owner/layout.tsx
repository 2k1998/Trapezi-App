import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OwnerRestaurantProvider } from '@/components/owner/owner-context'
import { InactivityProvider } from '@/components/providers/InactivityProvider'
import { OwnerLayoutBranding } from '@/components/owner/OwnerLayoutBranding'

export default async function OwnerLayout({
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

  if (!user) {
    redirect(`/${slug}/login`)
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('role, restaurant_id')
    .eq('id', user.id)
    .single()

  if (!staff || !['owner', 'manager'].includes(staff.role)) {
    redirect(`/${slug}/login`)
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(
      'id, name, slug, plan, currency, metadata, subscription_status, dunning_day, contract_start_date, current_period_end, stripe_customer_id, stripe_subscription_id'
    )
    .eq('id', staff.restaurant_id)
    .single()

  if (!restaurant || restaurant.slug !== slug) {
    redirect(`/${slug}/login`)
  }

  const restaurantName =
    typeof restaurant.name === 'string' ? restaurant.name : 'Restaurant'

  const ctx = {
    slug,
    restaurantId: restaurant.id,
    restaurantName,
    plan: restaurant.plan ?? 'free',
    currency: restaurant.currency ?? 'EUR',
    subscriptionStatus: (restaurant.subscription_status ?? 'active') as
      | 'active'
      | 'past_due'
      | 'cancelled',
    dunningDay: restaurant.dunning_day ?? 0,
    contractStartDate: restaurant.contract_start_date ?? null,
    currentPeriodEnd: restaurant.current_period_end ?? null,
    stripeCustomerId: restaurant.stripe_customer_id ?? null,
    stripeSubscriptionId: restaurant.stripe_subscription_id ?? null,
  }

  const logoUrl = ((restaurant.metadata as Record<string, unknown> | null)?.branding ??
    {}) as { logo_url?: string | null }
  const initialBranding = ((restaurant.metadata as Record<string, unknown> | null)?.branding ??
    null) as Record<string, unknown> | null

  const firstName =
    typeof user.email === 'string' && user.email.length > 0
      ? user.email.split('@')[0]
      : 'Owner'

  return (
    <OwnerRestaurantProvider value={ctx}>
      <InactivityProvider
        restaurantId={restaurant.id}
        slug={slug}
        staffId={user.id}
        role={staff.role}
        firstName={firstName}
        logoUrl={logoUrl.logo_url ?? null}
      >
        <OwnerLayoutBranding
          slug={slug}
          restaurantId={restaurant.id}
          restaurantName={restaurantName}
          plan={ctx.plan}
          initialBranding={
            initialBranding
              ? {
                  logo_url: (initialBranding.logo_url as string | null) ?? null,
                  accent_color: (initialBranding.accent_color as string | null) ?? null,
                  secondary_color: (initialBranding.secondary_color as string | null) ?? null,
                  font: (initialBranding.font as string | null) ?? null,
                  confirmation_message_en:
                    (initialBranding.confirmation_message_en as string | null) ?? null,
                  confirmation_message_el:
                    (initialBranding.confirmation_message_el as string | null) ?? null,
                  receipt_header: (initialBranding.receipt_header as string | null) ?? null,
                  receipt_footer: (initialBranding.receipt_footer as string | null) ?? null,
                }
              : null
          }
        >
          {children}
        </OwnerLayoutBranding>
      </InactivityProvider>
    </OwnerRestaurantProvider>
  )
}
