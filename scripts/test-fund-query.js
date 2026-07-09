import { createClient } from '@supabase/supabase-js';

const url = 'https://jiusoksloniuozxrdiok.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdXNva3Nsb25pdW96eHJkaW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNTE0OTcsImV4cCI6MjA3MjcyNzQ5N30.lWiuA4leNFisvHD6yfEtczqk9kDXJhtCpmY5PfKqjJ8';
const supabase = createClient(url, key);

async function main() {
  console.log('--- TESTING CONNECTION (SUPPLIERS) ---');
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Suppliers:', JSON.stringify(suppliers, null, 2));
  }

  console.log('\n--- PROPERTY CARDS ---');
  const { data: cards } = await supabase
    .from('property_cards')
    .select('property_number, fund_cluster')
    .limit(5);
  console.log('Cards:', JSON.stringify(cards, null, 2));
}

await main();
process.exit(0);
