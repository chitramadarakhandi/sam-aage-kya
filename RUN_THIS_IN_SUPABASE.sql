-- ============================================================
-- Aage Kya? — ALL PENDING MIGRATIONS (run this ONE file)
--
-- HOW TO RUN:
--   1. Open your Supabase project dashboard
--   2. Left sidebar -> SQL Editor -> New query
--   3. Paste this ENTIRE file
--   4. Click RUN (bottom right). You should see "Success. No rows returned".
--
-- Everything here is idempotent (safe to run multiple times).
-- ============================================================

-- ─── A. Mentor application fields (fixes "experience_years" error) ───────────
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS profession       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS stream_category  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS experience_years INT  NOT NULL DEFAULT 0;
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS linkedin         TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN stream_transition DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN stream_transition SET DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN college DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN college SET DEFAULT '';
ALTER TABLE public.mentor_applications ALTER COLUMN degree DROP NOT NULL;
ALTER TABLE public.mentor_applications ALTER COLUMN degree SET DEFAULT '';
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS linkedin TEXT NOT NULL DEFAULT '';

-- ─── B. Cal.com removal + booking fields on mentor_sessions ──────────────────
ALTER TABLE public.mentors             DROP COLUMN IF EXISTS cal_link;
ALTER TABLE public.mentor_applications DROP COLUMN IF EXISTS cal_link;
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS contact_name        TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS contact_email       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS contact_phone       TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS class_level         TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS area_of_interest    TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS preferred_language  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS guidance_query      TEXT NOT NULL DEFAULT '';

-- ─── C. Ask Mentor messaging table (fixes "mentor_messages" error) ───────────
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
  status        TEXT        NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  replied_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mentor_messages_student ON public.mentor_messages (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentor_messages_mentor  ON public.mentor_messages (mentor_id, created_at DESC);

ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentor_messages_student_insert" ON public.mentor_messages;
CREATE POLICY "mentor_messages_student_insert"
  ON public.mentor_messages FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "mentor_messages_student_read" ON public.mentor_messages;
CREATE POLICY "mentor_messages_student_read"
  ON public.mentor_messages FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "mentor_messages_mentor_read" ON public.mentor_messages;
CREATE POLICY "mentor_messages_mentor_read"
  ON public.mentor_messages FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

DROP POLICY IF EXISTS "mentor_messages_mentor_update" ON public.mentor_messages;
CREATE POLICY "mentor_messages_mentor_update"
  ON public.mentor_messages FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

-- ─── D. Mentor dashboard linkage — email column + rejection reason ──────────
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS email TEXT;
CREATE INDEX IF NOT EXISTS idx_mentors_email ON public.mentors (email);
ALTER TABLE public.mentor_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE public.mentors m
SET email = a.email
FROM public.mentor_applications a
WHERE m.email IS NULL
  AND lower(m.name) = lower(a.name)
  AND a.email IS NOT NULL;

-- ─── E. Booking responses — mentor's reply/availability message to a booking ─
ALTER TABLE public.mentor_sessions ADD COLUMN IF NOT EXISTS mentor_response TEXT NOT NULL DEFAULT '';

-- ─── F. Student query class level (10th / 12th / Other) ──────────────────────
ALTER TABLE public.mentor_messages ADD COLUMN IF NOT EXISTS class_level TEXT NOT NULL DEFAULT '';

-- ─── G. Force PostgREST to refresh its schema cache immediately ──────────────
NOTIFY pgrst, 'reload schema';
