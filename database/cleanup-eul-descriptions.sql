-- ============================================================
-- FIX: Remove hardcoded EUL from Property Card descriptions
--
-- PROBLEM: Previously, the system was appending "(EUL: 5 yrs)" 
-- or similar strings directly to the description field when 
-- auto-generating Property Cards during Stock-In.
-- Even though the backend logic was reverted, the previously 
-- generated Property Cards still have this unwanted text saved 
-- in their description columns in the database.
--
-- SOLUTION: This script cleans up the descriptions by removing 
-- the "(EUL: ...)" text from existing property cards.
-- ============================================================

-- Remove "(EUL: 5 yrs)", "(EUL: 5 years)", "(EUL: 5)" etc. from property card descriptions
UPDATE public.property_cards
SET description = REGEXP_REPLACE(description, '\s*\(EUL:[^)]+\)', '', 'ig')
WHERE description ~* '\(EUL:';

-- Also remove it from inventory_items just in case it got saved there too
UPDATE public.inventory_items
SET description = REGEXP_REPLACE(description, '\s*\(EUL:[^)]+\)', '', 'ig')
WHERE description ~* '\(EUL:';

-- Also remove it from purchase_order_items just in case
UPDATE public.purchase_order_items
SET description = REGEXP_REPLACE(description, '\s*\(EUL:[^)]+\)', '', 'ig')
WHERE description ~* '\(EUL:';
