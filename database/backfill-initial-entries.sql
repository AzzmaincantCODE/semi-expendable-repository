-- Backfill missing "Initial Receipt" entries for property cards
-- that were created by the Bulk Property Card Wizard (which bypassed the service layer)
--
-- Run this in the Supabase SQL Editor to fix existing cards missing their initial entries.

INSERT INTO property_card_entries (
  property_card_id,
  inventory_item_id,
  date,
  reference,
  receipt_qty,
  unit_cost,
  total_cost,
  issue_item_no,
  issue_qty,
  office_officer,
  balance_qty,
  amount,
  remarks
)
SELECT
  pc.id                                    AS property_card_id,
  pc.inventory_item_id                     AS inventory_item_id,
  COALESCE(
    CASE WHEN ii.date_acquired::text ~ '^\d{4}-\d{2}-\d{2}$' THEN ii.date_acquired::text::date ELSE NULL END,
    CASE WHEN pc.date_acquired::text ~ '^\d{4}-\d{2}-\d{2}$' THEN pc.date_acquired::text::date ELSE NULL END,
    CURRENT_DATE
  )  AS date,
  'Initial Receipt'                        AS reference,
  COALESCE(ii.quantity, 1)                 AS receipt_qty,
  COALESCE(ii.unit_cost, 0)               AS unit_cost,
  COALESCE(ii.total_cost, COALESCE(ii.quantity, 1) * COALESCE(ii.unit_cost, 0)) AS total_cost,
  ''                                       AS issue_item_no,
  0                                        AS issue_qty,
  ''                                       AS office_officer,
  COALESCE(ii.quantity, 1)                 AS balance_qty,
  COALESCE(ii.total_cost, COALESCE(ii.quantity, 1) * COALESCE(ii.unit_cost, 0)) AS amount,
  NULL                                     AS remarks
FROM property_cards pc
LEFT JOIN inventory_items ii ON ii.id = pc.inventory_item_id
WHERE NOT EXISTS (
  SELECT 1
  FROM property_card_entries pce
  WHERE pce.property_card_id = pc.id
);
