-- Fix legacy auto-filled EUL values (e.g., "5 years") on inventory + ICS rows
-- Run in Supabase SQL Editor.
-- This only targets PO-stocked items where PO EUL is blank, so intentional EUL stays intact.

-- 1) Normalize helper set for legacy auto-filled values
-- We treat these as suspicious only for rows that came from PO items with blank EUL.
WITH po_blank_eul_items AS (
  SELECT DISTINCT unnest(poi.inventory_item_ids) AS inventory_item_id
  FROM public.purchase_order_items poi
  WHERE COALESCE(TRIM(poi.estimated_useful_life), '') = ''
)
UPDATE public.inventory_items inv
SET estimated_useful_life = NULL
FROM po_blank_eul_items p
WHERE inv.id = p.inventory_item_id
  AND LOWER(TRIM(COALESCE(inv.estimated_useful_life, ''))) IN ('5', '5y', '5 yr', '5 yrs', '5 year', '5 years');

-- 2) Clear matching EUL values already copied into ICS rows
WITH po_blank_eul_items AS (
  SELECT DISTINCT unnest(poi.inventory_item_ids) AS inventory_item_id
  FROM public.purchase_order_items poi
  WHERE COALESCE(TRIM(poi.estimated_useful_life), '') = ''
)
UPDATE public.custodian_slip_items csi
SET estimated_useful_life = NULL
FROM po_blank_eul_items p
WHERE csi.inventory_item_id = p.inventory_item_id
  AND LOWER(TRIM(COALESCE(csi.estimated_useful_life, ''))) IN ('5', '5y', '5 yr', '5 yrs', '5 year', '5 years');

-- 3) Safety: ensure defaults cannot auto-fill EUL in future inserts
ALTER TABLE public.inventory_items
  ALTER COLUMN estimated_useful_life DROP DEFAULT;

ALTER TABLE public.custodian_slip_items
  ALTER COLUMN estimated_useful_life DROP DEFAULT;

ALTER TABLE public.purchase_order_items
  ALTER COLUMN estimated_useful_life DROP DEFAULT;

-- 4) Quick verification
SELECT 'inventory_items' AS source, estimated_useful_life, COUNT(*) AS count
FROM public.inventory_items
GROUP BY estimated_useful_life
ORDER BY count DESC;

SELECT 'custodian_slip_items' AS source, estimated_useful_life, COUNT(*) AS count
FROM public.custodian_slip_items
GROUP BY estimated_useful_life
ORDER BY count DESC;
