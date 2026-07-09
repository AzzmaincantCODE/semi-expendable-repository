const { supabase } = require('./src/lib/supabase'); // Assuming node script can't access this directly without TS transpilation

// Fallback: write a node script using the raw supabase URL and key
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const client = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking PO items with estimated useful life...");
  
  // Find all items that have "years" in the eul
  const { data: poItems } = await client
    .from('purchase_order_items')
    .select('*')
    .ilike('estimated_useful_life', '%5%');
    
  console.log('PO Items:', poItems);
  
  // Check inventory
  const { data: invItems } = await client
    .from('inventory_items')
    .select('id, property_number, estimated_useful_life')
    .ilike('estimated_useful_life', '%5%')
    .limit(5);
    
  console.log('Inv Items:', invItems);

  // Check custodian items
  const { data: slipItems } = await client
    .from('custodian_slip_items')
    .select('id, property_number, estimated_useful_life')
    .ilike('estimated_useful_life', '%5%')
    .limit(5);
    
  console.log('Slip Items:', slipItems);
}

run();
