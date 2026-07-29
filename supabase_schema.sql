-- ============================================================
-- "Aage Kya?" PostgreSQL Schema (Supabase)
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================

-- ─── 1. Students Profile Table ───────────────────────────────
-- Linked 1-to-1 with Supabase Auth users (auth.users).
-- id == auth.uid() so RLS policies work transparently.

CREATE TABLE IF NOT EXISTS public.students (
  id                 UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          TEXT        NOT NULL DEFAULT '',
  state              TEXT        NOT NULL DEFAULT '',
  board              TEXT        NOT NULL DEFAULT '',
  stream             TEXT        NOT NULL DEFAULT '',
  marks              NUMERIC     NOT NULL DEFAULT 0,
  income_range       TEXT        NOT NULL DEFAULT '',
  first_gen_college  BOOLEAN     NOT NULL DEFAULT false,
  preferred_cities   TEXT[]      NOT NULL DEFAULT '{}',
  interests          TEXT        NOT NULL DEFAULT '',
  biggest_fear       TEXT        NOT NULL DEFAULT '',
  class_level        TEXT        NOT NULL DEFAULT 'class12',
  parent_pressure    BOOLEAN,
  parent_expectations TEXT,
  risk_comfort       TEXT,
  coaching_access    BOOLEAN,
  academic_wallet    JSONB       NOT NULL DEFAULT '[]',
  history            JSONB       NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 2. AI Guidance Results ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.guidance_results (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  summary                   TEXT        NOT NULL,
  options                   JSONB       NOT NULL,
  scholarship_to_check      TEXT        NOT NULL,
  one_thing_to_do_this_week TEXT        NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 3. AI 4-Year Learning Roadmaps ──────────────────────────
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  career_path TEXT        NOT NULL,
  overview    TEXT        NOT NULL,
  years       JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ─── 4. Auto-update updated_at on students ───────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_updated_at ON public.students;
CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. Row Level Security ────────────────────────────────────
ALTER TABLE public.students         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guidance_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmaps         ENABLE ROW LEVEL SECURITY;

-- Students can only read/write their own row.
DROP POLICY IF EXISTS "students_self_rw" ON public.students;
CREATE POLICY "students_self_rw"
  ON public.students FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "guidance_self_rw" ON public.guidance_results;
CREATE POLICY "guidance_self_rw"
  ON public.guidance_results FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "roadmaps_self_rw" ON public.roadmaps;
CREATE POLICY "roadmaps_self_rw"
  ON public.roadmaps FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ─── 6. Analytics Views (pitch-deck data) ────────────────────
-- These views are readable ONLY via the service role key (bypasses RLS).
-- Call GET /api/analytics on the backend (server/index.js) to query safely.

-- "How many students chose each stream?"
CREATE OR REPLACE VIEW public.v_students_by_stream AS
  SELECT stream, COUNT(*) AS student_count
  FROM public.students
  GROUP BY stream
  ORDER BY student_count DESC;

-- "How many students per state?"
CREATE OR REPLACE VIEW public.v_students_by_state AS
  SELECT state, COUNT(*) AS student_count
  FROM public.students
  GROUP BY state
  ORDER BY student_count DESC;

-- "Income distribution — useful for grant applications and impact framing"
CREATE OR REPLACE VIEW public.v_students_by_income AS
  SELECT income_range, COUNT(*) AS student_count
  FROM public.students
  GROUP BY income_range
  ORDER BY student_count DESC;

-- "First-gen vs returning college families"
CREATE OR REPLACE VIEW public.v_first_gen_split AS
  SELECT first_gen_college, COUNT(*) AS student_count
  FROM public.students
  GROUP BY first_gen_college;

-- ─── 7. Useful ad-hoc queries (run in SQL editor) ────────────
-- Cross-tab: stream × state breakdown for the pitch deck.
-- SELECT stream, state, COUNT(*) AS n
-- FROM public.students
-- GROUP BY stream, state
-- ORDER BY n DESC
-- LIMIT 30;

-- ─── 8. Colleges Reference Table (Phase 3 — RAG grounding) ───
-- Populated by running: cd server && node seed.js
-- Public SELECT — no auth required (reference data).
-- Only insertable via service role key (seed script).

CREATE TABLE IF NOT EXISTS public.colleges (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL UNIQUE,
  state             TEXT        NOT NULL,
  city              TEXT        NOT NULL,
  streams           TEXT[]      NOT NULL DEFAULT '{}',
  min_marks         NUMERIC     NOT NULL DEFAULT 0,
  max_marks         NUMERIC     NOT NULL DEFAULT 100,
  yearly_cost_min   INTEGER     NOT NULL DEFAULT 0,   -- INR per year
  yearly_cost_max   INTEGER     NOT NULL DEFAULT 0,
  college_type      TEXT        NOT NULL DEFAULT 'private', -- central | state | private | deemed
  national          BOOLEAN     NOT NULL DEFAULT false,     -- accepts students from all states
  source_url        TEXT        NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Fast array-overlap queries for stream filtering
CREATE INDEX IF NOT EXISTS idx_colleges_streams ON public.colleges USING GIN (streams);
CREATE INDEX IF NOT EXISTS idx_colleges_state   ON public.colleges (state);

-- RLS: enable but allow public reads (no auth required for reference data)
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colleges_public_read" ON public.colleges;
CREATE POLICY "colleges_public_read"
  ON public.colleges FOR SELECT USING (true);

-- ─── 9. Scholarships Reference Table (Phase 3 — RAG grounding) ───
-- Populated by running: cd server && node seed.js
-- Public SELECT — no auth required.

CREATE TABLE IF NOT EXISTS public.scholarships (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT    NOT NULL UNIQUE,
  description                 TEXT    NOT NULL DEFAULT '',
  eligibility_income_max_lakh NUMERIC NOT NULL DEFAULT 99,  -- 99 = no income limit
  eligibility_marks_min       NUMERIC NOT NULL DEFAULT 0,
  eligible_streams            TEXT[]  NOT NULL DEFAULT '{}', -- [] or ['All'] means any stream
  eligible_states             TEXT[]  NOT NULL DEFAULT '{}', -- [] or ['All'] means any state
  application_url             TEXT    NOT NULL DEFAULT '',
  deadline_pattern            TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_scholarships_streams ON public.scholarships USING GIN (eligible_streams);

ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scholarships_public_read" ON public.scholarships;
CREATE POLICY "scholarships_public_read"
  ON public.scholarships FOR SELECT USING (true);

-- ─── 10. Mentors Table (Phase 4 — Real Mentor Connect) ───────────
-- Public SELECT — no auth required.
-- Insert/Update/Delete restricted to service role key.

CREATE TABLE IF NOT EXISTS public.mentors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL UNIQUE,
  initials        TEXT        NOT NULL,
  college         TEXT        NOT NULL,
  degree          TEXT        NOT NULL,
  stream          TEXT        NOT NULL,                      -- e.g. "PCB → ECE"
  stream_category TEXT        NOT NULL,                      -- e.g. "Science (PCB)" (for matching)
  city            TEXT        NOT NULL,
  cal_link        TEXT        NOT NULL DEFAULT '#',
  story           TEXT        NOT NULL,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  gradient        TEXT        NOT NULL DEFAULT 'from-blue-500/30 to-blue-600/10',
  border          TEXT        NOT NULL DEFAULT 'border-blue-500/25',
  tag_color       TEXT        NOT NULL DEFAULT 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  initials_bg     TEXT        NOT NULL DEFAULT 'bg-blue-500/20 text-blue-300',
  available       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Add unique constraint if the table was already created without it
ALTER TABLE public.mentors DROP CONSTRAINT IF EXISTS mentors_name_key;
ALTER TABLE public.mentors ADD CONSTRAINT mentors_name_key UNIQUE (name);

CREATE INDEX IF NOT EXISTS idx_mentors_stream_category ON public.mentors (stream_category);
CREATE INDEX IF NOT EXISTS idx_mentors_tags ON public.mentors USING GIN (tags);

ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mentors_public_read" ON public.mentors;
CREATE POLICY "mentors_public_read"
  ON public.mentors FOR SELECT USING (true);

-- ─── 11. Mentor Applications Table (Phase 4 — Volunteer pipeline) ───
-- RLS enabled. No public policies. Only readable/writable by admin client via service role key.

CREATE TABLE IF NOT EXISTS public.mentor_applications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  email             TEXT        NOT NULL,
  college           TEXT        NOT NULL,
  degree            TEXT        NOT NULL,
  stream_transition TEXT        NOT NULL,
  story             TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at        TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.mentor_applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to INSERT an application (no account needed to apply)
DROP POLICY IF EXISTS "mentor_applications_public_insert" ON public.mentor_applications;
CREATE POLICY "mentor_applications_public_insert"
  ON public.mentor_applications FOR INSERT WITH CHECK (true);


-- ─── 12. Role support & Class 10 extensions for students ─────────────────────
-- Adds a role column so we can distinguish regular students from mentors.
-- Also adds Class 10 specific profile attributes.
-- Values for role: 'student' (default) | 'mentor'

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_level TEXT NOT NULL DEFAULT 'class12';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_pressure BOOLEAN;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_expectations TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS risk_comfort TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS coaching_access BOOLEAN;

-- ─── 13. Mentor account linkage ───────────────────────────────────────────────
-- Links a mentor profile row to an auth.users account.
-- NULL means the mentor hasn't claimed their account yet.

ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_mentors_user_id ON public.mentors (user_id);

-- Mentors can update their own row (e.g. set availability, update linkedin)
DROP POLICY IF EXISTS "mentors_self_write" ON public.mentors;
CREATE POLICY "mentors_self_write"
  ON public.mentors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─── 14. Chat Sessions ────────────────────────────────────────────────────────
-- One session per (student, mentor) pair — unique so we reuse sessions.

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_id   UUID        NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (student_id, mentor_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_student ON public.chat_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_mentor  ON public.chat_sessions (mentor_id);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Students can see their own sessions; mentors can see sessions for their mentor profile.
DROP POLICY IF EXISTS "chat_sessions_participant_read" ON public.chat_sessions;
CREATE POLICY "chat_sessions_participant_read"
  ON public.chat_sessions FOR SELECT
  USING (
    auth.uid() = student_id
    OR auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id)
  );

-- Only the student can create a session.
DROP POLICY IF EXISTS "chat_sessions_student_insert" ON public.chat_sessions;
CREATE POLICY "chat_sessions_student_insert"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = student_id);


-- ─── 15. Chat Messages ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages (session_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Only participants (student or the linked mentor) can read messages.
DROP POLICY IF EXISTS "chat_messages_participant_read" ON public.chat_messages;
CREATE POLICY "chat_messages_participant_read"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id
        AND (
          auth.uid() = s.student_id
          OR auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = s.mentor_id)
        )
    )
  );

-- Only participants can send messages.
DROP POLICY IF EXISTS "chat_messages_participant_insert" ON public.chat_messages;
CREATE POLICY "chat_messages_participant_insert"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id
        AND (
          auth.uid() = s.student_id
          OR auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = s.mentor_id)
        )
    )
  );

-- Enable Supabase Realtime for chat_messages so clients get live updates.
-- Run in Supabase SQL editor:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;

-- ─── MIGRATION (Phase 2 Additions) ──────────────────────────────────────────
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS academic_wallet JSONB NOT NULL DEFAULT '[]';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]';

-- ─── MIGRATION (Phase 3 Additions) ──────────────────────────────────────────

-- Role column on students (student | mentor | parent)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

-- Confidence + AI parent summary on guidance_results
ALTER TABLE public.guidance_results ADD COLUMN IF NOT EXISTS confidence_score   INT  NOT NULL DEFAULT 0;
ALTER TABLE public.guidance_results ADD COLUMN IF NOT EXISTS confidence_label   TEXT NOT NULL DEFAULT 'Medium';
ALTER TABLE public.guidance_results ADD COLUMN IF NOT EXISTS confidence_reason  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.guidance_results ADD COLUMN IF NOT EXISTS parent_summary     TEXT NOT NULL DEFAULT '';
ALTER TABLE public.guidance_results ADD COLUMN IF NOT EXISTS scholarships_list  JSONB NOT NULL DEFAULT '[]';

-- ─── 16. Scenarios ("what-if" saved guidance versions) ──────────────────────
CREATE TABLE IF NOT EXISTS public.scenarios (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  label           TEXT        NOT NULL DEFAULT 'Untitled Scenario',
  form_data       JSONB       NOT NULL DEFAULT '{}',
  guidance_result JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_scenarios_student ON public.scenarios (student_id, created_at DESC);
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scenarios_self_rw" ON public.scenarios;
CREATE POLICY "scenarios_self_rw"
  ON public.scenarios FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- ─── 17. Mentor Sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentor_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mentor_id       UUID        NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  session_date    TIMESTAMPTZ,
  status          TEXT        NOT NULL DEFAULT 'pending',   -- pending | confirmed | completed | cancelled
  notes           TEXT        NOT NULL DEFAULT '',          -- mentor writes after session
  rating          INT         CHECK (rating BETWEEN 1 AND 5),
  rating_comment  TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mentor_sessions_student ON public.mentor_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_mentor  ON public.mentor_sessions (mentor_id);
ALTER TABLE public.mentor_sessions ENABLE ROW LEVEL SECURITY;

-- Students read/write their own sessions
DROP POLICY IF EXISTS "mentor_sessions_student_rw" ON public.mentor_sessions;
CREATE POLICY "mentor_sessions_student_rw"
  ON public.mentor_sessions FOR ALL
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Mentors can read and update sessions where they are the mentor
DROP POLICY IF EXISTS "mentor_sessions_mentor_read" ON public.mentor_sessions;
CREATE POLICY "mentor_sessions_mentor_read"
  ON public.mentor_sessions FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

DROP POLICY IF EXISTS "mentor_sessions_mentor_update" ON public.mentor_sessions;
CREATE POLICY "mentor_sessions_mentor_update"
  ON public.mentor_sessions FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.mentors WHERE id = mentor_id));

-- ─── 18. Q&A Board ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.qa_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_id    UUID        REFERENCES public.mentors(id) ON DELETE SET NULL,
  stream_tag   TEXT        NOT NULL DEFAULT '',
  question     TEXT        NOT NULL,
  answer       TEXT        NOT NULL DEFAULT '',
  answered_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_qa_posts_created ON public.qa_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_posts_mentor  ON public.qa_posts (mentor_id);
ALTER TABLE public.qa_posts ENABLE ROW LEVEL SECURITY;

-- Public read, authenticated insert, own delete
DROP POLICY IF EXISTS "qa_posts_public_read"   ON public.qa_posts;
CREATE POLICY "qa_posts_public_read"   ON public.qa_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "qa_posts_auth_insert"   ON public.qa_posts;
CREATE POLICY "qa_posts_auth_insert"   ON public.qa_posts FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "qa_posts_own_delete"    ON public.qa_posts;
CREATE POLICY "qa_posts_own_delete"    ON public.qa_posts FOR DELETE USING (auth.uid() = author_id);

-- Mentors can update (answer) any post
DROP POLICY IF EXISTS "qa_posts_mentor_update" ON public.qa_posts;
CREATE POLICY "qa_posts_mentor_update"
  ON public.qa_posts FOR UPDATE
  USING (
    auth.uid() IN (SELECT user_id FROM public.mentors WHERE id IS NOT NULL)
    OR auth.uid() = author_id
  );

-- ─── 19. Notifications ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,          -- guidance_ready | session_confirmed | scholarship_deadline
  payload    JSONB       NOT NULL DEFAULT '{}',
  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_self_rw" ON public.notifications;
CREATE POLICY "notifications_self_rw"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Course Feedback Table (Phase 4 — Reality of Courses) ────────────────────
-- Students submit feedback about a specific stream/path.
-- Moderated: approved = false by default; only approved entries are publicly visible.
-- Approval is done via service role key (admin only, not exposed to students).

CREATE TABLE IF NOT EXISTS public.course_feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_key  TEXT        NOT NULL,
  author_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 20 AND 1000),
  helpful     BOOLEAN,
  approved    BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_course_feedback_stream ON public.course_feedback (stream_key, approved, created_at DESC);
ALTER TABLE public.course_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved feedback (public read)
DROP POLICY IF EXISTS "feedback_public_read" ON public.course_feedback;
CREATE POLICY "feedback_public_read"
  ON public.course_feedback FOR SELECT
  USING (approved = true);

-- Authenticated users can insert their own feedback
DROP POLICY IF EXISTS "feedback_auth_insert" ON public.course_feedback;
CREATE POLICY "feedback_auth_insert"
  ON public.course_feedback FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Authors can view their own pending feedback
DROP POLICY IF EXISTS "feedback_self_read" ON public.course_feedback;
CREATE POLICY "feedback_self_read"
  ON public.course_feedback FOR SELECT
  USING (auth.uid() = author_id);

