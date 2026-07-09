import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data, error } = await supabase
        .from('custodian_slips')
        .select(`
            id,
            slip_number,
            custodian_name,
            designation,
            custodian_slip_items (
                id,
                quantity,
                unit,
                unit_cost,
                amount,
                property_number,
                description,
                inventory_items (
                    category,
                    fund_source_id,
                    fund_sources ( name )
                )
            )
        `)
        .eq('slip_status', 'Issued')
        .limit(1);

    console.log(JSON.stringify(data, null, 2), error);
}

test();
