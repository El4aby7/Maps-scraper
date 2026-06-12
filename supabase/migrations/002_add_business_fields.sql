-- ============================================================
-- MapExtractPro – Migration 002
-- Adds richer business fields: Google Maps link, rating,
-- opening hours, business status, and social profiles.
-- Run this file in the Supabase SQL Editor.
-- ============================================================

alter table public.scraped_results
  add column if not exists google_maps_uri   text,
  add column if not exists rating            numeric(2,1),
  add column if not exists user_rating_count integer,
  add column if not exists opening_hours     text,
  add column if not exists business_status   text,
  add column if not exists socials           jsonb;

comment on column public.scraped_results.google_maps_uri is
  'Direct link to the business listing on Google Maps (from Places API googleMapsUri).';
comment on column public.scraped_results.socials is
  'Social profile URLs keyed by platform (facebook, instagram, tiktok, x, linkedin, youtube, whatsapp). Populated when the business lists a social page as its website.';
