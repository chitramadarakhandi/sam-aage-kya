-- ============================================================
-- Aage Kya? — Mentor Booking Module migration (Cal.com removal)
-- Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).
-- ============================================================

-- ─── 1. Remove Cal.com integration entirely ──────────────────────────────────
-- "Book Call" (external Cal.com redirect) is replaced by an in-app
-- "Book Mentor" request form. The cal_link column is no longer read or
-- written anywhere in the app.
ALTER TABLE public.mentors             DROP COLUMN IF EXISTS cal_link;
ALTER TABLE public.mentor_applications DROP COLUMN IF EXISTS cal_link;

-- linkedin already exists on both tables (added by
-- supabase_mentor_online_migration.sql) and is now the mentor's primary
-- external verification/profile link.

-- ─── 2. Extend mentor_sessions to double as "Mentor Booking Requests" ────────
-- The existing mentor_sessions table (student_id, mentor_id, session_date,
-- status, notes, rating) already models a booked session between a student
-- and a mentor. We extend it with the fields collected on the new booking
-- form instead of introducing a duplicate table.
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS contact_name        TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS contact_email       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS contact_phone       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS class_level         TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS area_of_interest    TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS preferred_language  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS guidance_query      TEXT NOT NULL DEFAULT '';

-- session_date already exists and is reused to store the student's
-- preferred date & time for the session.

-- status now flows: pending -> accepted -> completed, or -> rejected.
-- (No CHECK constraint previously existed on status, so no migration is
-- needed for existing rows; this comment documents the allowed values.)

-- ─── 3. Mentors can read/insert bookings made against their own profile ─────
-- Students already have full RW access via mentor_sessions_student_rw and
-- mentors already have SELECT/UPDATE access via mentor_sessions_mentor_read /
-- mentor_sessions_mentor_update (defined in supabase_schema.sql). No new
-- policies are required — this migration only adds columns.

-- ─── 4. Realtime is not required for booking requests (no live chat here) ───
-- Nothing to do.
