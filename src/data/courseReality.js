/**
 * courseReality.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Static curated data for the "Reality of Courses" insight layer.
 * Keys match stream names (Class 10) and common career path names (Class 12).
 *
 * Multi-language note: This file ships English content only. When i18n is
 * activated, each value here becomes a string key looked up from a translations
 * map — the structure itself remains unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const COURSE_REALITY = {

  // ── CLASS 10 STREAMS ───────────────────────────────────────────────────────

  'Science (PCM)': {
    label: 'Science (PCM)',
    emoji: '📐',
    tagline: 'High ceiling, high grind. JEE is the mountain.',
    pros: [
      'Opens the widest range of engineering & tech careers',
      'JEE Main/Advanced can get you into NITs and IITs',
      'Strong demand in software, core engineering, PSUs, defence',
      'Many private college options without JEE (direct admission)',
      'Can switch to BSc/BCA if engineering isn\'t for you',
    ],
    cons: [
      'Maths in Class 11/12 is a significant difficulty spike',
      'JEE is extremely competitive — top 2% get into IITs',
      'Coaching is expensive and time-consuming',
      'Two years with very little time for hobbies or extracurriculars',
      'Many students feel burned out by Class 12 board pressure',
    ],
    videos: [
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
      { id: '1w9jrQjHZ_g', title: 'Career Guidance for Students & Options', channel: 'Sunil Adhikari' },
    ],
    outcomes: [
      { label: 'B.Tech / Engineering', pct: 58 },
      { label: 'BSc / Pure Sciences', pct: 12 },
      { label: 'BCA / IT', pct: 10 },
      { label: 'Other / Gap / Switch', pct: 20 },
    ],
    mentorTopic: 'the reality of Science PCM, JEE preparation, and engineering career options',
  },

  'Science (PCB)': {
    label: 'Science (PCB)',
    emoji: '🧬',
    tagline: 'NEET is the gateway — but it\'s one of the hardest doors.',
    pros: [
      'MBBS is the most respected career in Indian families',
      'Multiple paths: MBBS, BDS, BAMS, BSc Nursing, Physiotherapy',
      'Biology opens biotech, research, and pharma careers',
      'Government medical seats are affordable if you crack NEET',
      'Strong job security in healthcare for decades to come',
    ],
    cons: [
      'NEET is extremely competitive — ~20 lakh applicants yearly',
      'MBBS takes 5.5 years + internship, total ~7 years before income',
      'Private medical college fees can be ₹50L–₹1 Cr total',
      'No engineering path without adding Maths separately',
      'Biology is memory-heavy — requires consistent revision',
    ],
    videos: [
      { id: '32RMiE9hXY8', title: '10 High Salary PCB Courses Without NEET', channel: 'SciAstra' },
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
    ],
    outcomes: [
      { label: 'MBBS / BDS', pct: 25 },
      { label: 'BSc Nursing / Paramedical', pct: 22 },
      { label: 'BSc Biology / Biotech', pct: 20 },
      { label: 'BAMS / BHMS / Homeopathy', pct: 13 },
      { label: 'Other / Switch', pct: 20 },
    ],
    mentorTopic: 'the reality of Science PCB, NEET preparation, and healthcare career paths',
  },

  'Science (PCMB)': {
    label: 'Science (PCMB)',
    emoji: '🔬',
    tagline: 'Maximum flexibility — but also maximum workload.',
    pros: [
      'Can attempt both JEE and NEET — keeps all options open',
      'Great for students who are genuinely undecided between engineering and medicine',
      'Opens biotech, bioinformatics, and research paths that combine both',
      'Shows strong academic commitment to colleges and employers',
    ],
    cons: [
      'Five subjects in Class 11/12 is a heavy workload',
      'Risk of spreading attention too thin — average performance in both rather than excellence in one',
      'Very few schools offer PCMB as a standard offering',
      'Coaching for both JEE and NEET simultaneously is expensive and exhausting',
    ],
    videos: [
      { id: '32RMiE9hXY8', title: '10 High Salary PCB Courses Without NEET', channel: 'SciAstra' },
      { id: '1w9jrQjHZ_g', title: 'Career Guidance for Science Students', channel: 'Sunil Adhikari' },
    ],
    outcomes: [
      { label: 'B.Tech / Engineering (JEE)', pct: 30 },
      { label: 'MBBS / Medical (NEET)', pct: 25 },
      { label: 'BSc / Research', pct: 25 },
      { label: 'Other / Switch', pct: 20 },
    ],
    mentorTopic: 'whether taking PCMB makes sense and how to handle the workload',
  },

  'Commerce': {
    label: 'Commerce',
    emoji: '📊',
    tagline: 'Business, finance, and the CA dream. Very different from school Commerce.',
    pros: [
      'Clear career paths: CA, CMA, CS, BBA, BCom, Finance',
      'CA is one of India\'s most respected professional qualifications',
      'Less rote memory vs Biology, less complex maths vs PCM',
      'Strong options for students with business interests',
      'Entrepreneurship, banking, consulting all start here',
    ],
    cons: [
      'CA exam has a low pass rate (~8–12% per attempt) — it\'s harder than most expect',
      'Accounts and Business Studies require genuine interest — boring if you\'re not into it',
      'Many Commerce students end up in generic BBA/BCom without a clear goal',
      'Less coding/tech exposure by default (you have to self-learn)',
    ],
    videos: [
      { id: 'Un3c8tK0b0E', title: 'Career Options After Class 12: Passion vs Parent expectations', channel: 'Commerce Baba' },
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
    ],
    outcomes: [
      { label: 'CA / CMA / CS (professional)', pct: 18 },
      { label: 'BBA / MBA (management)', pct: 30 },
      { label: 'BCom / Finance', pct: 28 },
      { label: 'Banking / UPSC / Govt', pct: 12 },
      { label: 'Other / Entrepreneurship', pct: 12 },
    ],
    mentorTopic: 'the reality of Commerce stream, CA exam difficulty, and career paths in business and finance',
  },

  'Arts / Humanities': {
    label: 'Arts / Humanities',
    emoji: '🎭',
    tagline: 'Underrated. The careers are real — the stigma is outdated.',
    pros: [
      'Widest variety of careers: journalism, law, civil services, psychology, teaching, design',
      'CLAT (law) is competitive but very achievable with preparation',
      'UPSC Civil Services — the most prestigious exam in India, open to all streams',
      'Easier board workload in Class 11/12 compared to Science',
      'Strong creative + communication skills that every industry needs',
    ],
    cons: [
      'Social stigma — family and peers may not take it seriously',
      'Income ramp-up is slower in early career vs engineering/medicine',
      'Requires self-direction — no one obvious coaching ecosystem like JEE/NEET',
      'Career outcomes depend heavily on the specific subject chosen',
    ],
    videos: [
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
      { id: 'Un3c8tK0b0E', title: 'Career Paths & Passion Discussion', channel: 'Commerce Baba' },
    ],
    outcomes: [
      { label: 'BA + Higher Studies / MA', pct: 30 },
      { label: 'Law (CLAT / 3yr LLB)', pct: 15 },
      { label: 'UPSC / State Services', pct: 12 },
      { label: 'Journalism / Media / Design', pct: 20 },
      { label: 'Teaching / Psychology', pct: 13 },
      { label: 'Other', pct: 10 },
    ],
    mentorTopic: 'the reality of Arts/Humanities stream and career paths in law, civil services, and media',
  },

  'Diploma / Polytechnic': {
    label: 'Diploma / Polytechnic',
    emoji: '🔧',
    tagline: 'Job-ready in 3 years, or lateral entry to B.Tech. Underestimated path.',
    pros: [
      'Job-ready in 3 years — much faster than a 4-year B.Tech',
      'Lateral entry to 2nd year B.Tech at government colleges (saves 1 year)',
      'Strong in practical, hands-on work — not just theory',
      'Fees are significantly lower than private B.Tech colleges',
      'Government diploma colleges exist in almost every district',
    ],
    cons: [
      'Perceived as "less than" B.Tech by some employers — still a stigma in some sectors',
      'Higher-level corporate jobs may prefer a full degree',
      'Lateral entry competition can be tough at top government colleges',
      'Not all Diploma programs have equal quality — depends heavily on the college',
    ],
    videos: [
      { id: '-AnvHSB9vuQ', title: 'Polytechnic Course Full Details & Jobs', channel: 'Quick Support' },
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
    ],
    outcomes: [
      { label: 'Job after Diploma (technical)', pct: 40 },
      { label: 'Lateral Entry to B.Tech', pct: 30 },
      { label: 'Government Jobs (ITI/Diploma based)', pct: 15 },
      { label: 'Further Study (B.Tech full)', pct: 10 },
      { label: 'Other', pct: 5 },
    ],
    mentorTopic: 'the reality of Diploma/Polytechnic, lateral entry to B.Tech, and job prospects after a diploma',
  },

  'ITI / Vocational': {
    label: 'ITI / Vocational',
    emoji: '⚙️',
    tagline: 'Skilled trades are in real demand. And the income is real too.',
    pros: [
      'Government ITIs have subsidised or free training',
      'Apprenticeship programs pay a stipend while you train',
      'Many ITI trades lead to direct government jobs (railways, defence, BSNL, etc.)',
      'Electrician, fitter, COPA, welder — all have genuine demand',
      'Can upgrade to diploma/polytechnic with ITI background',
    ],
    cons: [
      'Social perceptions in India still stigmatise vocational education unfairly',
      'Career ceiling can be lower without further education',
      'Quality of ITI training varies hugely by institution',
      'Limited to specific trade — less flexibility than degree holders',
    ],
    videos: [
      { id: '5AsmCgF_VnQ', title: 'ITI Course Details — Trades, Career & Salary', channel: 'Quick Support' },
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
    ],
    outcomes: [
      { label: 'Apprenticeship / Stipend Jobs', pct: 35 },
      { label: 'Government Sector (Railways, Defence)', pct: 25 },
      { label: 'Private Industry / Factories', pct: 25 },
      { label: 'Upgrade to Diploma / B.Tech', pct: 10 },
      { label: 'Self-employment / Workshop', pct: 5 },
    ],
    mentorTopic: 'the reality of ITI vocational training, government job opportunities, and skilled trade careers',
  },

  // ── CLASS 12 CAREER PATHS ──────────────────────────────────────────────────
  // Keys here match opt.path values returned by the guidance AI for Class 12

  'B.Tech / Engineering': {
    label: 'B.Tech / Engineering',
    emoji: '💻',
    tagline: '4 years of projects, placements, and late nights — then the real world.',
    pros: [
      'Strong placement record at NITs, IIITs, and many private colleges',
      'Software engineering salaries are globally competitive',
      'Diverse specialisations: CSE, ECE, Mechanical, Civil, Data Science',
      'Strong alumni networks in most engineering colleges',
    ],
    cons: [
      'College quality varies enormously — tier matters for placements',
      'Non-CS branches face harder placement scenarios',
      'First year is often disconnected from actual engineering work',
      'Expensive at private colleges (₹10–25L total)',
    ],
    videos: [
      { id: '1w9jrQjHZ_g', title: 'Engineering vs BCA/Other Options', channel: 'Sunil Adhikari' },
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
    ],
    outcomes: [
      { label: 'Software / IT Jobs', pct: 45 },
      { label: 'Core Engineering Jobs', pct: 20 },
      { label: 'Higher Studies (M.Tech/MS/MBA)', pct: 18 },
      { label: 'UPSC / Government', pct: 8 },
      { label: 'Other / Startup', pct: 9 },
    ],
    mentorTopic: 'engineering college life, branch selection, and placement realities',
  },

  'MBBS / Medicine': {
    label: 'MBBS / Medicine',
    emoji: '🩺',
    tagline: '5.5 years + internship. Rewarding, but not for everyone.',
    pros: [
      'One of the most respected careers in India and globally',
      'Government MBBS seats are affordable (₹5,000–₹50,000/yr)',
      'Strong job security — healthcare demand only grows',
      'PG specialisation opens very high earning potential',
    ],
    cons: [
      'Government seats are very limited and extremely competitive',
      'Private MBBS fees can be ₹50L–₹1.5 Cr total',
      'Long study period — 5.5 years + 1 year internship + PG (3 years)',
      'Mental health challenges are well-documented among MBBS students',
    ],
    videos: [
      { id: '32RMiE9hXY8', title: '10 High Salary PCB Courses Without NEET', channel: 'SciAstra' },
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
    ],
    outcomes: [
      { label: 'General Practice / GP', pct: 28 },
      { label: 'MD / MS Specialisation', pct: 35 },
      { label: 'Hospital / Corporate Practice', pct: 22 },
      { label: 'Research / Teaching', pct: 10 },
      { label: 'Other (health admin, NGO)', pct: 5 },
    ],
    mentorTopic: 'the reality of MBBS life, NEET preparation after 12th, and medical college costs',
  },

  'BBA / Business / Management': {
    label: 'BBA / Business / Management',
    emoji: '📈',
    tagline: 'Management begins at the undergrad level. MBA is the upgrade.',
    pros: [
      'Wide range of careers: marketing, finance, HR, consulting, entrepreneurship',
      'Good BBA colleges have strong corporate connections and internships',
      'Directly feeds into MBA programs at top B-schools',
      'Flexibility — you can pivot industries after BBA + MBA',
    ],
    cons: [
      'BBA alone has limited impact — most serious roles need an MBA',
      'Top MBA programs (IIMs) are extremely competitive',
      'Quality of BBA varies — tier matters significantly for placements',
      'Risk of vague career direction without a clear specialisation',
    ],
    videos: [
      { id: 'Un3c8tK0b0E', title: 'Career Options After Class 12: Passion vs Parent expectations', channel: 'Commerce Baba' },
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
    ],
    outcomes: [
      { label: 'MBA / PGDM (Top B-school)', pct: 35 },
      { label: 'Corporate (Marketing, Sales, HR)', pct: 30 },
      { label: 'Finance / Banking', pct: 15 },
      { label: 'Entrepreneurship', pct: 10 },
      { label: 'Other', pct: 10 },
    ],
    mentorTopic: 'the reality of BBA, MBA prospects, and business career paths from a Commerce background',
  },

  'B.Des / Design': {
    label: 'B.Des / Design',
    emoji: '🎨',
    tagline: 'Portfolio-first career. Your work speaks louder than your college.',
    pros: [
      'Creative, expressive career with growing demand in UI/UX and product',
      'NIFT, NID, and top design schools have strong placement records',
      'Freelancing and remote work are very accessible',
      'Design thinking is valued in every industry now',
    ],
    cons: [
      'NIFT/NID entrance is competitive and requires portfolio preparation',
      'Income can be variable, especially early in career',
      'Subjective field — success depends heavily on taste, networking, and hustle',
      'Family may not understand or value a design degree initially',
    ],
    videos: [
      { id: '2QQQtiFwXjU', title: 'Google UX Design Certificate: Introduction to UI/UX', channel: 'Google Career Certificates' },
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
    ],
    outcomes: [
      { label: 'UI/UX Designer', pct: 30 },
      { label: 'Graphic / Brand Designer', pct: 25 },
      { label: 'Fashion / Textile', pct: 15 },
      { label: 'Product / Industrial Design', pct: 15 },
      { label: 'Freelance / Studio', pct: 15 },
    ],
    mentorTopic: 'the reality of design education in India, NIFT/NID admissions, and design career paths',
  },

  'BCA / Computer Applications': {
    label: 'BCA / Computer Applications',
    emoji: '🖥️',
    tagline: 'A practical CS degree for students outside PCM. Underrated.',
    pros: [
      'Open to Commerce and Arts students without Maths background in some colleges',
      'Coding-focused — directly relevant for software jobs',
      'Good bridge to MCA (Master of Computer Applications)',
      'Lower fees than B.Tech private colleges',
    ],
    cons: [
      'Perception gap vs B.Tech CSE among some employers',
      'Quality varies widely by college',
      'Requires genuine self-learning to stay current with industry tools',
      'Less campus placement ecosystem than engineering colleges',
    ],
    videos: [
      { id: '1w9jrQjHZ_g', title: 'BCA Course Details, Syllabus, Jobs & Salary', channel: 'Sunil Adhikari' },
    ],
    outcomes: [
      { label: 'Software Developer / SDE', pct: 40 },
      { label: 'MCA / Higher Study', pct: 25 },
      { label: 'Web / App Developer (freelance)', pct: 20 },
      { label: 'IT Support / Systems', pct: 10 },
      { label: 'Other', pct: 5 },
    ],
    mentorTopic: 'the reality of BCA, job prospects in software without a B.Tech, and career paths in IT',
  },

  'Law (CLAT / LLB)': {
    label: 'Law (CLAT / LLB)',
    emoji: '⚖️',
    tagline: 'CLAT at 17 or LLB at 21 — both lead to the same destination.',
    pros: [
      'National Law Universities (NLUs) have excellent placements at top law firms',
      'Highly transferable skills — critical thinking, writing, negotiation',
      'Multiple paths: litigation, corporate law, judiciary, policy, academia',
      'CLAT is achievable with 6–8 months of focused preparation',
    ],
    cons: [
      'First 3–5 years in litigation are financially challenging (small income)',
      'Big law firm careers are demanding — very long hours',
      'Top NLU seats are limited (1–2 per state roughly)',
      'Indian legal system is slow — can be frustrating for those seeking quick results',
    ],
    videos: [
      { id: 'qynj8GqnY1U', title: 'How to Choose the Right Career Path', channel: 'Sandeep Maheshwari' },
      { id: 'Un3c8tK0b0E', title: 'Career Options & Personal Passion', channel: 'Commerce Baba' },
    ],
    outcomes: [
      { label: 'Corporate Law / Law Firm', pct: 30 },
      { label: 'Litigation / Courts', pct: 25 },
      { label: 'Judiciary (Judge) exams', pct: 15 },
      { label: 'Government / Policy / NGO', pct: 15 },
      { label: 'Academia / Research', pct: 8 },
      { label: 'Other', pct: 7 },
    ],
    mentorTopic: 'the reality of law school in India, CLAT preparation, and legal career paths',
  },

  'BSc / Pure Sciences': {
    label: 'BSc / Pure Sciences',
    emoji: '🔭',
    tagline: 'Research, academia, or a pivot — but you need a plan.',
    pros: [
      'Strong foundation for research, MSc, and PhD pathways',
      'GATE / JAM open doors to IITs and NITs for postgrad',
      'Lower fees than professional degrees',
      'For students who genuinely love the subject over career pressure',
    ],
    cons: [
      'BSc alone has limited direct job market pull in India',
      'Requires MSc/PhD for research roles — long journey',
      'Average salaries start lower than engineering / medicine',
      'Family may question "what will you do with this?"',
    ],
    videos: [
      { id: '32RMiE9hXY8', title: '10 High Salary PCB Courses Without NEET', channel: 'SciAstra' },
    ],
    outcomes: [
      { label: 'MSc / Higher Study / Research', pct: 45 },
      { label: 'Teaching (school/college)', pct: 20 },
      { label: 'Government Exams (UPSC, SSC)', pct: 15 },
      { label: 'Industry (lab, pharma, QC)', pct: 12 },
      { label: 'Other', pct: 8 },
    ],
    mentorTopic: 'the reality of BSc, research career paths in India, and how to plan after pure sciences',
  },
}

/**
 * Returns reality data for a given stream or path key.
 * Falls back to a generic template if no exact match is found.
 */
export function getCourseReality(key) {
  if (!key) return null
  // Exact match
  if (COURSE_REALITY[key]) return COURSE_REALITY[key]

  const normalized = normalizeRealityKey(key)
  if (!normalized) return null

  // Normalized exact match (tolerates casing / spacing drift only).
  const exact = Object.keys(COURSE_REALITY).find(k => normalizeRealityKey(k) === normalized)
  if (exact) return COURSE_REALITY[exact]

  // FULL-string containment — e.g. "Science (PCM) with Tech Focus" → "Science (PCM)".
  // Never first-word matching: "Science (PCB) with Research" must not fall into
  // "Science (PCM)" just because both start with "Science".
  const contained = Object.keys(COURSE_REALITY).find(k => {
    const nk = normalizeRealityKey(k)
    return nk.length > 0 && (normalized.includes(nk) || nk.includes(normalized))
  })
  return contained ? COURSE_REALITY[contained] : null
}

/** trim + collapse inner whitespace + lower-case. */
function normalizeRealityKey(key) {
  return String(key ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}
