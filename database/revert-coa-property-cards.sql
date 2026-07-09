-- ==============================================================================
-- REVERT COA Property Card Consolidation
-- Restores the architecture back to strict 1:1 Property Card per Inventory Item
-- ==============================================================================

-- 1. Remove property_card_id from inventory_items
ALTER TABLE public.inventory_items
DROP COLUMN IF EXISTS property_card_id;

-- 2. Restore constraint on property_cards (if needed, but keeping it unconstrained might be safer to prevent immediate errors, but we typically want it tied to inventory_items)
-- Since we are reverting, we ensure new ones get inventory_item_id. We won't enforce NOT NULL right now to be safe with existing data, 
-- but you could do: ALTER TABLE public.property_cards ALTER COLUMN inventory_item_id SET NOT NULL; if you prefer.

-- We leave the data deletion to you (the user) manually via UI as requested.
