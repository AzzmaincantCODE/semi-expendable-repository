import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jiusoksloniuozxrdiok.supabase.co';
const supabaseKey = 'YOUR_KEY_HERE'; // I'll need to find the key in the project

async function checkColumns() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.rpc('debug_get_columns', { table_name: 'custodian_slip_items' });
  if (error) {
    // If RPC doesn't exist, try a simple select
    const { data: selectData, error: selectError } = await supabase
      .from('custodian_slip_items')
      .select('*')
      .limit(1);
    
    if (selectError) {
      console.error('Error fetching data:', selectError);
    } else if (selectData && selectData.length > 0) {
      console.log('Columns found:', Object.keys(selectData[0]));
    } else {
      console.log('No data found in custodian_slip_items to infer columns.');
    }
  } else {
    console.log('Columns:', data);
  }
}

checkColumns();
