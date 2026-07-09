-- Backfill missing inventory_item_id on transfer_items
-- This fixes the issue where transferred items appear under "UNCATEGORIZED" in the Registry
-- because the system couldn't link the transfer to the actual inventory item data.

UPDATE transfer_items ti
SET inventory_item_id = ii.id
FROM inventory_items ii
WHERE ti.inventory_item_id IS NULL
  AND ti.property_number = ii.property_number;
