/**
 * onlineEducation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Curated, real online-learning platforms and starter tracks for Indian
 * students after Class 10 and after Class 12.
 *
 * Every entry is a real, well-known platform with its official homepage URL.
 * Pricing is described honestly ("free", "freemium", "paid") because plans
 * change often — always confirm current pricing on the official site.
 *
 * This is reference data (no AI generation), so it can be shown as-is and
 * unit-reasoned about without a backend.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// audience: 'class10' | 'class12' | 'both'
// pricing:  'free' | 'freemium' | 'paid'
export const PLATFORMS = [
  // ─── Entrance-exam & board prep (JEE / NEET / boards / foundation) ─────────
  {
    id: 'pw',
    name: 'Physics Wallah (PW)',
    emoji: '⚛️',
    category: 'Exam Prep',
    audience: 'both',
    pricing: 'freemium',
    focus: 'Affordable JEE, NEET, board and foundation (Class 9-10) courses.',
    bestFor: 'Students wanting low-cost, structured JEE/NEET prep in Hindi or English.',
    url: 'https://www.pw.live',
    tags: ['JEE', 'NEET', 'Boards', 'Foundation'],
  },
  {
    id: 'unacademy',
    name: 'Unacademy',
    emoji: '🎯',
    category: 'Exam Prep',
    audience: 'both',
    pricing: 'freemium',
    focus: 'Live classes for JEE, NEET, UPSC, CA, CUET and school subjects.',
    bestFor: 'Learners who like live interactive classes with top educators.',
    url: 'https://unacademy.com',
    tags: ['JEE', 'NEET', 'CUET', 'UPSC'],
  },
  {
    id: 'vedantu',
    name: 'Vedantu',
    emoji: '🧑‍🏫',
    category: 'Exam Prep',
    audience: 'both',
    pricing: 'freemium',
    focus: 'Live tutoring for CBSE/ICSE/state boards, JEE and NEET.',
    bestFor: 'Class 9-12 students wanting live doubt-solving and board support.',
    url: 'https://www.vedantu.com',
    tags: ['Boards', 'JEE', 'NEET'],
  },
  {
    id: 'byjus',
    name: "BYJU'S",
    emoji: '📱',
    category: 'Exam Prep',
    audience: 'both',
    pricing: 'paid',
    focus: 'App-based learning for school subjects and competitive exams.',
    bestFor: 'Visual learners who prefer recorded, animated concept videos.',
    url: 'https://byjus.com',
    tags: ['Boards', 'JEE', 'NEET'],
  },
  {
    id: 'aakash',
    name: 'Aakash (Digital)',
    emoji: '🩺',
    category: 'Exam Prep',
    audience: 'class12',
    pricing: 'paid',
    focus: 'NEET and JEE coaching with a strong medical-prep reputation.',
    bestFor: 'Serious NEET aspirants wanting structured coaching + test series.',
    url: 'https://www.aakash.ac.in',
    tags: ['NEET', 'JEE'],
  },

  // ─── Free & government platforms ──────────────────────────────────────────
  {
    id: 'khan',
    name: 'Khan Academy',
    emoji: '🌐',
    category: 'Free & Government',
    audience: 'both',
    pricing: 'free',
    focus: 'Completely free lessons in maths, science and more (also in Hindi).',
    bestFor: 'Building strong fundamentals at zero cost, any class.',
    url: 'https://www.khanacademy.org',
    tags: ['Free', 'Maths', 'Science'],
  },
  {
    id: 'swayam',
    name: 'SWAYAM',
    emoji: '🇮🇳',
    category: 'Free & Government',
    audience: 'class12',
    pricing: 'free',
    focus: 'Government platform with free university-level courses (paid certificate optional).',
    bestFor: 'College-level courses and credit-eligible certifications, free to learn.',
    url: 'https://swayam.gov.in',
    tags: ['Free', 'Govt', 'College credit'],
  },
  {
    id: 'nptel',
    name: 'NPTEL',
    emoji: '🎓',
    category: 'Free & Government',
    audience: 'class12',
    pricing: 'free',
    focus: 'Free IIT/IISc engineering and science lectures (paid exam for certificate).',
    bestFor: 'Engineering students wanting IIT-quality lectures for free.',
    url: 'https://nptel.ac.in',
    tags: ['Free', 'Engineering', 'IIT'],
  },
  {
    id: 'diksha',
    name: 'DIKSHA',
    emoji: '📚',
    category: 'Free & Government',
    audience: 'both',
    pricing: 'free',
    focus: 'Government school-education platform aligned to NCERT/board syllabi.',
    bestFor: 'Class 9-12 board students wanting free, syllabus-aligned material.',
    url: 'https://diksha.gov.in',
    tags: ['Free', 'Govt', 'Boards'],
  },
  {
    id: 'ndli',
    name: 'National Digital Library of India',
    emoji: '🏛️',
    category: 'Free & Government',
    audience: 'both',
    pricing: 'free',
    focus: 'Free access to millions of books, lectures and study materials.',
    bestFor: 'Self-study, references and exam material across every subject.',
    url: 'https://ndl.iitkgp.ac.in',
    tags: ['Free', 'Library'],
  },

  // ─── Skills, coding & careers ─────────────────────────────────────────────
  {
    id: 'freecodecamp',
    name: 'freeCodeCamp',
    emoji: '💻',
    category: 'Skills & Coding',
    audience: 'both',
    pricing: 'free',
    focus: 'Free, hands-on coding curriculum with real projects and certifications.',
    bestFor: 'Anyone learning web development or programming from scratch, free.',
    url: 'https://www.freecodecamp.org',
    tags: ['Free', 'Coding', 'Web Dev'],
  },
  {
    id: 'coursera',
    name: 'Coursera',
    emoji: '🏅',
    category: 'Skills & Coding',
    audience: 'class12',
    pricing: 'freemium',
    focus: 'University & industry courses (Google, IBM, Meta) — audit free, certificate paid.',
    bestFor: 'Job-ready certificates; financial aid is available for many courses.',
    url: 'https://www.coursera.org',
    tags: ['Certificates', 'Career', 'Financial aid'],
  },
  {
    id: 'edx',
    name: 'edX',
    emoji: '🎓',
    category: 'Skills & Coding',
    audience: 'class12',
    pricing: 'freemium',
    focus: 'Courses from MIT, Harvard and other top universities — audit free.',
    bestFor: 'Rigorous university-level learning; upgrade for a certificate.',
    url: 'https://www.edx.org',
    tags: ['University', 'Certificates'],
  },
  {
    id: 'gfg',
    name: 'GeeksforGeeks',
    emoji: '🧠',
    category: 'Skills & Coding',
    audience: 'class12',
    pricing: 'freemium',
    focus: 'Programming tutorials, DSA practice and placement prep.',
    bestFor: 'CS students preparing for coding interviews and placements.',
    url: 'https://www.geeksforgeeks.org',
    tags: ['Coding', 'DSA', 'Placements'],
  },
  {
    id: 'udemy',
    name: 'Udemy',
    emoji: '🎥',
    category: 'Skills & Coding',
    audience: 'class12',
    pricing: 'paid',
    focus: 'Huge marketplace of practical, affordable skill courses (often on sale).',
    bestFor: 'Learning a specific tool or skill quickly and cheaply.',
    url: 'https://www.udemy.com',
    tags: ['Skills', 'Practical'],
  },
  {
    id: 'greatlearning',
    name: 'Great Learning',
    emoji: '📈',
    category: 'Skills & Coding',
    audience: 'class12',
    pricing: 'freemium',
    focus: 'Free short courses plus paid programs in data science, coding and management.',
    bestFor: 'Free "Academy" courses to explore a career area before committing.',
    url: 'https://www.mygreatlearning.com',
    tags: ['Data Science', 'Free courses'],
  },
]

export const CATEGORIES = ['Exam Prep', 'Free & Government', 'Skills & Coding']

// Starter learning tracks — an honest "where do I begin" for common goals.
// Each track lists platform ids (from PLATFORMS) that fit the goal.
export const TRACKS = {
  class10: [
    {
      id: 'board_foundation',
      title: 'Ace Class 10 Boards & Build Foundation',
      emoji: '📗',
      desc: 'Strengthen fundamentals for boards and get a head start on Class 11-12 concepts.',
      platforms: ['khan', 'diksha', 'pw', 'vedantu'],
      firstStep: 'Pick one subject you find hardest and finish its Class 10 topics on Khan Academy or DIKSHA (both free).',
    },
    {
      id: 'early_jee_neet',
      title: 'Early JEE / NEET Foundation',
      emoji: '🔬',
      desc: 'If you already know you want engineering or medicine, start foundation prep early.',
      platforms: ['pw', 'unacademy', 'byjus'],
      firstStep: 'Try a free foundation lecture on PW and see if the teaching style suits you before paying.',
    },
    {
      id: 'explore_coding',
      title: 'Explore Coding & Creativity',
      emoji: '💡',
      desc: 'Curious about tech or design? Start experimenting now — no degree needed.',
      platforms: ['freecodecamp', 'khan'],
      firstStep: 'Do the first module of freeCodeCamp — it is 100% free and shows you if you enjoy coding.',
    },
  ],
  class12: [
    {
      id: 'jee_neet_cuet',
      title: 'Crack JEE / NEET / CUET',
      emoji: '🎯',
      desc: 'Structured entrance-exam prep with live classes and test series.',
      platforms: ['pw', 'unacademy', 'aakash', 'vedantu'],
      firstStep: 'Choose ONE platform (not three) and commit to its full test series for consistency.',
    },
    {
      id: 'coding_career',
      title: 'Coding & Tech Career',
      emoji: '💻',
      desc: 'Learn programming, web development and DSA for a software career.',
      platforms: ['freecodecamp', 'gfg', 'coursera', 'udemy'],
      firstStep: 'Finish freeCodeCamp\'s Responsive Web Design certification (free) to build your first real projects.',
    },
    {
      id: 'college_certificates',
      title: 'University Courses & Job-Ready Certificates',
      emoji: '🏅',
      desc: 'Add recognised certificates (Google, IBM, IIT) alongside your degree.',
      platforms: ['coursera', 'edx', 'swayam', 'nptel'],
      firstStep: 'Audit a Coursera course for free, or apply for financial aid to get the certificate at no cost.',
    },
    {
      id: 'data_management',
      title: 'Data Science & Management Skills',
      emoji: '📈',
      desc: 'Build in-demand analytics and business skills to stand out.',
      platforms: ['greatlearning', 'coursera', 'khan'],
      firstStep: 'Take a free Great Learning Academy course to test your interest before enrolling in a paid program.',
    },
  ],
}

/** Platforms filtered for a given audience ('class10' | 'class12'). */
export function platformsForAudience(audience) {
  return PLATFORMS.filter((p) => p.audience === audience || p.audience === 'both')
}

/** Resolve a list of platform ids to their full objects (preserving order). */
export function resolvePlatforms(ids = []) {
  return ids.map((id) => PLATFORMS.find((p) => p.id === id)).filter(Boolean)
}
