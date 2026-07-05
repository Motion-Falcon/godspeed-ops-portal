-- Add tax_amount to timesheets

ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.timesheets.tax_amount IS 'Tax amount applied for Corporation-Direct Deposit based on jobseeker profile hst_gst rate';
