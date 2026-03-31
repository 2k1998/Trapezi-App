import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE URL or SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const accounts = [
  { email: 'kitchen@test.com', password: 'Test1234!', role: 'kitchen', display_name: 'Kitchen Staff' },
  { email: 'bar@test.com', password: 'Test1234!', role: 'bar', display_name: 'Bar Staff' },
  { email: 'cashier@test.com', password: 'Test1234!', role: 'cashier', display_name: 'Cashier' },
  { email: 'owner@test.com', password: 'Test1234!', role: 'owner', display_name: 'Owner' }
]

async function createTestStaff() {
  console.log('Fetching test restaurant id...')
  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .select('id')
    .eq('slug', 'test-restaurant')
    .single()

  if (rErr || !restaurant) {
    console.error('Restaurant "test-restaurant" not found. Run migrations and seed first.')
    process.exit(1)
  }

  for (const acc of accounts) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: acc.email,
      password: acc.password,
      email_confirm: true
    })

    if (authError) {
      if (authError.message.includes('already exists') || authError.message.includes('User already registered')) {
        console.warn(`[WARN] User ${acc.email} already exists. Skipping creation.`)
        continue
      }
      console.error(`Failed to create user ${acc.email}: ${authError.message}`)
      continue
    }

    if (authData.user) {
      const { error: insertError } = await supabase.from('staff').insert({
        id: authData.user.id,
        restaurant_id: restaurant.id,
        role: acc.role,
        display_name: acc.display_name,
        email: acc.email,
        is_active: true
      })

      if (insertError) {
        console.error(`Failed to insert staff row for ${acc.email}:`, insertError)
      } else {
        console.log(`Successfully created staff account: ${acc.email} (id: ${authData.user.id})`)
      }
    }
  }
}

createTestStaff().catch(err => {
  console.error("Script failed:", err)
  process.exit(1)
})
