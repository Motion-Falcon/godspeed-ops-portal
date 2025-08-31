-- User roles and hierarchy helpers based on auth.users raw_user_meta_data
-- This migration is idempotent and safe to re-run.

-- 1) Role helpers using a user_role array in raw_user_meta_data
CREATE OR REPLACE FUNCTION public.get_user_roles(user_id uuid)
RETURNS text[]
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(auth.users.raw_user_meta_data -> 'user_role')),
        ARRAY[]::text[]
    )
    FROM auth.users
    WHERE id = user_id;
$$;

-- Admins are treated as having all roles
CREATE OR REPLACE FUNCTION public.has_user_role(role text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
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

-- 2) Scope checking (fine-grained permissions) from top-level scopes[]
CREATE OR REPLACE FUNCTION public.has_scope(scope text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
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

-- 3) Optional hierarchy fields (kept nullable by default)
CREATE OR REPLACE FUNCTION public.get_manager_id(user_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT NULLIF((auth.users.raw_user_meta_data -> 'hierarchy' ->> 'manager_id'), '')::uuid
    FROM auth.users
    WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_org_id(user_id uuid)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT NULLIF((auth.users.raw_user_meta_data -> 'hierarchy' ->> 'org_id'), '')::uuid
    FROM auth.users
    WHERE id = user_id;
$$;

-- 4) Role change logging and setter
CREATE OR REPLACE FUNCTION public.get_role_change_log(user_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT COALESCE(auth.users.raw_user_meta_data -> 'role_change_log', '[]'::jsonb)
    FROM auth.users
    WHERE id = user_id;
$$;

-- Only admins may call this. Appends an entry to role_change_log and sets user_role array.
CREATE OR REPLACE FUNCTION public.set_user_roles(
    target_user_id uuid,
    new_roles text[],
    changed_by uuid,
    reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
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
        ARRAY(SELECT jsonb_array_elements_text(current_meta -> 'user_role')),
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

-- 5) Backfill/initialize user_role array and optional hierarchy (kept nulls by default)
DO $$
BEGIN
    -- Backfill roles array for recruiters/admins if missing
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

    -- Ensure hierarchy container exists with nulls by default when absent
    UPDATE auth.users u
    SET raw_user_meta_data = jsonb_set(
        COALESCE(u.raw_user_meta_data, '{}'::jsonb),
        '{hierarchy}',
        (
            COALESCE(u.raw_user_meta_data -> 'hierarchy', '{}'::jsonb)
            || jsonb_build_object(
                'org_id',     COALESCE((u.raw_user_meta_data -> 'hierarchy' ->> 'org_id'), NULL),
                'team_id',    COALESCE((u.raw_user_meta_data -> 'hierarchy' ->> 'team_id'), NULL),
                'manager_id', COALESCE((u.raw_user_meta_data -> 'hierarchy' ->> 'manager_id'), NULL),
                'level',      COALESCE(((u.raw_user_meta_data -> 'hierarchy' ->> 'level'))::int, 0)
            )
        ),
        true
    )
    WHERE TRUE; -- apply to all users
END$$;


