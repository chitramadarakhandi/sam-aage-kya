/**
 * collegeEnrichment.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Static curated enrichment for well-known Indian colleges.
 *
 * Keys are the FULL institution names the app actually produces (the `name`
 * strings in server/seed.js and the Orchestrator's fallback college lists), so
 * a lookup is an exact, normalized (trim + lower-case) map hit.
 *
 * This used to be keyed by abbreviations and looked up with substring /
 * first-word matching, which cross-matched unrelated institutions: "NIT Patna"
 * returned NIT Trichy's fees and placements, every "AIIMS <city>" returned AIIMS
 * New Delhi's, "MS Ramaiah Medical College" returned MSRIT's. Lookup is now
 * exact-match only — a miss returns null (and the caller falls back to the
 * per-institution API), never another college's data.
 *
 * ALIASES map well-known short names to a full key. They are exact-match keys
 * too — never substrings — so they cannot reintroduce collisions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const COLLEGE_ENRICHMENT = {
  'RV College of Engineering': {
    fullName: 'RV College of Engineering',
    state: 'Karnataka',
    city: 'Bangalore',
    type: 'Private Aided',
    established: 1963,
    website: 'https://rvce.edu.in',
    linkedin: 'https://www.linkedin.com/school/rv-college-of-engineering/',
    naac: 'A+',
    nirf: 'Top 100 Engineering Colleges India',
    fees: { govtQuota: '₹52,000–₹70,000/yr (KCET seats)', managementQuota: '₹1.5L–₹2.5L/yr (COMEDK/Mgmt seats)' },
    cutoffs: { kcet: 'Rank < 500 for CS, < 1500 for EC/IS', comedk: 'Score > 100/180 for CS', jee: 'Not applicable' },
    placements: { avgPackage: '₹8–12 LPA', topRecruiters: ['Microsoft', 'Amazon', 'Infosys', 'Wipro', 'Goldman Sachs'] },
    reviews: '"Excellent infrastructure and strong alumni network. Placements are consistent for CS/IS." — 2023 Graduate',
    youtube: 'https://www.youtube.com/results?search_query=RVCE+Bangalore+review+campus',
  },
  'MS Ramaiah Institute of Technology': {
    fullName: 'M S Ramaiah Institute of Technology',
    state: 'Karnataka',
    city: 'Bangalore',
    type: 'Private Aided',
    established: 1962,
    website: 'https://msrit.edu',
    linkedin: 'https://www.linkedin.com/school/m-s-ramaiah-institute-of-technology/',
    naac: 'A++',
    nirf: 'Top 75 Engineering Colleges India',
    fees: { govtQuota: '₹45,000–₹65,000/yr (KCET)', managementQuota: '₹1.8L–₹2.8L/yr (COMEDK/Mgmt)' },
    cutoffs: { kcet: 'Rank < 800 for CS, < 2000 for EC', comedk: 'Score > 95/180 for CS', jee: 'Not applicable' },
    placements: { avgPackage: '₹7–11 LPA', topRecruiters: ['TCS', 'Accenture', 'Bosch', 'IBM', 'Capgemini'] },
    reviews: '"Strong alumni base. Hostel and labs are well-maintained. Good for core engineering jobs." — 2022 Graduate',
    youtube: 'https://www.youtube.com/results?search_query=MSRIT+Bangalore+campus+tour',
  },
  'BMS College of Engineering': {
    fullName: 'BMS College of Engineering',
    state: 'Karnataka',
    city: 'Bangalore',
    type: 'Private Aided',
    established: 1946,
    website: 'https://bmsce.ac.in',
    linkedin: 'https://www.linkedin.com/school/bms-college-of-engineering/',
    naac: 'A+',
    fees: { govtQuota: '₹50,000–₹68,000/yr (KCET)', managementQuota: '₹1.6L–₹2.4L/yr' },
    cutoffs: { kcet: 'Rank < 1200 for CS', comedk: 'Score > 90/180 for CS', jee: 'Not applicable' },
    placements: { avgPackage: '₹6.5–10 LPA', topRecruiters: ['Wipro', 'HCL', 'L&T', 'Oracle', 'Mindtree'] },
    reviews: '"Legacy institution with strong Bangalore industry connections. Good culture." — 2023 Alumni',
    youtube: 'https://www.youtube.com/results?search_query=BMS+College+Engineering+Bangalore',
  },
  'NIT Trichy': {
    fullName: 'National Institute of Technology Tiruchirappalli',
    state: 'Tamil Nadu',
    city: 'Trichy',
    type: 'Government (Central)',
    established: 1964,
    website: 'https://nitt.edu',
    linkedin: 'https://www.linkedin.com/school/national-institute-of-technology-tiruchirappalli/',
    naac: 'A++',
    nirf: 'Rank 8 in Engineering (NIRF 2023)',
    fees: { govtQuota: '₹70,000–₹90,000/yr (Govt. funded)', managementQuota: 'N/A (all JEE seats)' },
    cutoffs: { jee: 'JEE Main Rank < 1500 for CS (GEN), < 3000 for EC', kcet: 'Not applicable', neet: 'Not applicable' },
    placements: { avgPackage: '₹12–18 LPA (CS)', topRecruiters: ['NVIDIA', 'Google', 'Samsung', 'TCS', 'Qualcomm', 'Goldman Sachs'] },
    reviews: '"One of India\'s best NITs. Campus life, academics, and placements are outstanding." — NIT Trichy 2022',
    youtube: 'https://www.youtube.com/results?search_query=NIT+Trichy+campus+tour+review',
  },
  'IIT Bombay': {
    fullName: 'Indian Institute of Technology Bombay',
    state: 'Maharashtra',
    city: 'Mumbai',
    type: 'Government (Central/Premier)',
    established: 1958,
    website: 'https://iitb.ac.in',
    linkedin: 'https://www.linkedin.com/school/iit-bombay/',
    naac: 'Not rated (top public institute)',
    nirf: 'Rank 3 in Engineering (NIRF 2023)',
    fees: { govtQuota: '₹1–1.2L/yr (subsidized, heavily grant-funded)', managementQuota: 'N/A — all JEE Advanced' },
    cutoffs: { jee: 'JEE Advanced Rank < 63 for CS (GEN)', kcet: 'Not applicable', neet: 'Not applicable' },
    placements: { avgPackage: '₹20–50 LPA (CS median ₹28 LPA)', topRecruiters: ['Google', 'Microsoft', 'Goldman Sachs', 'Uber', 'Stripe', 'Jane Street'] },
    reviews: '"World-class faculty, incredible alumni network, high pressure but transformative experience." — IITB 2021',
    youtube: 'https://www.youtube.com/results?search_query=IIT+Bombay+campus+tour+2024',
  },
  'AIIMS New Delhi': {
    fullName: 'All India Institute of Medical Sciences, New Delhi',
    state: 'Delhi',
    city: 'New Delhi',
    type: 'Government (Central/Premier)',
    established: 1956,
    website: 'https://aiims.edu',
    linkedin: 'https://www.linkedin.com/school/aiims-new-delhi/',
    naac: 'Not rated (top medical institute)',
    fees: { govtQuota: '₹1,390/yr (heavily subsidized)', managementQuota: 'N/A — all NEET' },
    cutoffs: { neet: 'NEET Rank < 50 (GEN) for MBBS', jee: 'Not applicable' },
    placements: { avgPackage: 'Doctors earn ₹8–30 LPA depending on specialization', topRecruiters: ['Government Hospitals', 'Private Hospitals', 'WHO', 'ICMR'] },
    reviews: '"The pinnacle of medical education in India. Unmatched clinical exposure and research." — AIIMS Resident 2023',
    youtube: 'https://www.youtube.com/results?search_query=AIIMS+Delhi+campus+MBBS+experience',
  },
  'National Law School of India University': {
    fullName: 'National Law School of India University',
    state: 'Karnataka',
    city: 'Bangalore',
    type: 'Government (State University)',
    established: 1987,
    website: 'https://nls.ac.in',
    linkedin: 'https://www.linkedin.com/school/national-law-school-of-india-university/',
    fees: { govtQuota: '₹1.2L–₹1.8L/yr', managementQuota: 'N/A — all CLAT' },
    cutoffs: { clat: 'CLAT All India Rank < 70 (GEN)', jee: 'Not applicable' },
    placements: { avgPackage: '₹12–25 LPA (corporate law firms)', topRecruiters: ['AZB & Partners', 'Cyril Amarchand', 'Khaitan & Co', 'Trilegal', 'Global Law Firms'] },
    reviews: '"India\'s best law school. Incredible intellectual culture and alumni in top positions globally." — NLSIU 2022',
    youtube: 'https://www.youtube.com/results?search_query=NLSIU+Bangalore+campus+CLAT',
  },
  'BITS Pilani': {
    fullName: 'Birla Institute of Technology and Science, Pilani',
    state: 'Rajasthan',
    city: 'Pilani',
    type: 'Private (Deemed University)',
    established: 1964,
    website: 'https://bits-pilani.ac.in',
    linkedin: 'https://www.linkedin.com/school/bits-pilani/',
    naac: 'A',
    nirf: 'Rank 22 in Engineering (NIRF 2023)',
    fees: { govtQuota: 'N/A (no govt seats)', managementQuota: '₹5.5L–₹6.5L/yr (all BITSAT)' },
    cutoffs: { bitsat: 'Score > 330/450 for CS (Pilani)', jee: 'Not applicable' },
    placements: { avgPackage: '₹15–28 LPA (CS)', topRecruiters: ['Google', 'Microsoft', 'Amazon', 'DE Shaw', 'Samsung R&D'] },
    reviews: '"Campus culture is second to none. Practice School internship is industry-defining." — BITSian 2023',
    youtube: 'https://www.youtube.com/results?search_query=BITS+Pilani+campus+tour+review',
  },
}

/**
 * Well-known short names / alternate spellings → canonical enrichment key.
 * Matched EXACTLY (after trim + lower-case) — never as a substring.
 */
export const COLLEGE_ENRICHMENT_ALIASES = {
  'rvce': 'RV College of Engineering',
  'msrit': 'MS Ramaiah Institute of Technology',
  'm s ramaiah institute of technology': 'MS Ramaiah Institute of Technology',
  'bmsce': 'BMS College of Engineering',
  'national institute of technology tiruchirappalli': 'NIT Trichy',
  'nit tiruchirappalli': 'NIT Trichy',
  'indian institute of technology bombay': 'IIT Bombay',
  'iitb': 'IIT Bombay',
  'all india institute of medical sciences, new delhi': 'AIIMS New Delhi',
  'aiims delhi': 'AIIMS New Delhi',
  'nlsiu': 'National Law School of India University',
  'nlsiu bangalore': 'National Law School of India University',
  'birla institute of technology and science, pilani': 'BITS Pilani',
}

/** trim + collapse inner whitespace + lower-case, so lookups are order-1 exact. */
export function normalizeCollegeKey(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

// Prebuilt normalized index — O(1) lookups, no partial matching possible.
const ENRICHMENT_INDEX = new Map()
for (const [key, value] of Object.entries(COLLEGE_ENRICHMENT)) {
  ENRICHMENT_INDEX.set(normalizeCollegeKey(key), value)
}
for (const [alias, target] of Object.entries(COLLEGE_ENRICHMENT_ALIASES)) {
  const value = COLLEGE_ENRICHMENT[target]
  if (value) ENRICHMENT_INDEX.set(normalizeCollegeKey(alias), value)
}

/**
 * Exact (normalized) enrichment lookup. Returns null when this institution has
 * no curated entry — the caller must NOT fall back to a similarly-named one.
 */
export function findEnrichment(collegeName) {
  if (!collegeName) return null
  return ENRICHMENT_INDEX.get(normalizeCollegeKey(collegeName)) || null
}
