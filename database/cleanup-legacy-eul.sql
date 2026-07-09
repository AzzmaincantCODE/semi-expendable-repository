-- Migration: Cleanup Legacy EUL Strings (SAFE)
-- This script normalizes existing explicit "5 years" / "5y" text into "5".
-- IMPORTANT: It intentionally does NOT fill NULL EUL values.
-- Run this in the Supabase SQL Editor.

-- 1. Update custodian_slip_items
UPDATE custodian_slip_items
SET estimated_useful_life = '5'
WHERE estimated_useful_life ILIKE '%5 year%'
   OR estimated_useful_life ILIKE '%5y%';

-- 2. Update inventory_items
UPDATE inventory_items
SET estimated_useful_life = '5'
WHERE estimated_useful_life ILIKE '%5 year%'
   OR estimated_useful_life ILIKE '%5y%';

-- 3. Update purchase_order_items
UPDATE purchase_order_items
SET estimated_useful_life = '5'
WHERE estimated_useful_life ILIKE '%5 year%'
   OR estimated_useful_life ILIKE '%5y%';

COMMENT ON COLUMN inventory_items.estimated_useful_life IS 'User-provided EUL text; null when not provided';
