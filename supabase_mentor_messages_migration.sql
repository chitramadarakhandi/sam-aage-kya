-- ============================================================
-- Aage Kya? — "Ask Mentor" async messaging migration
-- Run this ENTIRE file once in the Supabase SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS guards).
--
-- Replaces the old real-time "Chat Now" feature with an asynchronous
-- student -> mentor Q&A. A student submits a question; the assigned mentor
-- replies later; the student sees the reply on their "My Mentor Requests" page.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentor_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_id     UUID        NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  contact_name  TEXT        NOT NULL DEFAULT '',
  contact_email TEXT        NOT NULL DEFAULT '',
  subject       TEXT        NOT NULL DEFAULT '',
  category      TEXT        NOT NULL DEFAULT '',
  question      TEXT        NOT NULL,
  reply         TEXT        NOT NULL DEFAULT '',
  status        TEXT        NOT NULL DEFAULT 'pending',   -- pending | answered
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  replied_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mentor_messages_student ON public.mentor_messages (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_mentor  ON public.mentor_messages (mentor_id, created_at DESC);

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

-- Students can create their own questions.
DROP POLICY IF EXISTS "mentor_messages_student_insert" ON public.mentor_messages;
CREATE POLICY "mentor_messages_student_insert"
  ON public.mentor_messages FOR INSERT
  WITH CHECK (auth.uid() = student_id);

-- Students can read their own questions (and the mentor's reply).
DROP POLICY IF EXISTS "mentor_messages_student_read" ON public.mentor_messages;
CREATE POLICY "mentor_messages_student_read"
  ON public.mentor_messages FOR SELECT
  USING (auth.uid() = student_id);

-- Mentors can read questions assigned to their mentor profile.
DROP POLICY IF EXISTS "mentor_messages_mentor_read" ON public.mentor_messages;
CREATE POLICY "mentor_messages_mentor_read"
  ON public.mentor_messages FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

-- Mentors can reply to (update) questions assigned to them.
DROP POLICY IF EXISTS "mentor_messages_mentor_update" ON public.mentor_messages;
CREATE POLICY "mentor_messages_mentor_update"
  ON public.mentor_messages FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));
