-- ============================================================
-- Aage Kya? — Mentor Dashboard linkage migration
-- Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS guards).
--
-- Adds an `email` column to public.mentors so an approved mentor's
-- profile can be linked to their auth account (by matching email),
-- letting them log in and see the student questions they received.
-- ============================================================

ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_mentors_email ON public.mentors (email);

-- Ensure mentor_applications can store a rejection reason (used by the
-- admin reject flow and shown to the mentor in their dashboard).
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Backfill: link existing mentor rows to their application email where the
-- names match and no email is set yet (best-effort convenience).
UPDATE public.mentors m
SET email = a.email
FROM public.mentor_applications a
WHERE m.email IS NULL
  AND lower(m.name) = lower(a.name)
  AND a.email IS NOT NULL;

-- ─── Booking responses ───────────────────────────────────────────────────────
-- Lets a mentor reply to a booking request (accept / decline) and include a
-- short message (e.g. their available time), which the student then sees.
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS mentor_response TEXT NOT NULL DEFAULT '';

NOTIFY pgrst, 'reload schema';

-- ─── Student query class level ────────────────────────────────────────────────
-- Captures whether the asking student is in Class 10, Class 12, or Other, so
-- mentors and admins can see it alongside each question.
ALTER TABLE public.mentor_messages ADD COLUMN IF NOT EXISTS class_level TEXT NOT NULL DEFAULT '';

-- 'rescheduled' is a valid free-text status value for mentor_sessions.status
-- (no CHECK constraint exists on this column, so no migration is required for
-- the new status — accepted | declined | rescheduled | completed | pending).

NOTIFY pgrst, 'reload schema';
