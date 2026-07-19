-- CAMPFIRE SIGNUP + MANUAL USER REPAIR
-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- It sets the family code to CAMPFIRE-2026, repairs the signup trigger,
-- and connects every existing Auth user to the family Campfire.

create extension if not exists pgcrypto;

-- Make sure the existing Campfire accepts CAMPFIRE-2026.
update public.campfires
set code_hash = encode(digest(upper('CAMPFIRE-2026'),'sha256'),'hex'),
    invite_code_hint = 'CAMPFIRE-••••';

-- Replace the trigger function.
-- Website registrations must include a valid code.
-- Users created manually in the Supabase dashboard are allowed through
-- even though the dashboard does not attach campfire_code metadata.
create or replace function public.join_new_user_to_campfire()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  supplied_code text;
  target_id uuid;
begin
  supplied_code := upper(trim(coalesce(new.raw_user_meta_data->>'campfire_code','')));

  -- Supabase dashboard-created users do not include a Campfire code.
  -- Allow creation; the membership repair query below can attach them.
  if supplied_code = '' then
    return new;
  end if;

  select id into target_id
  from public.campfires
  where code_hash = encode(digest(supplied_code,'sha256'),'hex')
  limit 1;

  if target_id is null then
    raise exception 'Invalid Campfire code';
  end if;

  insert into public.campfire_members(campfire_id,user_id,role,status)
  values(target_id,new.id,'member','active')
  on conflict(campfire_id,user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_join_campfire on auth.users;
create trigger on_auth_user_created_join_campfire
after insert on auth.users
for each row execute function public.join_new_user_to_campfire();

-- Attach every Auth user that already exists to the Campfire.
insert into public.campfire_members(campfire_id,user_id,role,status)
select c.id,u.id,
       case when u.id=c.created_by then 'admin' else 'member' end,
       'active'
from public.campfires c
cross join auth.users u
on conflict(campfire_id,user_id) do update
set status='active';

-- Verification results.
select u.email,m.role,m.status,c.name as campfire
from public.campfire_members m
join auth.users u on u.id=m.user_id
join public.campfires c on c.id=m.campfire_id
order by u.created_at;
