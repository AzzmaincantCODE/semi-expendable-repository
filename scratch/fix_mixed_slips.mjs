import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Parse .env or .env.local manually
let supabaseUrl = '';
let supabaseKey = '';

const envFiles = ['.env', '.env.local'];
for (const file of envFiles) {
  try {
    const envPath = path.join(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
        if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
      });
    }
  } catch (e) {
    // Ignore
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Could not find VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env or .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching slips...");
  const { data: slips, error: slipsError } = await supabase
    .from('custodian_slips')
    .select('*, custodian_slip_items(*, inventory_items(sub_category, semi_expandable_category, category))');

  if (slipsError) {
    console.error("Error fetching slips:", slipsError);
    return;
  }

  for (const slip of slips) {
    // Group items
    const itemsByGroup = {};
    for (const item of slip.custodian_slip_items) {
      const subCategory = item.inventory_items?.sub_category || 'Unknown';
      const category = item.inventory_items?.semi_expandable_category || item.inventory_items?.category || 'Unknown Category';
      const key = `${subCategory}:::${category}`;
      if (!itemsByGroup[key]) {
        itemsByGroup[key] = { subCategory, category, items: [] };
      }
      itemsByGroup[key].items.push(item);
    }

    const groupKeys = Object.keys(itemsByGroup);
    if (groupKeys.length > 1) {
      console.log(`Slip ${slip.slip_number} needs to be split into ${groupKeys.length} slips.`);
      
      // Keep the first group in the original slip
      const originalGroupKey = groupKeys[0];
      console.log(`  Keeping group ${originalGroupKey} in ${slip.slip_number}`);
      
      // For the rest, create new slips
      for (let i = 1; i < groupKeys.length; i++) {
        const { subCategory, category, items } = itemsByGroup[groupKeys[i]];
        console.log(`  Creating new slip for group ${groupKeys[i]} with ${items.length} items`);
        
        const subCategoryPrefix = subCategory === 'Small Value Expendable' ? 'SPLV' : 'SPHV';
        const { data: generatedNumber } = await supabase.rpc('generate_ics_number', { sub_category_prefix: subCategoryPrefix });
        
        console.log(`    Generated new number: ${generatedNumber}`);
        
        // 1. Create new slip
        const newSlipData = {
          slip_number: generatedNumber,
          custodian_name: slip.custodian_name,
          designation: slip.designation,
          office: slip.office,
          date_issued: slip.date_issued,
          issued_by: slip.issued_by,
          issued_by_position: slip.issued_by_position,
          received_by: slip.received_by,
          slip_status: slip.slip_status,
          created_at: slip.created_at
        };
        const { data: newSlip, error: newSlipError } = await supabase.from('custodian_slips').insert(newSlipData).select().single();
        if (newSlipError) {
          console.error("Error creating slip:", newSlipError);
          continue;
        }
        
        const itemIds = items.map(item => item.id);
        const invItemIds = items.map(item => item.inventory_item_id);
        
        // 2. Update custodian_slip_items
        const { error: csiError } = await supabase.from('custodian_slip_items').update({ slip_id: newSlip.id }).in('id', itemIds);
        if (csiError) console.error("Error updating items:", csiError);
        
        // 3. Update property_card_entries
        const { data: pcEntries } = await supabase.from('property_card_entries').select('id').eq('related_slip_id', slip.id).in('inventory_item_id', invItemIds);
        if (pcEntries && pcEntries.length > 0) {
          const entryIds = pcEntries.map(e => e.id);
          const { error: pceError } = await supabase.from('property_card_entries').update({
            related_slip_id: newSlip.id,
            reference: `ICS ${generatedNumber}`,
            remarks: `Issued via ICS ${generatedNumber}`
          }).in('id', entryIds);
          if (pceError) console.error("Error updating card entries:", pceError);
        }
        
        // 4. Update inventory_items
        const { error: iiError } = await supabase.from('inventory_items').update({
          ics_number: generatedNumber
        }).in('id', invItemIds);
        if (iiError) console.error("Error updating inventory items:", iiError);
        
        console.log(`    Done splitting ${groupKeys[i]} into ${generatedNumber}`);
      }
    }
  }
  
  console.log("Migration complete!");
}

run().catch(console.error);
