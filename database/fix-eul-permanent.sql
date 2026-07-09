-- ============================================================
-- PERMANENT FIX: Remove ALL automated EUL defaults from the database
-- 
-- PROBLEM: The database has a DEFAULT value on the estimated_useful_life
-- column (likely '5 years' or 5). When new items are inserted and the
-- frontend doesn't explicitly send an EUL value, the database silently
-- fills in this default. This overrides the user's intended empty or
-- custom EUL from the PO form.
--
-- SOLUTION: Drop every default on estimated_useful_life columns so
-- the database NEVER auto-fills. The only EUL that appears will be
-- whatever the user explicitly typed.
-- ============================================================

-- 1. Remove DEFAULT on inventory_items.estimated_useful_life
ALTER TABLE public.inventory_items
  ALTER COLUMN estimated_useful_life DROP DEFAULT;

-- 2. Remove DEFAULT on custodian_slip_items.estimated_useful_life  
ALTER TABLE public.custodian_slip_items
  ALTER COLUMN estimated_useful_life DROP DEFAULT;

-- 3. Remove DEFAULT on purchase_order_items.estimated_useful_life
ALTER TABLE public.purchase_order_items
  ALTER COLUMN estimated_useful_life DROP DEFAULT;

-- 4. Do NOT drop the legacy override column. It is referenced by views.
--    Instead, we've updated the frontend to ignore it. 
--    Checking and managing view dependencies is unnecessary if we leave it.

-- ============================================================
-- 5. DATA CLEANUP: Fix any existing items that got the wrong EUL
--    from the old database default.
--
--    This updates items that have EUL = '5' or '5 years' but were
--    stocked in from a PO where the user actually typed something
--    different (or nothing at all).
-- ============================================================

-- 5a. Null out EUL on inventory items where the linked PO item has no EUL
--     (meaning the user never intended to set one)
UPDATE public.inventory_items inv
SET estimated_useful_life = NULL
WHERE inv.estimated_useful_life IS NOT NULL
  AND inv.id IN (
    SELECT unnest(poi.inventory_item_ids)
    FROM public.purchase_order_items poi
    WHERE (poi.estimated_useful_life IS NULL OR poi.estimated_useful_life = '')
  );

-- 5b. Sync EUL from PO items to inventory items where the PO had an explicit EUL
--     but inventory somehow got the wrong value
UPDATE public.inventory_items inv
SET estimated_useful_life = poi.estimated_useful_life
FROM public.purchase_order_items poi
WHERE inv.id = ANY(poi.inventory_item_ids)
  AND poi.estimated_useful_life IS NOT NULL
  AND poi.estimated_useful_life != ''
  AND inv.estimated_useful_life IS DISTINCT FROM poi.estimated_useful_life;

-- 5c. Cascade corrected EUL from inventory to custodian_slip_items
UPDATE public.custodian_slip_items csi
SET estimated_useful_life = inv.estimated_useful_life
FROM public.inventory_items inv
WHERE csi.inventory_item_id = inv.id
  AND csi.estimated_useful_life IS DISTINCT FROM inv.estimated_useful_life;

-- ============================================================
-- 6. VERIFICATION: Check results
-- ============================================================
SELECT 'inventory_items' AS source, 
       estimated_useful_life, 
       COUNT(*) AS item_count
FROM public.inventory_items
WHERE estimated_useful_life IS NOT NULL
GROUP BY estimated_useful_life
ORDER BY item_count DESC;

SELECT 'custodian_slip_items' AS source,
       estimated_useful_life,
       COUNT(*) AS item_count
FROM public.custodian_slip_items
WHERE estimated_useful_life IS NOT NULL
GROUP BY estimated_useful_life
ORDER BY item_count DESC;
  