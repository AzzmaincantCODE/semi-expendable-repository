import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 1. Read keys from .env.local
const env = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log(`\n🔍 AUDITING SUPABASE: ${supabaseUrl}`);
    console.log('==================================================');

    const tables = [
        'user_profiles',
        'departments',
        'inventory_items',
        'purchase_orders',
        'custodian_slips',
        'property_cards',
        'property_transfers'
    ];

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.log(`❌ ${table.padEnd(20)}: Error - ${error.message}`);
        } else {
            console.log(`✅ ${table.padEnd(20)}: ${count} records`);
        }
    }

    console.log('==================================================');
    console.log('If these counts are 0 but your website shows data,');
    console.log('you are likely in OFFLINE MODE or using local cache.\n');
}

runAudit();
