-- SQL Migration for Returns (Annex A.6: RRSP)
-- Run this in your Supabase SQL Editor

-- 1. Create return_slips table
CREATE TABLE IF NOT EXISTS public.return_slips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rrsp_number TEXT UNIQUE NOT NULL,
  entity_name TEXT NOT NULL,
  date DATE NOT NULL,
  returned_by TEXT NOT NULL,
  returned_by_designation TEXT,
  received_by TEXT NOT NULL,
  received_by_designation TEXT,
  status TEXT DEFAULT 'Completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create return_slip_items table
CREATE TABLE IF NOT EXISTS public.return_slip_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_slip_id UUID REFERENCES public.return_slips(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  item_description TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  ics_number TEXT,
  end_user TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.return_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_slip_items ENABLE ROW LEVEL SECURITY;

-- 4. Add policies
DROP POLICY IF EXISTS "Allow all for return_slips" ON public.return_slips;
CREATE POLICY "Allow all for return_slips" ON public.return_slips FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for return_slip_items" ON public.return_slip_items;
CREATE POLICY "Allow all for return_slip_items" ON public.return_slip_items FOR ALL USING (true);

-- 5. Function to generate RRSP number
CREATE OR REPLACE FUNCTION public.generate_rrsp_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  current_month TEXT;
  new_seq INTEGER;
  new_number TEXT;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  current_month := TO_CHAR(NOW(), 'MM');
  
  -- Simple sequence based on count of records this month/year
  SELECT COUNT(*) + 1 INTO new_seq 
  FROM public.return_slips 
  WHERE date_trunc('month', created_at) = date_trunc('month', NOW());
  
  new_number := 'RRSP-' || current_year || '-' || current_month || '-' || LPAD(new_seq::TEXT, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
