import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const args = process.argv.slice(2)
const emailIndex = args.indexOf('--email')
const passwordIndex = args.indexOf('--password')

const email = emailIndex !== -1 ? args[emailIndex + 1] : undefined
const password = passwordIndex !== -1 ? args[passwordIndex + 1] : undefined

if (!email || !password) {
  console.log('Usage: npx tsx scripts/create-admin.ts --email <email> --password <password>')
  process.exit(1)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Check your .env.local file.')
  process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

async function main() {
  // Check if an admin already exists
  const { data: existing } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('role', 'admin')
    .maybeSingle()

  if (existing) {
    console.log('ℹ️  Admin already exists. No action taken.')
    process.exit(0)
  }

  // Create Supabase Auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('❌ Failed to create auth user:', authError?.message)
    process.exit(1)
  }

  // Insert staff row
  const { error: staffError } = await supabaseAdmin.from('staff').insert({
    id: authData.user.id,
    email,
    display_name: 'Kostas',
    role: 'admin',
    restaurant_id: null,
  })

  if (staffError) {
    console.error('❌ Failed to insert staff row:', staffError.message)
    // Attempt to clean up the auth user we just created
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    process.exit(1)
  }

  console.log('✅ Admin account created')
  console.log(`Email: ${email}`)
  console.log('You can now log in at dashboard.trapeziapp.com/login')
}

main()
