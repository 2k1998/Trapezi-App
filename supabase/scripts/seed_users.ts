import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE URL or SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.trim()
if (supabaseUrl.includes("supabase.com/dashboard")) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL must be your project API URL, e.g. https://YOUR_PROJECT_REF.supabase.co\n" +
      "Do not use the dashboard link (supabase.com/dashboard/project/...). Find API URL under Project Settings → API."
  )
  process.exit(1)
}
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/** Resolve auth user id by email when createUser hits "already registered". */
async function getAuthUserIdByEmail(email: string): Promise<string | null> {
  const perPage = 200
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.error('listUsers failed:', error.message)
      return null
    }
    const users = data.users ?? []
    const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id
    if (users.length < perPage) break
  }
  return null
}

async function seedUsers() {
  console.log("Fetching test restaurant...")
  const { data: restaurant, error: rError } = await supabase
    .from('restaurants')
    .select('id')
    .eq('slug', 'test-restaurant')
    .single()
  
  if (rError || !restaurant) {
    console.error('Test restaurant not found! Make sure you ran seed.sql.', rError?.message)
    return
  }
  
  const usersToCreate = [
    { email: 'cashier@test.com', password: 'testpassword123', role: 'cashier', displayName: 'Main Cashier' },
    { email: 'owner@test.com', password: 'testpassword123', role: 'owner', displayName: 'Restaurant Owner' }
  ]
  
  for (const u of usersToCreate) {
    console.log(`Creating auth user for ${u.email}...`)
    // Create the user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true
    })
    
    let userId;

    if (authError) {
      const duplicate =
        authError.message.includes('already been registered') ||
        authError.message.includes('already registered') ||
        authError.status === 422
      if (duplicate) {
        console.log(`User ${u.email} already exists in auth.users, resolving id...`)
        userId = await getAuthUserIdByEmail(u.email)
        if (!userId) {
          console.error(
            `Could not find user id for ${u.email}. Check Authentication → Users in the dashboard.`
          )
          continue
        }
      } else {
        console.error(`Error creating auth user ${u.email}:`, authError.message)
        continue
      }
    } else {
      userId = authData?.user?.id
    }

    if (!userId) {
      console.error(`Failed to get user ID for ${u.email}`)
      continue
    }
    
    console.log(`Inserting into public.staff for ${u.email}...`)
    // Insert into staff table
    const { error: staffError } = await supabase.from('staff').upsert({
      id: userId,
      restaurant_id: restaurant.id,
      role: u.role,
      display_name: u.displayName,
      email: u.email,
      is_active: true
    })
    
    if (staffError) {
      console.error(`Error inserting into staff table for ${u.email}:`, staffError.message)
    } else {
      console.log(`Successfully created staff account: ${u.email} (${u.role})`)
    }
  }
  
  console.log('Finished seeding users!')
}

seedUsers().catch(console.error)
