-- Updates the ICS slip number generation to be a YEARLY sequence instead of MONTHLY
-- It will still include the month in the slip number (e.g., 2024-04-SPHV-0005)
-- but the sequence number (0005) will not reset when the month changes.

CREATE OR REPLACE FUNCTION public.generate_ics_number(sub_category_prefix text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  year_str TEXT;
  month_str TEXT;
  prefix TEXT;
  seq_num INTEGER;
  new_slip_number TEXT;
BEGIN
  -- Get current year and month
  year_str := to_char(CURRENT_DATE, 'YYYY');
  month_str := to_char(CURRENT_DATE, 'MM');
  
  -- Determine prefix
  IF sub_category_prefix IS NULL OR sub_category_prefix = '' THEN
    prefix := '';
  ELSE
    prefix := sub_category_prefix || '-';
  END IF;

  -- Find the highest sequence number FOR THIS YEAR AND PREFIX 
  -- Example pattern: 2024-03-SPHV-0001
  -- We match: year_str || '-%-' || prefix || '%' to count across ALL months
  SELECT COALESCE(
    MAX(
      -- Extract the last 4 digits after the last hyphen and cast to integer
      NULLIF(regexp_replace(slip_number, '^.*-', ''), '')::integer
    ), 0
  ) INTO seq_num
  FROM custodian_slips
  WHERE slip_number LIKE year_str || '-%-' || prefix || '%';

  -- Increment sequence
  seq_num := seq_num + 1;

  -- Format the new slip number: YYYY-MM-PREFIX-NNNN
  new_slip_number := year_str || '-' || month_str || '-' || prefix || lpad(seq_num::text, 4, '0');

  RETURN new_slip_number;
END;
$function$;
