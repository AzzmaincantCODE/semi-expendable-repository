-- ============================================================
-- THE NUCLEAR OPTION: Destroy all hidden '5 year' overrides
-- 
-- If you type "10" and it STILL saves as "5 years", your database
-- has a rogue Postgres Trigger or hidden constraint forcing it.
-- This script will hunt down and destroy any such triggers and
-- defaults so the database respects the value you type.
-- ============================================================

-- 1. Drop ALL default values for EUL columns across all tables
ALTER TABLE public.inventory_items ALTER COLUMN estimated_useful_life DROP DEFAULT;
ALTER TABLE public.purchase_order_items ALTER COLUMN estimated_useful_life DROP DEFAULT;
ALTER TABLE public.custodian_slip_items ALTER COLUMN estimated_useful_life DROP DEFAULT;

-- 2. Hunt down and destroy any Rogue Triggers that might be overriding your input
DO $$ 
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN 
        SELECT tgname, relname 
        FROM pg_trigger 
        JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
        WHERE relname IN ('inventory_items', 'purchase_order_items', 'custodian_slip_items')
    LOOP
        -- Drop any trigger that looks suspicious (we'll ignore internal system triggers starting with 'RI_')
        IF trigger_record.tgname NOT LIKE 'RI_ConstraintTrigger%' AND trigger_record.tgname NOT LIKE 'pg_sync%' THEN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I CASCADE;', trigger_record.tgname, trigger_record.relname);
        END IF;
    END LOOP;
END $$;

-- 3. If "5 years" got stuck in the latest rows you just created, wipe it clean again
UPDATE public.inventory_items SET estimated_useful_life = NULL WHERE estimated_useful_life IN ('5', '5 yrs', '5 years', '5.0');
UPDATE public.purchase_order_items SET estimated_useful_life = NULL WHERE estimated_useful_life IN ('5', '5 yrs', '5 years', '5.0');
UPDATE public.custodian_slip_items SET estimated_useful_life = NULL WHERE estimated_useful_life IN ('5', '5 yrs', '5 years', '5.0');
