import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/LoginForm'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!restaurant) {
    return { title: 'Login | Trapezi' }
  }

  const name =
    typeof restaurant.name === 'string'
      ? restaurant.name
      : 'Restaurant'

  return {
    title: `${name} — Login | Trapezi`,
  }
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, plan')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-brand-50 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-[400px] bg-white p-8 rounded-xl shadow-card text-center">
          <h1 className="font-display text-2xl font-semibold mb-2 text-brand-900">
            Restaurant not found
          </h1>
          <p className="text-sm text-brand-500">
            There is no active restaurant at this address.
          </p>
        </div>
      </div>
    )
  }

  return (
    <LoginForm
      slug={slug}
      restaurantId={restaurant.id}
      restaurantName={restaurant.name as string}
      restaurantPlan={restaurant.plan as string}
    />
  )
}
