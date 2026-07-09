-- ==============================================================================
-- COA Property Card Consolidation Migration
-- Changes the architecture from 1 Property Card per Inventory Item 
-- to 1 Property Card per Item Type (Class of PPE).
-- ==============================================================================

-- 1. Add property_card_id to inventory_items
ALTER TABLE public.inventory_items
ADD COLUMN property_card_id UUID REFERENCES public.property_cards(id) ON DELETE SET NULL;

-- 2. Relax the constraint on property_cards
-- (It previously expected an inventory_item_id to be NOT NULL if it was set up that way)
ALTER TABLE public.property_cards
ALTER COLUMN inventory_item_id DROP NOT NULL;

-- Optional index for faster lookups when finding which items belong to a card
CREATE INDEX IF NOT EXISTS idx_inventory_items_property_card 
ON public.inventory_items(property_card_id);

-- Optional index for lookups by description + fund cluster to find existing property cards
CREATE INDEX IF NOT EXISTS idx_property_cards_desc_fund 
ON public.property_cards(description, fund_cluster);
