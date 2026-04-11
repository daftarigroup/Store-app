import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
import fs from 'fs';

// Read .env.local or similar if exists
const envFile = fs.readFileSync('.env.local', 'utf8');
const url = envFile.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('master').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    console.log(JSON.stringify(data?.[0], null, 2));
}

check();
