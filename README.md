# Aage Kya? — AI Career Guidance for Indian Students

An honest, AI-powered career-guidance platform for students **after Class 10 and after Class 12**, covering **all of India and every domain** (engineering, medical, commerce, law, design, arts, agriculture, defence, vocational/diploma, and more).

Built with **React + Vite + Tailwind** on the frontend and a **Node/Express** backend, grounded on a **Supabase (Postgres)** database. Its defining feature is an **anti-hallucination AI architecture**: the LLM never invents courses, colleges, or facts — it only selects and explains from a verified dataset, and a separate "judge" model fact-checks the output.

---

## ✨ Key Features

- **AI Career Guidance** — a multi-agent engine that produces personalised paths, colleges, scholarships, roadmaps, and study-abroad advice.
- **Explore Paths (discovery quiz)** — short yes/no questionnaire that adapts to your interests and recommends real streams/courses, even ones you didn't know existed.
- **Anti-hallucination grounding** — courses, colleges, fees, and exams all come from a curated India-wide dataset; a decoupled judge LLM fact-checks explanations.
- **Nearby college matching** — recommends real colleges from the DB, ranked by your city/state.
- **Rank Predictor** — historical cutoff comparison for JEE / NEET / KCET.
- **Multi-provider AI with automatic fallback** — Groq → Gemini → OpenRouter → OpenAI, plus a token circuit-breaker and an honest "AI busy" banner so it degrades gracefully.
- **Mentors, Q&A board, scholarships, competitive-exam guides, study-abroad**, and more.

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
# Frontend (from the project root)
npm install

# Backend
cd server && npm install && cd ..
```

### 2. Set up Supabase (required)

The app uses Supabase for authentication and its database. **Free tier is enough.**

1. **Create a project** at [supabase.com](https://supabase.com) → *New project*. Note the region and set a database password.
2. **Create the tables** — open **SQL Editor** → *New query* → paste the **entire contents** of [`supabase_schema.sql`](./supabase_schema.sql) → **Run**. This creates all tables (students, guidance_results, colleges, scholarships, mentors, scenarios, Q&A, etc.) with Row-Level-Security policies.
3. **Enable Email auth** — go to **Authentication → Sign In / Providers → Email** and make sure it's enabled.
   - For quick testing you can turn **"Confirm email" OFF** (users log in instantly).
   - For production keep it **ON** (prevents spam signups).
4. **Set the Site URL** — **Authentication → URL Configuration → Site URL**:
   - Local: `http://localhost:5173`
   - Production: your deployed frontend URL.
5. **Get your API keys** — **Project Settings → API**. You'll need:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon / public key** (safe for the browser)
   - **service_role / secret key** (server-only — bypasses RLS; never expose it)

### 3. Seed the database (colleges, scholarships, mentors)

This loads ~135 colleges, 25 scholarships, and mentors so the AI has real data to ground on. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `server/.env` (see next step).

```bash
cd server && node seed.js && cd ..
```

### 4. Configure environment variables

**Frontend** — copy `.env.example` → `.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
# Leave blank in dev (Vite proxy forwards /api/* to localhost:5000)
VITE_API_URL=
```

**Backend** — copy `server/.env.example` → `server/.env`:

```dotenv
PORT=5000

# ── AI provider (at least ONE key required) ──
# The server tries providers in order and auto-falls-back if one is rate-limited.
GROQ_API_KEY=your_groq_key          # primary (fast, free)
GROQ_MODEL=llama-3.1-8b-instant

# Optional extra fallbacks — add any and they auto-join the chain:
# GEMINI_API_KEY=your_gemini_key    # must start with "AIza" (from AI Studio)
# GEMINI_MODEL=gemini-2.0-flash
# OPENROUTER_API_KEY=your_openrouter_key
# OPENAI_API_KEY=your_openai_key

# ── Supabase (same project as the frontend) ──
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # required for seed.js & analytics
```

### 5. Run

```bash
# Terminal 1 — Express backend (port 5000)
cd server && node index.js

# Terminal 2 — Vite frontend (port 5173)
npm run dev
```

Open **http://localhost:5173**.

---

## 🔑 API keys you need — where to get them

| Key | Required? | Where to get it | Notes |
|-----|-----------|-----------------|-------|
| **GROQ_API_KEY** | ✅ Yes (for AI) | [console.groq.com/keys](https://console.groq.com/keys) | Free, no card. Powers all AI guidance. Free tier ≈ 100k tokens/day. |
| **SUPABASE_URL** | ✅ Yes | Supabase → Project Settings → API | Same value in frontend + backend. |
| **SUPABASE_ANON_KEY** | ✅ Yes | Supabase → Project Settings → API | Public/browser-safe key. |
| **SUPABASE_SERVICE_ROLE_KEY** | ✅ Yes (for seed + analytics) | Supabase → Project Settings → API → service_role | **Secret** — server-only, bypasses RLS. Never commit it. |
| **GEMINI_API_KEY** | ⬜ Optional | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Free fallback. Must start with `AIza`. Create in a **new project** to ensure the free tier is enabled. |
| **OPENROUTER_API_KEY** | ⬜ Optional | [openrouter.ai/keys](https://openrouter.ai/keys) | Extra fallback, some free models. |
| **OPENAI_API_KEY** | ⬜ Optional | [platform.openai.com](https://platform.openai.com) | Paid fallback. |

> **Why multiple AI keys?** No single free LLM tier is unlimited. Adding Gemini/OpenRouter as fallbacks means when one provider is rate-limited, the app automatically switches to the next — so it effectively never runs out of AI during normal use or a demo.

> **Security:** `.env` and `server/.env` are gitignored and must never be committed. The service-role key especially must stay private. Rotate any key that has been exposed.

---

## 🏗️ Architecture

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | React 18, Vite, Tailwind CSS | `src/` |
| Backend | Node.js, Express | `server/index.js` |
| AI client | Multi-provider (Groq/Gemini/OpenRouter/OpenAI) | `server/ai/llmClient.js` — one shared client with fallback + circuit breaker |
| Guidance engine | Multi-agent orchestrator | `server/agents/Orchestrator.js` — one combined LLM call + deterministic enrichment |
| Pathway advisor | Retrieval → LLM → verify | `server/ai/pathwayAdvisor.js` — anti-hallucination pipeline |
| Grounding dataset | Curated, all-India | `server/data/indiaPathways.js` |
| Auth | Supabase Email | `src/components/AuthModal.jsx` |
| Database | Supabase (Postgres) | `supabase_schema.sql` |

### How the AI stays accurate (anti-hallucination)
1. **Retrieve** — pull candidate courses/colleges from the verified dataset + DB (deterministic, no LLM).
2. **Recommend** — the LLM selects and explains **only** from that candidate list.
3. **Verify** — every returned id is re-checked against the dataset; facts (fees, exams, duration) are overwritten from the dataset so the model can't corrupt them.
4. **Judge (optional)** — a *separate* model fact-checks each explanation against the data and flags contradictions.
5. **Fallback** — if all AI is unavailable, deterministic, domain-aware results are still returned (never blank, never generic).

---

## 🔌 Main API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/ai-status` | AI availability (drives the "AI busy" banner) |
| POST | `/api/guidance` | Full AI career guidance |
| POST | `/api/roadmap` | 4-year learning roadmap |
| GET | `/api/pathways/questions/start` | Start the Explore discovery quiz |
| POST | `/api/pathways/questions/next` | Adaptive follow-up questions |
| POST | `/api/pathways/recommend` | Grounded pathway recommendations (+ optional judge) |
| GET | `/api/predictor/predict` | Rank-vs-cutoff comparison |
| GET | `/api/mentors` | Mentor directory |
| POST | `/api/sync` | Sync local data to DB after sign-in |
| GET | `/api/analytics` | Stream/state counts (needs service role key) |

---

## 🧪 Development

```bash
npm run lint        # ESLint (frontend)
npm run build       # production build
npm test            # backend test suite (node --test)
```

---

## ⚠️ Notes & Limitations

- Fees and salary figures are **approximate ranges** — always confirm with the institution.
- The dataset is curated and India-wide but not exhaustive; it's designed to be expanded (add rows to `server/data/indiaPathways.js` and colleges via `server/seed.js`).
- AI free tiers have daily limits; add fallback keys (Gemini/OpenRouter) for heavier use.
</content>
</file>
