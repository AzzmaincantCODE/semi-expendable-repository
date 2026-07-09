import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jiusoksloniuozxrdiok.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdXNva3Nsb25pdW96eHJkaW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNTE0OTcsImV4cCI6MjA3MjcyNzQ5N30.lWiuA4leNFisvHD6yfEtczqk9kDXJhtCpmY5PfKqjJ8';

async function checkColumns() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('Fetching first row from custodian_slip_items...');
  const { data, error } = await supabase
    .from('custodian_slip_items')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error fetching data:', error);
  } else if (data && data.length > 0) {
    console.log('Columns found in custodian_slip_items:', Object.keys(data[0]));
  } else {
    console.log('No data found in custodian_slip_items. Trying to fetch from property_cards...');
    const { data: pcData, error: pcError } = await supabase
      .from('property_cards')
      .select('*')
      .limit(1);
    if (pcData && pcData.length > 0) {
        console.log('Columns found in property_cards:', Object.keys(pcData[0]));
    }
  }
}

checkColumns();
