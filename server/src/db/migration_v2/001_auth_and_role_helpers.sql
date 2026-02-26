-- Consolidated migration_v2: auth and role helpers

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('jobseeker', 'recruiter', 'admin');
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS public.user_role
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN raw_user_meta_data->>'user_type' = 'admin' THEN 'admin'::public.user_role
    WHEN raw_user_meta_data->>'user_type' = 'recruiter' THEN 'recruiter'::public.user_role
    ELSE 'jobseeker'::public.user_role
  END
  FROM auth.users
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_role(role public.user_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN role = 'admin' THEN (SELECT raw_user_meta_data->>'user_type' = 'admin' FROM auth.users WHERE id = auth.uid())
    WHEN role = 'recruiter' THEN (SELECT raw_user_meta_data->>'user_type' IN ('recruiter', 'admin') FROM auth.users WHERE id = auth.uid())
    WHEN role = 'jobseeker' THEN (SELECT raw_user_meta_data->>'user_type' = 'jobseeker' FROM auth.users WHERE id = auth.uid())
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT has_role('admin'::public.user_role);
$$;

CREATE OR REPLACE FUNCTION public.is_recruiter()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT has_role('recruiter'::public.user_role);
$$;

CREATE OR REPLACE FUNCTION public.is_jobseeker()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT has_role('jobseeker'::public.user_role);
$$;

DROP FUNCTION IF EXISTS public.get_user_id_by_email(TEXT);
CREATE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM auth.users
    WHERE email = user_email
    LIMIT 1
  );
END;
$$;

COMMENT ON FUNCTION public.get_user_id_by_email(TEXT)
IS 'Looks up a user ID by email address. Returns NULL if no user is found.';

DROP FUNCTION IF EXISTS public.get_user_id_by_phone(TEXT);
CREATE FUNCTION public.get_user_id_by_phone(user_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT id
    FROM auth.users
    WHERE phone = user_phone
       OR raw_user_meta_data->>'phoneNumber' = user_phone
    LIMIT 1
  );
END;
$$;

COMMENT ON FUNCTION public.get_user_id_by_phone(TEXT)
IS 'Looks up a user ID by phone number. Checks both phone field and phoneNumber in user_metadata.';

DROP FUNCTION IF EXISTS public.list_auth_users(
  text, text, text, text, text, text, integer, integer
);

CREATE OR REPLACE FUNCTION public.list_auth_users(
  search text DEFAULT NULL,
  name_filter text DEFAULT NULL,
  email_filter text DEFAULT NULL,
  mobile_filter text DEFAULT NULL,
  user_type_filter text DEFAULT NULL,
  email_verified_filter text DEFAULT NULL,
  limit_count integer DEFAULT 10,
  offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  email text,
  user_metadata jsonb,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    current_setting('request.jwt.claims', true)::jsonb->>'user_type' IN ('admin', 'recruiter')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    u.raw_user_meta_data AS user_metadata,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  FROM auth.users u
  WHERE
    (search IS NULL OR
      u.email ILIKE '%' || search || '%' OR
      (u.raw_user_meta_data->>'name') ILIKE '%' || search || '%' OR
      (u.raw_user_meta_data->>'phoneNumber') ILIKE '%' || search || '%' OR
      (u.raw_user_meta_data->>'user_type') ILIKE '%' || search || '%')
    AND (name_filter IS NULL OR (u.raw_user_meta_data->>'name') ILIKE '%' || name_filter || '%')
    AND (email_filter IS NULL OR u.email ILIKE '%' || email_filter || '%')
    AND (mobile_filter IS NULL OR (u.raw_user_meta_data->>'phoneNumber') ILIKE '%' || mobile_filter || '%')
    AND (user_type_filter IS NULL OR (u.raw_user_meta_data->>'user_type') = user_type_filter)
    AND (
      email_verified_filter IS NULL OR
      (email_verified_filter = 'true' AND u.email_confirmed_at IS NOT NULL) OR
      (email_verified_filter = 'false' AND u.email_confirmed_at IS NULL)
    )
  ORDER BY u.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_auth_users(text, text, text, text, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_user_roles(user_id uuid)
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(auth.users.raw_user_meta_data, '{}'::jsonb) -> 'user_role')),
    ARRAY[]::text[]
  )
  FROM auth.users
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_user_role(role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN (SELECT raw_user_meta_data->>'user_type' = 'admin' FROM auth.users WHERE id = auth.uid()) THEN true
    ELSE (
      WITH me AS (
        SELECT raw_user_meta_data AS meta
        FROM auth.users
        WHERE id = auth.uid()
      )
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(meta -> 'user_role', '[]'::jsonb)) AS r(value)
        WHERE r.value = role
      )
      FROM me
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_scope(scope text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN (SELECT raw_user_meta_data->>'user_type' = 'admin' FROM auth.users WHERE id = auth.uid()) THEN true
    ELSE (
      WITH me AS (
        SELECT raw_user_meta_data AS meta
        FROM auth.users
        WHERE id = auth.uid()
      )
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(COALESCE(meta -> 'scopes', '[]'::jsonb)) AS s(value)
        WHERE s.value = scope
      )
      FROM me
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_manager_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NULLIF((auth.users.raw_user_meta_data -> 'hierarchy' ->> 'manager_id'), '')::uuid
  FROM auth.users
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_org_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NULLIF((auth.users.raw_user_meta_data -> 'hierarchy' ->> 'org_id'), '')::uuid
  FROM auth.users
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_role_change_log(user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(auth.users.raw_user_meta_data -> 'role_change_log', '[]'::jsonb)
  FROM auth.users
  WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.set_user_roles(
  target_user_id uuid,
  new_roles text[],
  changed_by uuid,
  reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_admin boolean;
  old_roles text[] := ARRAY[]::text[];
  current_meta jsonb;
  new_log_entry jsonb;
  updated_log jsonb;
BEGIN
  SELECT (raw_user_meta_data->>'user_type' = 'admin') INTO caller_is_admin
  FROM auth.users
  WHERE id = auth.uid();

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Not authorized to set roles';
  END IF;

  SELECT raw_user_meta_data INTO current_meta
  FROM auth.users
  WHERE id = target_user_id
  FOR UPDATE;

  SELECT COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(current_meta, '{}'::jsonb) -> 'user_role')),
    ARRAY[]::text[]
  ) INTO old_roles;

  new_log_entry := jsonb_build_object(
    'changed_at', now(),
    'changed_by', changed_by,
    'previous_roles', to_jsonb(old_roles),
    'new_roles', to_jsonb(new_roles),
    'reason', to_jsonb(reason)
  );

  updated_log := COALESCE(current_meta -> 'role_change_log', '[]'::jsonb) || new_log_entry;

  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(current_meta, '{}'::jsonb),
      '{user_role}',
      to_jsonb(new_roles),
      true
    ),
    '{role_change_log}',
    updated_log,
    true
  )
  WHERE id = target_user_id;
END;
$$;

DO $$
BEGIN
  UPDATE auth.users u
  SET raw_user_meta_data = jsonb_set(
    COALESCE(u.raw_user_meta_data, '{}'::jsonb),
    '{user_role}',
    to_jsonb(ARRAY['recruiter']::text[]),
    true
  )
  WHERE u.raw_user_meta_data->>'user_type' = 'recruiter'
    AND (u.raw_user_meta_data->'user_role') IS NULL;

  UPDATE auth.users u
  SET raw_user_meta_data = jsonb_set(
    COALESCE(u.raw_user_meta_data, '{}'::jsonb),
    '{user_role}',
    to_jsonb(ARRAY['admin']::text[]),
    true
  )
  WHERE u.raw_user_meta_data->>'user_type' = 'admin'
    AND (u.raw_user_meta_data->'user_role') IS NULL;

  UPDATE auth.users u
  SET raw_user_meta_data = jsonb_set(
    COALESCE(u.raw_user_meta_data, '{}'::jsonb),
    '{hierarchy}',
    (
      COALESCE(u.raw_user_meta_data -> 'hierarchy', '{}'::jsonb)
      || jsonb_build_object(
        'org_id', COALESCE((u.raw_user_meta_data -> 'hierarchy' ->> 'org_id'), NULL),
        'team_id', COALESCE((u.raw_user_meta_data -> 'hierarchy' ->> 'team_id'), NULL),
        'manager_id', COALESCE((u.raw_user_meta_data -> 'hierarchy' ->> 'manager_id'), NULL),
        'level', COALESCE(((u.raw_user_meta_data -> 'hierarchy' ->> 'level'))::int, 0)
      )
    ),
    true
  )
  WHERE TRUE;
END
$$;
