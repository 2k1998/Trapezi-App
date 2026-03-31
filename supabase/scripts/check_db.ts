import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  console.log('Checking restaurants...')
  const { data: restaurants, error: rError } = await supabase
    .from('restaurants')
    .select('name')
  
  if (rError) {
    console.error('Error fetching restaurants:', rError.message)
    return
  }

  if (restaurants && restaurants.length > 0) {
    console.log(`Found ${restaurants.length} restaurants. First: ${restaurants[0].name}`)
  } else {
    console.log('No restaurants found. The seed data is NOT in the database.')
  }

  console.log('Checking menu items...')
  const { data: menuItems, error: mError } = await supabase
    .from('menu_items')
    .select('id')
    
  if (!mError && menuItems) {
    console.log(`Found ${menuItems.length} menu items.`)
  }
}

checkDatabase().catch(console.error)
