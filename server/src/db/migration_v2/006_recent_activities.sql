-- Consolidated migration_v2: recent activities and realtime broadcast

CREATE TABLE IF NOT EXISTS public.activity_action_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.activity_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.activity_action_types (code, name, description) VALUES
  ('assign_jobseeker', 'Assign Jobseeker', 'Assign a jobseeker to a position'),
  ('verify_jobseeker', 'Verify Jobseeker', 'Verify jobseeker credentials and documents'),
  ('reject_jobseeker', 'Reject Jobseeker', 'Reject a jobseeker application'),
  ('pending_jobseeker', 'Pending Jobseeker', 'Mark jobseeker as pending review'),
  ('create_client', 'Create Client', 'Create a new client record'),
  ('update_client', 'Update Client', 'Update client information'),
  ('delete_client', 'Delete Client', 'Delete a client record'),
  ('create_position', 'Create Position', 'Create a new job position'),
  ('update_position', 'Update Position', 'Update position details'),
  ('delete_position', 'Delete Position', 'Delete a job position'),
  ('remove_jobseeker', 'Remove Jobseeker', 'Remove a jobseeker from a position'),
  ('create_timesheet', 'Create Timesheet', 'Create a new employee timesheet'),
  ('update_timesheet', 'Update Timesheet', 'Update employee timesheet'),
  ('delete_timesheet', 'Delete Timesheet', 'Delete an employee timesheet'),
  ('update_invoice', 'Update Invoice', 'Update client invoice'),
  ('create_jobseeker', 'Create Jobseeker', 'Create new jobseeker profile'),
  ('update_jobseeker', 'Update Jobseeker', 'Update jobseeker information'),
  ('delete_jobseeker', 'Delete Jobseeker', 'Delete a jobseeker profile')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.activity_categories (code, name, description) VALUES
  ('candidate_management', 'Candidate Management', 'Activities related to managing jobseekers and candidates'),
  ('client_management', 'Client Management', 'Activities related to managing clients'),
  ('position_management', 'Position Management', 'Activities related to managing job positions'),
  ('financial', 'Financial', 'Activities related to invoices, timesheets, and financial operations'),
  ('system', 'System', 'System-generated activities and administrative tasks')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.recent_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  actor_id UUID NOT NULL,
  actor_name TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'recruiter',
  action_type TEXT NOT NULL REFERENCES public.activity_action_types(code),
  action_verb TEXT NOT NULL,
  primary_entity_type TEXT NOT NULL,
  primary_entity_id UUID,
  primary_entity_name TEXT,
  secondary_entity_type TEXT,
  secondary_entity_id UUID,
  secondary_entity_name TEXT,
  tertiary_entity_type TEXT,
  tertiary_entity_id UUID,
  tertiary_entity_name TEXT,
  status TEXT,
  metadata JSONB DEFAULT '{}',
  display_message TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES public.activity_categories(code),
  priority TEXT DEFAULT 'normal',
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_recent_activities_actor_id ON public.recent_activities(actor_id);
CREATE INDEX IF NOT EXISTS idx_recent_activities_created_at ON public.recent_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recent_activities_category ON public.recent_activities(category);
CREATE INDEX IF NOT EXISTS idx_recent_activities_action_type ON public.recent_activities(action_type);
CREATE INDEX IF NOT EXISTS idx_recent_activities_primary_entity ON public.recent_activities(primary_entity_type, primary_entity_id);
CREATE INDEX IF NOT EXISTS idx_recent_activities_display ON public.recent_activities(is_deleted, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_recent_activities_actor_category_date ON public.recent_activities(actor_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action_types_active ON public.activity_action_types(is_active, code);
CREATE INDEX IF NOT EXISTS idx_activity_categories_active ON public.activity_categories(is_active, code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'recent_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recent_activities;
  END IF;
END
$$;

ALTER TABLE public.recent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activities" ON public.recent_activities;
DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.recent_activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.recent_activities;
DROP POLICY IF EXISTS "Service role has full access" ON public.recent_activities;
DROP POLICY IF EXISTS "Anyone can read action types" ON public.activity_action_types;
DROP POLICY IF EXISTS "Anyone can read categories" ON public.activity_categories;
DROP POLICY IF EXISTS "Service role can manage action types" ON public.activity_action_types;
DROP POLICY IF EXISTS "Service role can manage categories" ON public.activity_categories;

CREATE POLICY "Users can view their own activities" ON public.recent_activities
  FOR SELECT USING (
    auth.uid()::text = actor_id::text OR
    auth.uid()::text = primary_entity_id::text OR
    auth.uid()::text = secondary_entity_id::text OR
    auth.uid()::text = tertiary_entity_id::text
  );

CREATE POLICY "Authenticated users can insert activities" ON public.recent_activities
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND auth.uid()::text = actor_id::text
  );

CREATE POLICY "Users can update their own activities" ON public.recent_activities
  FOR UPDATE USING (auth.uid()::text = actor_id::text)
  WITH CHECK (auth.uid()::text = actor_id::text);

CREATE POLICY "Service role has full access" ON public.recent_activities
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Anyone can read action types" ON public.activity_action_types
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone can read categories" ON public.activity_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage action types" ON public.activity_action_types
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage categories" ON public.activity_categories
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE OR REPLACE FUNCTION public.notify_activity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  event_type TEXT;
  payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    event_type := 'INSERT';
    payload := jsonb_build_object(
      'eventType', event_type,
      'table', TG_TABLE_NAME,
      'timestamp', NOW(),
      'new', row_to_json(NEW)
    );
    PERFORM pg_notify('recent_activities_changes', payload::text);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    event_type := 'UPDATE';
    payload := jsonb_build_object(
      'eventType', event_type,
      'table', TG_TABLE_NAME,
      'timestamp', NOW(),
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    );
    PERFORM pg_notify('recent_activities_changes', payload::text);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    event_type := 'DELETE';
    payload := jsonb_build_object(
      'eventType', event_type,
      'table', TG_TABLE_NAME,
      'timestamp', NOW(),
      'old', row_to_json(OLD)
    );
    PERFORM pg_notify('recent_activities_changes', payload::text);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS activity_change_trigger ON public.recent_activities;
DROP TRIGGER IF EXISTS recent_activities_trigger ON public.recent_activities;

CREATE TRIGGER activity_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.recent_activities
FOR EACH ROW
EXECUTE FUNCTION public.notify_activity_change();

GRANT SELECT ON public.recent_activities TO authenticated;
GRANT INSERT ON public.recent_activities TO authenticated;
GRANT UPDATE ON public.recent_activities TO authenticated;
GRANT SELECT ON public.activity_action_types TO authenticated;
GRANT SELECT ON public.activity_categories TO authenticated;
GRANT ALL ON public.recent_activities TO service_role;
GRANT ALL ON public.activity_action_types TO service_role;
GRANT ALL ON public.activity_categories TO service_role;
