-- ============================================================
-- Aage Kya? — Mentor application fields migration
-- Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).
--
-- Adds the columns the "Become a Mentor" form (MentorApplication.jsx)
-- and the /api/mentors/apply endpoint send. Without these, inserts fail
-- with "Could not find the '<column>' column of 'mentor_applications'".
-- ============================================================

ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS profession       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS stream_category  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS experience_years INT  NOT NULL DEFAULT 0;
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS linkedin         TEXT NOT NULL DEFAULT '';
-- Reason shown to the applicant when an admin rejects their application.
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';

-- The newer application form sends stream_category / profession instead of the
-- original college / degree / stream_transition, so relax those NOT NULLs.
ALTER TABLE public.mentor_applications ALTER COLUMN stream_transition DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN stream_transition SET DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN college DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN college SET DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN degree DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN degree SET DEFAULT '';

-- mentors table needs the LinkedIn URL carried over on approval.
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS linkedin TEXT NOT NULL DEFAULT '';
