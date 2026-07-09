-- Migration: Add EUL and Serial Number to PO and Inventory Items
-- This script ensures all tables have the necessary columns for the dynamic EUL system.

-- 1. Update purchase_order_items
DO $$ 
BEGIN 
    -- estimated_useful_life
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'estimated_useful_life') THEN
        ALTER TABLE purchase_order_items ADD COLUMN estimated_useful_life TEXT;
    END IF;

    -- serial_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'serial_number') THEN
        ALTER TABLE purchase_order_items ADD COLUMN serial_number TEXT;
    END IF;

    -- semi_expandable_category
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_order_items' AND column_name = 'semi_expandable_category') THEN
        ALTER TABLE purchase_order_items ADD COLUMN semi_expandable_category TEXT;
    END IF;
END $$;

-- 2. Update inventory_items
DO $$ 
BEGIN 
    -- estimated_useful_life
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'estimated_useful_life') THEN
        ALTER TABLE inventory_items ADD COLUMN estimated_useful_life TEXT;
    END IF;

    -- serial_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'serial_number') THEN
        ALTER TABLE inventory_items ADD COLUMN serial_number TEXT;
    END IF;
    
    -- ics_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'ics_number') THEN
        ALTER TABLE inventory_items ADD COLUMN ics_number TEXT;
    END IF;

    -- ics_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'ics_date') THEN
        ALTER TABLE inventory_items ADD COLUMN ics_date DATE;
    END IF;
END $$;

-- 3. Update custodian_slip_items
DO $$ 
BEGIN 
    -- estimated_useful_life
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'custodian_slip_items' AND column_name = 'estimated_useful_life') THEN
        ALTER TABLE custodian_slip_items ADD COLUMN estimated_useful_life TEXT;
    END IF;
END $$;

COMMENT ON COLUMN purchase_order_items.estimated_useful_life IS 'Estimated useful life of the item (e.g. 5 years, 2 years)';
COMMENT ON COLUMN purchase_order_items.serial_number IS 'Serial number(s) of the item';
COMMENT ON COLUMN inventory_items.estimated_useful_life IS 'Estimated useful life (persisted value)';
