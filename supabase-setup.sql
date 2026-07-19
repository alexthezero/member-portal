-- CAMPFIRE DATABASE SETUP
-- Run this entire file once in Supabase Dashboard > SQL Editor.
-- Initial Campfire code: CAMPFIRE-2026

create extension if not exists pgcrypto;

create table if not exists public.campfires (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Campfire',
  code_hash text not null unique,
  invite_code_hint text not null default 'CAMPFIRE-••••',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.campfire_members (
  id uuid primary key default gen_random_uuid(),
  campfire_id uuid not null references public.campfires(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'active' check (status in ('active','pending','suspended')),
  joined_at timestamptz not null default now(),
  unique(campfire_id,user_id)
);

create table if not exists public.campfire_posts (
  id uuid primary key default gen_random_uuid(),
  campfire_id uuid not null references public.campfires(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 3000),
  visibility text not null default 'family' check (visibility in ('family','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  campfire_id uuid not null references public.campfires(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  recipient_label text not null default 'Whole family',
  unlock_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.campfires enable row level security;
alter table public.campfire_members enable row level security;
alter table public.campfire_posts enable row level security;
alter table public.time_capsules enable row level security;

create or replace function public.is_active_campfire_member(target uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.campfire_members where campfire_id=target and user_id=auth.uid() and status='active');
$$;

create or replace function public.is_campfire_admin(target uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.campfire_members where campfire_id=target and user_id=auth.uid() and status='active' and role='admin');
$$;

drop policy if exists "members view campfire" on public.campfires;
create policy "members view campfire" on public.campfires for select using (public.is_active_campfire_member(id));

drop policy if exists "members view memberships" on public.campfire_members;
create policy "members view memberships" on public.campfire_members for select using (public.is_active_campfire_member(campfire_id));

drop policy if exists "family reads allowed posts" on public.campfire_posts;
create policy "family reads allowed posts" on public.campfire_posts for select using (
  public.is_active_campfire_member(campfire_id)
  and (visibility='family' or author_id=auth.uid())
);
drop policy if exists "members create own posts" on public.campfire_posts;
create policy "members create own posts" on public.campfire_posts for insert with check (
  author_id=auth.uid() and public.is_active_campfire_member(campfire_id)
);
drop policy if exists "authors update posts" on public.campfire_posts;
create policy "authors update posts" on public.campfire_posts for update using (author_id=auth.uid()) with check (author_id=auth.uid());
drop policy if exists "authors delete posts" on public.campfire_posts;
create policy "authors delete posts" on public.campfire_posts for delete using (author_id=auth.uid());

drop policy if exists "members view capsule envelopes" on public.time_capsules;
create policy "members view capsule envelopes" on public.time_capsules for select using (public.is_active_campfire_member(campfire_id));
drop policy if exists "members create capsules" on public.time_capsules;
create policy "members create capsules" on public.time_capsules for insert with check (creator_id=auth.uid() and public.is_active_campfire_member(campfire_id));
drop policy if exists "creators update capsules" on public.time_capsules;
create policy "creators update capsules" on public.time_capsules for update using (creator_id=auth.uid()) with check (creator_id=auth.uid());

-- Create the first private family Campfire.
insert into public.campfires(name,code_hash,invite_code_hint,created_by)
select 'Our Campfire',encode(digest(upper('CAMPFIRE-2026'),'sha256'),'hex'),'CAMPFIRE-••••',(select id from auth.users order by created_at limit 1)
where not exists(select 1 from public.campfires);

-- Connect existing accounts. The oldest account becomes the initial admin.
insert into public.campfire_members(campfire_id,user_id,role,status)
select c.id,u.id,case when u.id=c.created_by then 'admin' else 'member' end,'active'
from public.campfires c cross join auth.users u
on conflict(campfire_id,user_id) do nothing;

-- Automatically validate the Campfire code and join future signups.
create or replace function public.join_new_user_to_campfire()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  supplied_code text;
  target_id uuid;
begin
  supplied_code := upper(trim(coalesce(new.raw_user_meta_data->>'campfire_code','')));
  select id into target_id from public.campfires
  where code_hash=encode(digest(supplied_code,'sha256'),'hex')
  limit 1;
  if target_id is null then
    raise exception 'Invalid Campfire code';
  end if;
  insert into public.campfire_members(campfire_id,user_id,role,status)
  values(target_id,new.id,'member','active') on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_join_campfire on auth.users;
create trigger on_auth_user_created_join_campfire
after insert on auth.users
for each row execute function public.join_new_user_to_campfire();

-- Safe profile helpers used by the website.
create or replace function public.get_member_profile(profile_user_id uuid)
returns table(full_name text,avatar_url text)
language sql stable security definer set search_path=public,auth as $$
  select
    coalesce(u.raw_user_meta_data->>'full_name','Family Member'),
    coalesce(u.raw_user_meta_data->>'avatar_url','')
  from auth.users u
  where u.id=profile_user_id
    and exists(
      select 1 from public.campfire_members mine
      join public.campfire_members theirs on theirs.campfire_id=mine.campfire_id
      where mine.user_id=auth.uid() and mine.status='active'
        and theirs.user_id=u.id and theirs.status='active'
    );
$$;

create or replace function public.list_campfire_members(target_campfire_id uuid)
returns table(user_id uuid,full_name text,email text,avatar_url text,role text)
language sql stable security definer set search_path=public,auth as $$
  select u.id,
    coalesce(u.raw_user_meta_data->>'full_name','Family Member'),
    u.email::text,
    coalesce(u.raw_user_meta_data->>'avatar_url',''),
    m.role
  from public.campfire_members m join auth.users u on u.id=m.user_id
  where m.campfire_id=target_campfire_id and m.status='active'
    and public.is_active_campfire_member(target_campfire_id)
  order by coalesce(u.raw_user_meta_data->>'full_name',u.email);
$$;

grant execute on function public.get_member_profile(uuid) to authenticated;
grant execute on function public.list_campfire_members(uuid) to authenticated;
grant execute on function public.is_active_campfire_member(uuid) to authenticated;

grant select on public.campfires,public.campfire_members,public.campfire_posts,public.time_capsules to authenticated;
grant insert,update,delete on public.campfire_posts to authenticated;
grant insert,update on public.time_capsules to authenticated;