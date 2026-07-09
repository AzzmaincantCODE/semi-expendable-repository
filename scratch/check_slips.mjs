import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jiusoksloniuozxrdiok.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdXNva3Nsb25pdW96eHJkaW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNTE0OTcsImV4cCI6MjA3MjcyNzQ5N30.lWiuA4leNFisvHD6yfEtczqk9kDXJhtCpmY5PfKqjJ8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSlips() {
    console.log('Checking custodian slips in Supabase...');
    const { data, count, error } = await supabase
        .from('custodian_slips')
        .select('*', { count: 'exact' });
    
    if (error) {
        console.error('Error fetching slips:', error);
    } else {
        console.log(`Found ${count} slips.`);
        if (data && data.length > 0) {
            console.log('Sample slips:', data.slice(0, 5).map(s => ({ id: s.id, number: s.slip_number, custodian: s.custodian_name })));
        } else {
            console.log('No slips found in the table.');
        }
    }

    console.log('\nChecking custodian slip items...');
    const { count: itemCount, error: itemError } = await supabase
        .from('custodian_slip_items')
        .select('*', { count: 'exact', head: true });
    
    if (itemError) {
        console.error('Error fetching slip items:', itemError);
    } else {
        console.log(`Found ${itemCount} slip items.`);
    }
}

checkSlips();
