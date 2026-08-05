-- =========================================================================
-- SIGNBRIDGE AI - DATABASE SCHEMA
-- Execute this script in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- =========================================================================

-- 1. PROFILES TABLE (Lecturers metadata & settings)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  institution text default 'SignBridge Academy',
  default_title text default 'General Science Lecture',
  custom_vocab jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policies
drop policy if exists "Allow public read access to profiles" on public.profiles;
create policy "Allow public read access to profiles" on public.profiles
  for select using (true);

drop policy if exists "Allow users to update their own profile" on public.profiles;
create policy "Allow users to update their own profile" on public.profiles
  for update using ((select auth.uid()) = id);

drop policy if exists "Allow users to insert their own profile" on public.profiles;
create policy "Allow users to insert their own profile" on public.profiles
  for insert with check ((select auth.uid()) = id);


-- 2. PROFILE TRIGGER
-- Automatically creates a profile record in public.profiles when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, institution, default_title, custom_vocab)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Lecturer'),
    'SignBridge Academy',
    'General Science Lecture',
    '[]'::jsonb
  );
  return new;
end;
$$;

-- Revoke direct RPC execution from public API roles for security definer trigger function
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Recreate trigger safety
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. SESSIONS TABLE (Lecturer classroom sessions)
create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  lecturer_id uuid references auth.users on delete cascade not null,
  code text not null,
  title text not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  summary text,
  custom_vocab jsonb default '[]'::jsonb,
  is_active boolean default true not null
);

-- Ensure custom_vocab is added if the sessions table already existed
alter table public.sessions add column if not exists custom_vocab jsonb default '[]'::jsonb;

-- Covering Index for Foreign Key (lecturer_id)
create index if not exists idx_sessions_lecturer_id on public.sessions (lecturer_id);

-- Enable RLS
alter table public.sessions enable row level security;

-- Policies
drop policy if exists "Allow public read access to sessions" on public.sessions;
create policy "Allow public read access to sessions" on public.sessions
  for select using (true);

drop policy if exists "Allow lecturers to manage their own sessions" on public.sessions;
drop policy if exists "Allow lecturers to insert their own sessions" on public.sessions;
create policy "Allow lecturers to insert their own sessions" on public.sessions
  for insert with check ((select auth.uid()) = lecturer_id);

drop policy if exists "Allow lecturers to update their own sessions" on public.sessions;
create policy "Allow lecturers to update their own sessions" on public.sessions
  for update using ((select auth.uid()) = lecturer_id);

drop policy if exists "Allow lecturers to delete their own sessions" on public.sessions;
create policy "Allow lecturers to delete their own sessions" on public.sessions
  for delete using ((select auth.uid()) = lecturer_id);


-- 4. TRANSCRIPTS TABLE (Real-time live captions)
create table if not exists public.transcripts (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions on delete cascade not null,
  text text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Covering Index for Foreign Key (session_id)
create index if not exists idx_transcripts_session_id on public.transcripts (session_id);

-- Enable RLS
alter table public.transcripts enable row level security;

-- Policies
drop policy if exists "Allow public read access to transcripts" on public.transcripts;
create policy "Allow public read access to transcripts" on public.transcripts
  for select using (true);

drop policy if exists "Allow insert access to transcripts" on public.transcripts;
create policy "Allow insert access to transcripts" on public.transcripts
  for insert with check (
    exists (
      select 1 from public.sessions
      where sessions.id = session_id
      and sessions.lecturer_id = (select auth.uid())
    )
  );


-- 5. CONCEPT CARDS TABLE (AI-generated terms)
create table if not exists public.concept_cards (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions on delete cascade not null,
  concept text not null,
  definition text not null,
  details text,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Covering Index for Foreign Key (session_id)
create index if not exists idx_concept_cards_session_id on public.concept_cards (session_id);

-- Enable RLS
alter table public.concept_cards enable row level security;


-- Policies
drop policy if exists "Allow public read access to concept cards" on public.concept_cards;
create policy "Allow public read access to concept cards" on public.concept_cards
  for select using (true);

drop policy if exists "Allow insert access to concept cards" on public.concept_cards;
create policy "Allow insert access to concept cards" on public.concept_cards
  for insert with check (
    exists (
      select 1 from public.sessions
      where sessions.id = session_id
      and sessions.lecturer_id = (select auth.uid())
    )
  );



-- 6. ENABLE REALTIME BROADCASTS
-- Enables real-time pub/sub notifications for transcribing and card generation
do $$
begin
  -- Check and add transcripts table to realtime publication
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
    and n.nspname = 'public'
    and c.relname = 'transcripts'
  ) then
    alter publication supabase_realtime add table public.transcripts;
  end if;

  -- Check and add concept_cards table to realtime publication
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_class c on pr.prrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    where pr.prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
    and n.nspname = 'public'
    and c.relname = 'concept_cards'
  ) then
    alter publication supabase_realtime add table public.concept_cards;
  end if;
end $$;


-- 7. SECURITY HARDENING FOR EXTRA FUNCTIONS
-- Harden public.rls_auto_enable if present in the database
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated;';
    execute 'alter function public.rls_auto_enable() set search_path = '''';';
  end if;
end $$;

