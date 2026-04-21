import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase env vars")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function getCols() {
  const { data, error } = await supabase.from('inventory').select('*').limit(1)
  if (error) {
    console.error(error)
  } else {
    console.log(JSON.stringify(data?.[0] || {}, null, 2))
  }
}

getCols()
