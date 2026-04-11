import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/"/g, '');
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/"/g, '');

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('master').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]).join(', '));
    } else {
        const { error: error2 } = await supabase.from('master').select('id').limit(1);
        if (error2) {
             console.log('Error checking id column:', error2.message);
        } else {
             console.log('id column exists');
        }
    }
}

check();
