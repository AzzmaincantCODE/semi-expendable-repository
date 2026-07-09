// Test file to verify Supabase connection
import { supabase } from './lib/supabase';

console.log('Supabase client created successfully:', !!supabase);
console.log('Supabase URL:', supabase.supabaseUrl);
console.log('Supabase Key (first 10 chars):', supabase.supabaseKey.substring(0, 10) + '...');

// Test a simple query
supabase
  .from('departments')
  .select('count')
  .then(({ data, error }) => {
    if (error) {
      console.log('Database connection test failed:', error.message);
    } else {
      console.log('Database connection test successful!');
    }
  })
  .catch((err) => {
    console.log('Database connection error:', err.message);
  });
