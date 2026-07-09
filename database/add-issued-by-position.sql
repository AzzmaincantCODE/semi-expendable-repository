-- Add issued_by_position column to custodian_slips table
-- This stores the Position/Office of the property officer issuing the ICS

ALTER TABLE custodian_slips
ADD COLUMN IF NOT EXISTS issued_by_position TEXT DEFAULT NULL;

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'custodian_slips'
ORDER BY ordinal_position;
