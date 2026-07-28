-- ============================================================
-- Aage Kya? — Mentor + Chat fix migration
-- Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / ADD TABLE guards).
-- ============================================================

-- ─── 1. mentor_applications: add the columns the application form sends ──────
-- The "Become a Mentor" page (src/pages/MentorApplication.jsx) collects a
-- profession, stream expertise, years of experience, a Cal.com booking link
-- and a LinkedIn URL. The original table only had college/degree/stream_transition,
-- so the insert failed with "column does not exist". These add the rest.

ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS profession       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS stream_category  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS experience_years INT  NOT NULL DEFAULT 0;
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS cal_link         TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS linkedin         TEXT NOT NULL DEFAULT '';

-- stream_transition was NOT NULL with no default in the original schema; make it
-- optional so the newer application form (which sends stream_category instead)
-- can insert without providing it.
ALTER TABLE public.mentor_applications ALTER COLUMN stream_transition DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN stream_transition SET DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN college DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN college SET DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN degree DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN degree SET DEFAULT '';

-- ─── 2. mentors: carry a LinkedIn URL (cal_link already exists) ──────────────
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS linkedin TEXT NOT NULL DEFAULT '';

-- ─── 3. Enable Supabase Realtime for live chat ──────────────────────────────
-- Without these, chat messages won't stream live between student and mentor.
-- Wrapped so re-running doesn't error if already added.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
