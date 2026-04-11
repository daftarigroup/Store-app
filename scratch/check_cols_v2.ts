import { createClient } from '@supabase/supabase-js';

const url = "https://slgsuypjaafyylfytbei.supabase.co";
const key = "sb_publishable_kVxXNaisn4eECQxcdgNuqQ_nWuhL7Gl";

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('master').select('*').limit(1);
    if (error) {
        console.error('Error fetching:', error.message);
        return;
    }
    if (data && data.length > 0) {
        console.log('Keys:', Object.keys(data[0]).join(', '));
    } else {
        console.log('Table is empty');
    }
}

check();
