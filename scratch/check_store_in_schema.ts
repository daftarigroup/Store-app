import { supabase } from '../src/lib/supabase';

async function checkSchema() {
  const { data, error } = await supabase
    .from('store_in')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching store_in:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in store_in:', Object.keys(data[0]));
  } else {
    console.log('No data in store_in table to check columns.');
  }
}

checkSchema();
