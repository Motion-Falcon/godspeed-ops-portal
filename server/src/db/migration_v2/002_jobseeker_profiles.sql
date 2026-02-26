-- Consolidated migration_v2: jobseeker tables and profile lifecycle

CREATE TABLE IF NOT EXISTS public.jobseeker_profile_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_data JSONB NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT 1,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_user_id UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.jobseeker_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  license_number TEXT,
  passport_number TEXT,
  sin_number TEXT,
  sin_expiry TEXT,
  business_number TEXT,
  corporation_name TEXT,
  street TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  work_preference TEXT,
  license_type TEXT,
  experience TEXT,
  manual_driving TEXT,
  availability TEXT,
  weekend_availability BOOLEAN,
  payrate_type TEXT,
  bill_rate TEXT,
  pay_rate TEXT,
  payment_method TEXT,
  hst_gst TEXT,
  cash_deduction TEXT,
  overtime_enabled BOOLEAN,
  overtime_hours TEXT,
  overtime_bill_rate TEXT,
  overtime_pay_rate TEXT,
  verification_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  documents JSONB DEFAULT '[]'::jsonb,
  bio TEXT,
  created_by_user_id UUID REFERENCES auth.users(id),
  rejection_reason TEXT DEFAULT NULL,
  updated_by_user_id UUID REFERENCES auth.users(id),
  employee_id VARCHAR(50) DEFAULT NULL,
  CONSTRAINT jobseeker_profiles_email_key UNIQUE (email),
  CONSTRAINT unique_employee_id UNIQUE (employee_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_jobseeker_docs ON public.jobseeker_profiles USING GIN (documents);

ALTER TABLE public.jobseeker_profile_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobseeker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Users can insert their own drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Users can update their own drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Users can delete their own drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Users can view their own profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Users can insert their own profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Users can update their own profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Only admins and recruiters can update verification status" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Service role can do anything with drafts" ON public.jobseeker_profile_drafts;
DROP POLICY IF EXISTS "Service role can do anything with profiles" ON public.jobseeker_profiles;
DROP POLICY IF EXISTS "Service role can do anything with audit logs" ON public.audit_logs;

CREATE POLICY "Users can view their own drafts"
  ON public.jobseeker_profile_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts"
  ON public.jobseeker_profile_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
  ON public.jobseeker_profile_drafts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
  ON public.jobseeker_profile_drafts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own profiles"
  ON public.jobseeker_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profiles"
  ON public.jobseeker_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profiles"
  ON public.jobseeker_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all profiles"
  ON public.jobseeker_profiles FOR SELECT
  USING (public.is_admin() OR public.is_recruiter());

CREATE POLICY "Only admins and recruiters can update verification status"
  ON public.jobseeker_profiles FOR UPDATE
  USING (public.is_admin() OR public.is_recruiter());

CREATE POLICY "Service role can do anything with drafts"
  ON public.jobseeker_profile_drafts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do anything with profiles"
  ON public.jobseeker_profiles FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do anything with audit logs"
  ON public.audit_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON COLUMN public.jobseeker_profiles.bio IS 'Brief professional description (max 100 chars)';
COMMENT ON COLUMN public.jobseeker_profiles.created_by_user_id IS 'The user ID of the person who created this profile (may differ from the profile owner)';
COMMENT ON COLUMN public.jobseeker_profiles.rejection_reason IS 'Stores the reason for profile rejection provided by recruiters when verification_status is set to rejected';
COMMENT ON COLUMN public.jobseeker_profiles.employee_id IS 'Employee identification number assigned to the jobseeker';

DO $$
DECLARE
  user_rec RECORD;
  profile_exists BOOLEAN;
  curr_metadata JSONB;
  new_metadata JSONB;
BEGIN
  FOR user_rec IN
    SELECT id, raw_user_meta_data
    FROM auth.users
    WHERE raw_user_meta_data->>'user_type' = 'jobseeker'
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.jobseeker_profiles WHERE user_id = user_rec.id
    ) INTO profile_exists;

    curr_metadata := COALESCE(user_rec.raw_user_meta_data, '{}'::jsonb);

    IF profile_exists AND (curr_metadata->>'hasProfile' IS NULL OR curr_metadata->>'hasProfile' <> 'true') THEN
      new_metadata := jsonb_set(curr_metadata, '{hasProfile}', 'true'::jsonb, true);
      UPDATE auth.users SET raw_user_meta_data = new_metadata WHERE id = user_rec.id;
    ELSIF NOT profile_exists AND curr_metadata->>'hasProfile' = 'true' THEN
      new_metadata := jsonb_set(curr_metadata, '{hasProfile}', 'false'::jsonb, true);
      UPDATE auth.users SET raw_user_meta_data = new_metadata WHERE id = user_rec.id;
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.update_user_has_profile_on_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  curr_metadata JSONB;
  new_metadata JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  SELECT raw_user_meta_data INTO curr_metadata
  FROM auth.users
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  curr_metadata := COALESCE(curr_metadata, '{}'::jsonb);

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    new_metadata := jsonb_set(curr_metadata, '{hasProfile}', 'true'::jsonb, true);
    UPDATE auth.users SET raw_user_meta_data = new_metadata WHERE id = v_user_id;
  ELSIF TG_OP = 'DELETE' THEN
    IF NOT EXISTS (SELECT 1 FROM public.jobseeker_profiles jp WHERE jp.user_id = v_user_id) THEN
      new_metadata := jsonb_set(curr_metadata, '{hasProfile}', 'false'::jsonb, true);
      UPDATE auth.users SET raw_user_meta_data = new_metadata WHERE id = v_user_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobseeker_profile_insert ON public.jobseeker_profiles;
DROP TRIGGER IF EXISTS trg_jobseeker_profile_update ON public.jobseeker_profiles;
DROP TRIGGER IF EXISTS trg_jobseeker_profile_delete ON public.jobseeker_profiles;

CREATE TRIGGER trg_jobseeker_profile_insert
AFTER INSERT ON public.jobseeker_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_has_profile_on_profile_change();

CREATE TRIGGER trg_jobseeker_profile_update
AFTER UPDATE OF user_id ON public.jobseeker_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_has_profile_on_profile_change();

CREATE TRIGGER trg_jobseeker_profile_delete
AFTER DELETE ON public.jobseeker_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_user_has_profile_on_profile_change();
