import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminShell } from '@/components/admin/AdminShell'

export default async function AdminRestaurantsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('display_name, role')
    .eq('id', session.user.id)
    .single()

  if (!staff || staff.role !== 'admin') {
    redirect('/login')
  }

  return <AdminShell adminName={staff.display_name || 'Admin'}>{children}</AdminShell>
}
