-- ============================================================
-- FULL CLEANUP: Wipe "5", "5 yrs", "5 years" from EUL columns
--
-- Since the old default was heavily polluting the database, 
-- this script will completely NULL out any EUL that matches 
-- '5', '5 yrs', or '5 years' across all relevant tables.
-- ============================================================

-- 1. Wipe from purchase_order_items
UPDATE public.purchase_order_items
SET estimated_useful_life = NULL
WHERE estimated_useful_life IN ('5', '5 yrs', '5 years', '5.0');

-- 2. Wipe from inventory_items
UPDATE public.inventory_items
SET estimated_useful_life = NULL
WHERE estimated_useful_life IN ('5', '5 yrs', '5 years', '5.0');

-- 3. Wipe from custodian_slip_items
UPDATE public.custodian_slip_items
SET estimated_useful_life = NULL
WHERE estimated_useful_life IN ('5', '5 yrs', '5 years', '5.0');

-- 4. Just to be absolutely sure the defaults are gone
ALTER TABLE public.inventory_items ALTER COLUMN estimated_useful_life DROP DEFAULT;
ALTER TABLE public.purchase_order_items ALTER COLUMN estimated_useful_life DROP DEFAULT;
ALTER TABLE public.custodian_slip_items ALTER COLUMN estimated_useful_life DROP DEFAULT;
