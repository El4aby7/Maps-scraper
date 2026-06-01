-- ============================================================
-- MapExtractPro – Database Schema
-- Run this file in the Supabase SQL Editor to set up all tables.
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. Scraping Sessions
--    One row per "Start Scraping" click.
-- ============================================================
create table if not exists public.scraping_sessions (
  id          uuid primary key default gen_random_uuid(),
  location    text            not null,
  category    text            not null,
  radius_km   numeric(6,2)    not null,
  result_count integer        not null default 0,
  created_at  timestamptz     not null default now()
);

comment on table public.scraping_sessions is
  'Tracks each scraping job: where, what category, radius used, and how many results came back.';

-- ============================================================
-- 2. Scraped Results
--    Each business record returned by the Edge Function.
-- ============================================================
create table if not exists public.scraped_results (
  id           text            not null,          -- OSM element id (string)
  session_id   uuid            not null references public.scraping_sessions(id) on delete cascade,
  name         text            not null,
  category     text            not null,
  address      text,
  phone        text,
  website      text,
  lat          double precision not null,
  lon          double precision not null,
  created_at   timestamptz     not null default now(),
  primary key (session_id, id)
);

comment on table public.scraped_results is
  'Individual business records belonging to a scraping session.';

create index if not exists scraped_results_session_id_idx
  on public.scraped_results(session_id);

-- ============================================================
-- 3. Row Level Security
--    Anon key can read and insert; no updates or deletes.
-- ============================================================
alter table public.scraping_sessions enable row level security;
alter table public.scraped_results   enable row level security;

-- Allow anon/authenticated users to insert new sessions
create policy "insert_sessions"
  on public.scraping_sessions for insert
  to anon, authenticated
  with check (true);

-- Allow anon/authenticated users to read all sessions
create policy "read_sessions"
  on public.scraping_sessions for select
  to anon, authenticated
  using (true);

-- Allow anon/authenticated users to insert results
create policy "insert_results"
  on public.scraped_results for insert
  to anon, authenticated
  with check (true);

-- Allow anon/authenticated users to read results
create policy "read_results"
  on public.scraped_results for select
  to anon, authenticated
  using (true);
