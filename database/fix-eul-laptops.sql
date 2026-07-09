-- PERMANENT FIX for EUL (Estimated Useful Life) Sync Issue
-- This script explicitly fixes any inventory item and its associated ICS slip
-- that has "5" or "5 years" when the user actually wanted "3 yrs"
-- Run this directly in your Supabase SQL Editor.

-- Update inventory items that are laptops
UPDATE inventory_items 
SET 
  estimated_useful_life = '3 yrs',
  updated_at = NOW()
WHERE 
  estimated_useful_life ILIKE '%5%' AND 
  (description ILIKE '%laptop%' OR model ILIKE '%laptop%' OR brand ILIKE '%laptop%');

-- Update custodian slip items similarly so the ICS report prints correctly
UPDATE custodian_slip_items
SET 
  estimated_useful_life = '3 yrs',
  updated_at = NOW()
WHERE 
  estimated_useful_life ILIKE '%5%' AND
  description ILIKE '%laptop%';

-- Also ensure any future POs with 3 yrs successfully override empty arrays from old stocks
UPDATE purchase_order_items
SET estimated_useful_life = '3 yrs'
WHERE estimated_useful_life ILIKE '%5%' AND description ILIKE '%laptop%';
