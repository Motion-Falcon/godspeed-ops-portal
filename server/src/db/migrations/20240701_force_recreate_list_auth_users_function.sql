-- Migration: Force re-create list_auth_users function for admin user listing
-- Description: Drops and re-creates the function to ensure the latest definition is used

drop function if exists public.list_auth_users(
  search text,
  name_filter text,
  email_filter text,
  mobile_filter text,
  user_type_filter text,
  email_verified_filter text,
  limit_count integer,
  offset_count integer
);

create or replace function public.list_auth_users(
  search text default null,
  name_filter text default null,
  email_filter text default null,
  mobile_filter text default null,
  user_type_filter text default null,
  email_verified_filter text default null,
  limit_count integer default 10,
  offset_count integer default 0
)
returns table (
  id uuid,
  email text,
  user_metadata jsonb,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
) 
language plpgsql
security definer
as $$
begin
  -- Authorization: Only allow admin or recruiter
  if not (
    current_setting('request.jwt.claims', true)::jsonb->>'user_type' in ('admin', 'recruiter')
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.raw_user_meta_data as user_metadata,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  from auth.users u
  where
    (search is null or
      u.email ilike '%' || search || '%' or
      (u.raw_user_meta_data->>'name') ilike '%' || search || '%' or
      (u.raw_user_meta_data->>'phoneNumber') ilike '%' || search || '%' or
      (u.raw_user_meta_data->>'user_type') ilike '%' || search || '%')
    and (name_filter is null or (u.raw_user_meta_data->>'name') ilike '%' || name_filter || '%')
    and (email_filter is null or u.email ilike '%' || email_filter || '%')
    and (mobile_filter is null or (u.raw_user_meta_data->>'phoneNumber') ilike '%' || mobile_filter || '%')
    and (user_type_filter is null or (u.raw_user_meta_data->>'user_type') = user_type_filter)
    and (
      email_verified_filter is null or
      (email_verified_filter = 'true' and u.email_confirmed_at is not null) or
      (email_verified_filter = 'false' and u.email_confirmed_at is null)
    )
  order by u.created_at desc
  limit limit_count
  offset offset_count;
end;
$$;

grant execute on function public.list_auth_users to authenticated; 