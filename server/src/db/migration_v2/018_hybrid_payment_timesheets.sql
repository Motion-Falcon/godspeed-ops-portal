-- Hybrid SIN + cash/e-Transfer payment: profile cap and split timesheet rows

-- Jobseeker: weekly cap of hours paid on SIN payroll (used when payment_method is hybrid)
ALTER TABLE public.jobseeker_profiles
  ADD COLUMN IF NOT EXISTS sin_payroll_hours_cap NUMERIC(5,2);

COMMENT ON COLUMN public.jobseeker_profiles.sin_payroll_hours_cap IS
  'Max regular hours per week attributed to SIN payroll when payment_method is SIN and cash or SIN and e-Transfer';

-- Rename legacy payment label
UPDATE public.jobseeker_profiles
SET payment_method = 'SIN-Direct Deposit'
WHERE payment_method = 'Direct Deposit';

-- Timesheets: split segment + per-row reporting bucket
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS pay_split_segment TEXT NOT NULL DEFAULT 'single';

ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS line_payment_method TEXT;

ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS timesheets_pay_split_segment_check;

ALTER TABLE public.timesheets
  ADD CONSTRAINT timesheets_pay_split_segment_check
  CHECK (pay_split_segment IN ('single', 'sin', 'cash', 'e_transfer'));

COMMENT ON COLUMN public.timesheets.pay_split_segment IS
  'single = one row per week; sin/cash/e_transfer = portion of a hybrid week';
COMMENT ON COLUMN public.timesheets.line_payment_method IS
  'Effective payout bucket for this row (margin report / email); null = derive from profile';

UPDATE public.timesheets SET pay_split_segment = 'single' WHERE pay_split_segment IS NULL;

ALTER TABLE public.timesheets
  DROP CONSTRAINT IF EXISTS timesheets_unique_per_position_week;

ALTER TABLE public.timesheets
  ADD CONSTRAINT timesheets_unique_per_position_week_segment
  UNIQUE (jobseeker_profile_id, position_id, week_start_date, pay_split_segment);
