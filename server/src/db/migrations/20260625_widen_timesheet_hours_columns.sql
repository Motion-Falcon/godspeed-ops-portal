-- Migration: Widen hours columns in timesheets table
-- Description: Increases precision of total_regular_hours and total_overtime_hours from
--              DECIMAL(5,2) to DECIMAL(8,2) to support non-hourly payrate types
--              (Commission, Salary) that use this field for miles/units which can
--              exceed the previous cap of 999.99. Fixes PostgreSQL error 22003
--              (numeric field overflow) when large unit values are submitted.
-- Author: System Generated
-- Date: 2026-06-25

-- Widen hours columns: DECIMAL(5,2) max=999.99  →  DECIMAL(8,2) max=999999.99
ALTER TABLE public.timesheets
    ALTER COLUMN total_regular_hours  TYPE DECIMAL(8,2),
    ALTER COLUMN total_overtime_hours TYPE DECIMAL(8,2);

-- Update column comments to reflect the new precision
COMMENT ON COLUMN public.timesheets.total_regular_hours  IS 'Total regular hours (or units/miles for Commission/Salary payrate types) for the week. DECIMAL(8,2) supports values up to 999999.99.';
COMMENT ON COLUMN public.timesheets.total_overtime_hours IS 'Total overtime hours for the week. DECIMAL(8,2) supports values up to 999999.99.';

-- Verification query (uncomment to test after running migration)
-- SELECT column_name, data_type, numeric_precision, numeric_scale
-- FROM information_schema.columns
-- WHERE table_name = 'timesheets'
--   AND column_name IN ('total_regular_hours', 'total_overtime_hours');
