declare var process: { env: { [key: string]: string | undefined } };
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function checkPoMasterSchema() {
    const { data, error } = await supabase.from('po_master').select('*').limit(1);
    if (error) {
        console.error(error);
        return;
    }
    if (data && data.length > 0) {
        console.log('SAMPLE RECORD KEYS:', Object.keys(data[0]));
        console.log('SAMPLE RECORD VALUES:', data[0]);
    } else {
        console.log('No records found in po_master table');
    }
}

checkPoMasterSchema();
