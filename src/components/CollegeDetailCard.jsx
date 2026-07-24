import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Static college enrichment data for well-known Indian colleges ─────────────
const COLLEGE_ENRICHMENT = {
  'RVCE': {
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
  'MSRIT': {
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
  'NLSIU Bangalore': {
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

// Normalize a college name to find it in enrichment map
function findEnrichment(collegeName) {
  if (!collegeName) return null
  const normalized = collegeName.toLowerCase()
  for (const [key, value] of Object.entries(COLLEGE_ENRICHMENT)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized.split(' ')[0].toLowerCase())) {
      return value
    }
  }
  return null
}

// ─── CollegeDetailCard ────────────────────────────────────────────────────────

export default function CollegeDetailCard({ collegeName, sourceUrl }) {
  const [isOpen, setIsOpen] = useState(false)
  const [aiData, setAiData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const staticData = findEnrichment(collegeName)
  const displayData = staticData || aiData

  const fetchCollegeDetails = async () => {
    if (staticData || fetched || loading) return
    setLoading(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const res = await fetch(`${apiBase}/api/college-details?name=${encodeURIComponent(collegeName)}`)
      if (res.ok) {
        const data = await res.json()
        setAiData(data)
      }
    } catch (err) {
      console.warn('College details fetch failed:', err)
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }

  const handleToggle = () => {
    if (!isOpen && !staticData && !fetched) {
      fetchCollegeDetails()
    }
    setIsOpen(prev => !prev)
  }

  return (
    <div className="relative">
      {/* College name button */}
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-left w-full group hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition-all"
      >
        <span className="text-saffron mt-0.5 text-xs flex-shrink-0">▸</span>
        <span className="text-gray-300 text-sm group-hover:text-saffron transition-colors flex-1">
          {collegeName}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-600 text-[10px] flex-shrink-0"
        >
          ▼
        </motion.span>
      </button>

      {/* Dropdown Detail Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden mt-1 ml-4"
          >
            <div className="bg-[#0d1526] border border-white/10 rounded-xl p-4 space-y-3">

              {/* Loading state */}
              {loading && (
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <div className="w-3 h-3 rounded-full border-2 border-saffron/40 border-t-saffron animate-spin" />
                  Fetching college details…
                </div>
              )}

              {/* No data yet */}
              {!loading && !displayData && (
                <div className="text-gray-500 text-xs text-center py-2">
                  No detailed info available for this college yet.
                  <br />
                  <a
                    href={sourceUrl || `https://www.google.com/search?q=${encodeURIComponent(collegeName + ' India college details fees')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-saffron hover:underline mt-1 inline-block"
                  >
                    Search on Google →
                  </a>
                </div>
              )}

              {/* College Details */}
              {displayData && (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-display font-bold text-white text-sm leading-tight">
                        {displayData.fullName || collegeName}
                      </h5>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {[displayData.city, displayData.state, displayData.type].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {displayData.naac && (
                      <span className="flex-shrink-0 text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-1 rounded-lg">
                        NAAC {displayData.naac}
                      </span>
                    )}
                  </div>

                  {displayData.nirf && (
                    <p className="text-gray-400 text-xs">🏆 {displayData.nirf}</p>
                  )}

                  {/* Fee Structure */}
                  {displayData.fees && (
                    <div className="bg-white/4 rounded-lg p-3 space-y-1.5">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">💰 Fee Structure</p>
                      {displayData.fees.govtQuota && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-emerald-400 flex-shrink-0">Govt/State Quota:</span>
                          <span className="text-gray-200">{displayData.fees.govtQuota}</span>
                        </div>
                      )}
                      {displayData.fees.managementQuota && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-amber-400 flex-shrink-0">Mgmt/Private Seat:</span>
                          <span className="text-gray-200">{displayData.fees.managementQuota}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cutoffs */}
                  {displayData.cutoffs && (
                    <div className="bg-white/4 rounded-lg p-3 space-y-1.5">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">📊 Exam Cutoffs</p>
                      {Object.entries(displayData.cutoffs).map(([exam, cutoff]) => cutoff && cutoff !== 'Not applicable' && (
                        <div key={exam} className="flex items-start gap-2 text-xs">
                          <span className="text-saffron flex-shrink-0 uppercase font-semibold">{exam}:</span>
                          <span className="text-gray-300">{cutoff}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Placements */}
                  {displayData.placements && (
                    <div className="bg-white/4 rounded-lg p-3 space-y-1.5">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">🚀 Placements</p>
                      <p className="text-xs text-white">Avg Package: <span className="text-emerald-400 font-semibold">{displayData.placements.avgPackage}</span></p>
                      {displayData.placements.topRecruiters && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {displayData.placements.topRecruiters.map((r, i) => (
                            <span key={i} className="text-[10px] bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Review */}
                  {displayData.reviews && (
                    <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                      <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">💬 Student Review</p>
                      <p className="text-blue-200 text-xs italic leading-relaxed">{displayData.reviews}</p>
                    </div>
                  )}

                  {/* Links */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(displayData.website || sourceUrl) && (
                      <a
                        href={displayData.website || sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-semibold bg-white/5 border border-white/10 hover:border-saffron/40 text-gray-400 hover:text-saffron px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        🌐 Official Website
                      </a>
                    )}
                    {displayData.linkedin && (
                      <a
                        href={displayData.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-semibold bg-blue-500/5 border border-blue-500/15 hover:border-blue-400/40 text-blue-400 px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        in LinkedIn
                      </a>
                    )}
                    {displayData.youtube && (
                      <a
                        href={displayData.youtube}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-[10px] font-semibold bg-red-500/5 border border-red-500/15 hover:border-red-400/40 text-red-400 px-2.5 py-1.5 rounded-lg transition-all"
                      >
                        ▶ Videos
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(collegeName + ' reviews placements')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-[10px] font-semibold bg-white/5 border border-white/10 hover:border-white/25 text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      🔍 More Info
                    </a>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
