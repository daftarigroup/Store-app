import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: storeIn } = await supabase.from('store_in').select('*').limit(1)
  console.log('Store In:', JSON.stringify(storeIn?.[0] || {}, null, 2))

  const { data: issue } = await supabase.from('issue').select('*').limit(1)
  console.log('Issue:', JSON.stringify(issue?.[0] || {}, null, 2))
}

check()
