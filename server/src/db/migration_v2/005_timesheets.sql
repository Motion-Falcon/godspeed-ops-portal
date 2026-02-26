-- Consolidated migration_v2: timesheets (final shape)

CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jobseeker_profile_id UUID NOT NULL REFERENCES public.jobseeker_profiles(id) ON DELETE CASCADE,
  jobseeker_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id UUID REFERENCES public.positions(id) ON DELETE SET NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  daily_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_regular_hours DECIMAL(5,2) DEFAULT 0 NOT NULL,
  total_overtime_hours DECIMAL(5,2) DEFAULT 0 NOT NULL,
  regular_pay_rate DECIMAL(10,2) DEFAULT 0 NOT NULL,
  overtime_pay_rate DECIMAL(10,2) DEFAULT 0 NOT NULL,
  regular_bill_rate DECIMAL(10,2) DEFAULT 0 NOT NULL,
  overtime_bill_rate DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_jobseeker_pay DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_client_bill DECIMAL(10,2) DEFAULT 0 NOT NULL,
  overtime_enabled BOOLEAN DEFAULT FALSE,
  markup DECIMAL(5,2),
  document TEXT,
  invoice_number VARCHAR(6),
  email_sent BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_by_user_id UUID REFERENCES auth.users(id),
  bonus_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
  deduction_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  version_history JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  CONSTRAINT timesheets_week_dates_check CHECK (week_end_date > week_start_date),
  CONSTRAINT timesheets_week_span_check CHECK (week_end_date - week_start_date = 6),
  CONSTRAINT timesheets_hours_positive CHECK (total_regular_hours >= 0 AND total_overtime_hours >= 0),
  CONSTRAINT timesheets_rates_positive CHECK (
    regular_pay_rate >= 0 AND overtime_pay_rate >= 0 AND regular_bill_rate >= 0 AND overtime_bill_rate >= 0
  ),
  CONSTRAINT timesheets_pay_positive CHECK (total_jobseeker_pay >= 0 AND total_client_bill >= 0),
  CONSTRAINT timesheets_bonus_positive CHECK (bonus_amount >= 0),
  CONSTRAINT timesheets_deduction_positive CHECK (deduction_amount >= 0),
  CONSTRAINT timesheets_unique_per_position_week UNIQUE (jobseeker_profile_id, position_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_timesheets_jobseeker_profile_id ON public.timesheets(jobseeker_profile_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_jobseeker_user_id ON public.timesheets(jobseeker_user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_position_id ON public.timesheets(position_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_week_start_date ON public.timesheets(week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_week_end_date ON public.timesheets(week_end_date);
CREATE INDEX IF NOT EXISTS idx_timesheets_created_by ON public.timesheets(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_email_sent ON public.timesheets(email_sent);
CREATE INDEX IF NOT EXISTS idx_timesheets_document ON public.timesheets(document) WHERE document IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_invoice_number_unique ON public.timesheets(invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_bonus_amount ON public.timesheets(bonus_amount) WHERE bonus_amount > 0;
CREATE INDEX IF NOT EXISTS idx_timesheets_deduction_amount ON public.timesheets(deduction_amount) WHERE deduction_amount > 0;
CREATE INDEX IF NOT EXISTS idx_timesheets_version ON public.timesheets(version);
CREATE INDEX IF NOT EXISTS idx_timesheets_version_history ON public.timesheets USING GIN(version_history);

CREATE OR REPLACE FUNCTION public.update_timesheets_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_timesheets_updated_at ON public.timesheets;
CREATE TRIGGER update_timesheets_updated_at
BEFORE UPDATE ON public.timesheets
FOR EACH ROW
EXECUTE FUNCTION public.update_timesheets_updated_at_column();

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jobseekers can view own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Jobseekers can insert own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Jobseekers can update own timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Recruiters and admins can view all timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Recruiters and admins can update all timesheets" ON public.timesheets;

CREATE POLICY "Jobseekers can view own timesheets" ON public.timesheets
  FOR SELECT USING (
    auth.uid() = jobseeker_user_id OR
    auth.uid() IN (SELECT user_id FROM public.jobseeker_profiles WHERE id = jobseeker_profile_id)
  );

CREATE POLICY "Jobseekers can insert own timesheets" ON public.timesheets
  FOR INSERT WITH CHECK (
    auth.uid() = jobseeker_user_id OR
    auth.uid() IN (SELECT user_id FROM public.jobseeker_profiles WHERE id = jobseeker_profile_id)
  );

CREATE POLICY "Jobseekers can update own timesheets" ON public.timesheets
  FOR UPDATE USING (
    auth.uid() = jobseeker_user_id OR
    auth.uid() IN (SELECT user_id FROM public.jobseeker_profiles WHERE id = jobseeker_profile_id)
  );

CREATE POLICY "Recruiters and admins can view all timesheets" ON public.timesheets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          (raw_user_meta_data->>'user_type')::text = 'recruiter'
          OR (raw_user_meta_data->>'user_type')::text = 'admin'
        )
    )
  );

CREATE POLICY "Recruiters and admins can update all timesheets" ON public.timesheets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND (
          (raw_user_meta_data->>'user_type')::text = 'recruiter'
          OR (raw_user_meta_data->>'user_type')::text = 'admin'
        )
    )
  );

COMMENT ON TABLE public.timesheets IS 'Stores weekly timesheet submissions - one record per jobseeker per position per week.';
COMMENT ON COLUMN public.timesheets.invoice_number IS 'Manually generated invoice number in format 000001, 000002, etc. Generated via API call.';
COMMENT ON COLUMN public.timesheets.bonus_amount IS 'Additional bonus amount added to jobseeker pay';
COMMENT ON COLUMN public.timesheets.deduction_amount IS 'Deduction amount subtracted from jobseeker pay';
COMMENT ON COLUMN public.timesheets.version IS 'Record version incremented on each update';
COMMENT ON COLUMN public.timesheets.version_history IS 'Optional JSON audit metadata for versioned updates';
COMMENT ON COLUMN public.timesheets.notes IS 'Additional notes or comments about the timesheet';
