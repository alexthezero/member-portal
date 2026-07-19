-- ONE-TIME CAMPFIRE CODE FIX
-- Run this in Supabase Dashboard > SQL Editor, then click Run.
-- It updates the existing Campfire to use CAMPFIRE-2026 and reconnects existing users.

create extension if not exists pgcrypto;

update public.campfires
set code_hash = encode(digest(upper('CAMPFIRE-2026'),'sha256'),'hex'),
    invite_code_hint = 'CAMPFIRE-••••';

insert into public.campfire_members(campfire_id,user_id,role,status)
select c.id,u.id,
       case when u.id=c.created_by then 'admin' else 'member' end,
       'active'
from public.campfires c
cross join auth.users u
on conflict(campfire_id,user_id) do nothing;

-- Confirm the Campfire record exists and the hint was updated.
select id,name,invite_code_hint,created_at
from public.campfires;
