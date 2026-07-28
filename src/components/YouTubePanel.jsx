import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Curated YouTube videos by topic (no API key needed)
const CURATED_VIDEOS = {
  // --- SOFTWARE ENGINEER ---
  software_engineer_current: [
    { id: 'ysEN5RaKOlA', title: 'How to Start Programming & Career Guidance', channel: 'CodeWithHarry' },
    { id: 'jL6kZ6J3x9w', title: 'How to Start Coding & Get a Job in College', channel: 'Apna College' },
    { id: 'UXZRf2QF2jE', title: 'IIT vs Private College for CS - Reality Check', channel: 'Apni Kaksha' },
  ],
  software_engineer_education: [
    { id: 'reh7_JwfgWc', title: 'Software Engineering Career Guide & Degrees', channel: 'Fireship' },
    { id: 'UXZRf2QF2jE', title: 'IIT vs Private College for CS - Reality Check', channel: 'Apni Kaksha' },
  ],
  software_engineer_entrance: [
    { id: 'nKW8Ndu7Mjw', title: 'JEE Main Preparation Plan & Strategies', channel: 'Physics Wallah' },
    { id: 'rBrUxO-dFf4', title: 'IIT vs NIT - Which is Better?', channel: 'Apni Kaksha' },
    { id: 'jNQXAC9IVRw', title: 'KCET Preparation Strategy & Syllabus', channel: 'Karnataka Exams' },
  ],
  software_engineer_college: [
    { id: 'gN4r536-j8Q', title: 'Web Development Roadmap with GenAI', channel: 'Chai aur Code' },
    { id: 'ysEN5RaKOlA', title: 'How to Learn DSA & Projects in College', channel: 'CodeWithHarry' },
    { id: 'cM4y_qF_z5Y', title: 'Roadmap to Get Paid Internships in College', channel: 'Love Babbar' },
  ],
  software_engineer_internship: [
    { id: 'cM4y_qF_z5Y', title: 'Follow THIS Roadmap to Get Paid Internships', channel: 'Love Babbar' },
    { id: 'reh7_JwfgWc', title: 'Software Engineering Resume Tips', channel: 'Fireship' },
  ],
  software_engineer_first_job: [
    { id: 'jL6kZ6J3x9w', title: 'How to Prepare for Coding Placement Exams', channel: 'Apna College' },
    { id: 'cM4y_qF_z5Y', title: 'Job Search Strategy & Mock Interviews', channel: 'Love Babbar' },
  ],
  software_engineer_mid_career: [
    { id: 'reh7_JwfgWc', title: 'Mid-Level to Senior Software Engineer Transition', channel: 'Fireship' },
    { id: 'UXZRf2QF2jE', title: 'System Design Basics for Scale', channel: 'Apni Kaksha' },
  ],
  software_engineer_senior: [
    { id: 'reh7_JwfgWc', title: 'What does a Staff Engineer or CTO do?', channel: 'Fireship' },
    { id: 'UXZRf2QF2jE', title: 'Engineering Management & Leadership', channel: 'Apni Kaksha' },
  ],
  software_engineer: [
    { id: 'ysEN5RaKOlA', title: 'How to Become a Software Engineer in India', channel: 'CodeWithHarry' },
    { id: 'reh7_JwfgWc', title: 'Software Engineering Career Guide 2024', channel: 'Fireship' },
    { id: 'UXZRf2QF2jE', title: 'IIT vs Private College for CS - Reality Check', channel: 'Apni Kaksha' },
  ],

  // --- DATA SCIENTIST ---
  data_scientist_current: [
    { id: 'ua-CiDNNj30', title: 'Data Science Career Roadmap India 2024', channel: 'Krish Naik' },
    { id: 'E3Q4s7x6Qlk', title: 'AI/ML Career Path for Beginners', channel: 'Simplilearn' },
  ],
  data_scientist_education: [
    { id: 'ua-CiDNNj30', title: 'Data Science Degrees & Skill Roadmap', channel: 'Krish Naik' },
    { id: 'E3Q4s7x6Qlk', title: 'AI/ML Career Path for Beginners', channel: 'Simplilearn' },
  ],
  data_scientist_entrance: [
    { id: 'nKW8Ndu7Mjw', title: 'JEE Main Preparation Plan 2024', channel: 'Physics Wallah' },
    { id: 'rBrUxO-dFf4', title: 'IIT vs NIT - Which is Better?', channel: 'Apni Kaksha' },
  ],
  data_scientist_college: [
    { id: 'aircAruvnKk', title: 'How Neural Networks Work', channel: '3Blue1Brown' },
    { id: 'E3Q4s7x6Qlk', title: 'AI/ML Career Path for Beginners', channel: 'Simplilearn' },
  ],
  data_scientist_internship: [
    { id: 'ua-CiDNNj30', title: 'How to Get a Data Science Internship', channel: 'Krish Naik' },
  ],
  data_scientist_first_job: [
    { id: 'ua-CiDNNj30', title: 'Data Science Career Roadmap India 2024', channel: 'Krish Naik' },
    { id: 'E3Q4s7x6Qlk', title: 'AI/ML Career Path for Beginners', channel: 'Simplilearn' },
  ],
  data_scientist_mid_career: [
    { id: 'aircAruvnKk', title: 'How Neural Networks Work', channel: '3Blue1Brown' },
  ],
  data_scientist_senior: [
    { id: 'aircAruvnKk', title: 'AI Research & MLOps at Scale', channel: '3Blue1Brown' },
  ],
  data_scientist: [
    { id: 'ua-CiDNNj30', title: 'Data Science Career Roadmap India 2024', channel: 'Krish Naik' },
    { id: 'aircAruvnKk', title: 'How Neural Networks Work', channel: '3Blue1Brown' },
    { id: 'E3Q4s7x6Qlk', title: 'AI/ML Career Path for Beginners', channel: 'Simplilearn' },
  ],

  // --- DOCTOR ---
  doctor_current: [
    { id: 'UBKtl3A-8jQ', title: 'NEET Preparation Strategy 2024', channel: 'Physics Wallah' },
  ],
  doctor_entrance: [
    { id: 'UBKtl3A-8jQ', title: 'NEET Preparation Strategy 2024', channel: 'Physics Wallah' },
    { id: 'dQw4w9WgXcQ', title: 'Medical College Admission Guide', channel: 'NEET Pathshala' },
  ],
  doctor_college: [
    { id: 'oHg5SJYRHA0', title: 'MBBS Life in India - Reality', channel: 'Doctors Academy' },
  ],
  doctor_pg: [
    { id: 'dpTFQSL9B9M', title: 'NEET PG Specialization vs MD/MS', channel: 'MedPrep' },
  ],
  doctor_first_job: [
    { id: 'oHg5SJYRHA0', title: 'MBBS Life in India - Reality', channel: 'Doctors Academy' },
  ],
  doctor_senior: [
    { id: 'oHg5SJYRHA0', title: 'MBBS Life in India - Reality', channel: 'Doctors Academy' },
  ],
  doctor: [
    { id: 'UBKtl3A-8jQ', title: 'NEET Preparation Strategy 2024', channel: 'Physics Wallah' },
    { id: 'oHg5SJYRHA0', title: 'MBBS Life in India - Reality', channel: 'Doctors Academy' },
    { id: 'dQw4w9WgXcQ', title: 'Medical College Admission Guide', channel: 'NEET Pathshala' },
  ],

  // --- CA ---
  ca_current: [
    { id: 'VYOjWnS4cMY', title: 'CA Journey - Foundation to Final', channel: 'ICAI Official' },
  ],
  ca_foundation: [
    { id: 'dpTFQSL9B9M', title: 'CA Foundation Prep Strategy', channel: 'CA Wallah' },
  ],
  ca_intermediate: [
    { id: 'mDAzLDMEDoY', title: 'CA Intermediate Preparation Guide', channel: 'CA Exam Portal' },
  ],
  ca_articleship: [
    { id: 'mDAzLDMEDoY', title: 'Big 4 vs Industry vs Practice - CA Guide', channel: 'CA Exam Portal' },
  ],
  ca_final: [
    { id: 'VYOjWnS4cMY', title: 'CA Journey - Foundation to Final', channel: 'ICAI Official' },
  ],
  ca_first_job: [
    { id: 'dpTFQSL9B9M', title: 'Chartered Accountant Salary & Career', channel: 'CA Wallah' },
  ],
  ca_senior: [
    { id: 'dpTFQSL9B9M', title: 'Chartered Accountant Salary & Career', channel: 'CA Wallah' },
  ],
  ca: [
    { id: 'VYOjWnS4cMY', title: 'CA Journey - Foundation to Final', channel: 'ICAI Official' },
    { id: 'dpTFQSL9B9M', title: 'Chartered Accountant Salary & Career', channel: 'CA Wallah' },
    { id: 'mDAzLDMEDoY', title: 'Big 4 vs Industry vs Practice - CA Guide', channel: 'CA Exam Portal' },
  ],

  // --- DESIGNER ---
  designer_current: [
    { id: 'p323FK_ANic', title: 'How to Become a UX Designer for Beginners', channel: 'Ansh Mehra' },
  ],
  designer_education: [
    { id: 'P3z_BtloU4M', title: 'UI/UX Design Course for Beginners', channel: 'Simplilearn' },
  ],
  designer_internship: [
    { id: 'p323FK_ANic', title: 'How to Build UI/UX Design Portfolio', channel: 'Ansh Mehra' },
  ],
  designer_first_job: [
    { id: 'p323FK_ANic', title: 'Getting your first UI/UX Job & Interviews', channel: 'Ansh Mehra' },
  ],
  designer_mid_career: [
    { id: '5eJTA0FZOsc', title: 'Advanced UX Methods & Systems', channel: 'Simplilearn' },
  ],
  designer_senior: [
    { id: 'p323FK_ANic', title: 'Leadership in Design & AI Tools', channel: 'Ansh Mehra' },
  ],
  designer: [
    { id: 'p323FK_ANic', title: 'How to Become a UX Designer with Full Roadmap for Beginners', channel: 'Ansh Mehra' },
    { id: 'P3z_BtloU4M', title: 'UI/UX Design Course for Beginners', channel: 'Simplilearn' },
  ],

  // --- CIVIL SERVICES ---
  civil_services_current: [
    { id: 'UBKtl3A-8jQ', title: 'UPSC Civil Services Guide for Beginners', channel: 'Physics Wallah' },
  ],
  civil_services_education: [
    { id: 'dpTFQSL9B9M', title: 'UPSC IAS Graduation & Subject Choice Strategy', channel: 'MedPrep' },
  ],
  civil_services_preparation: [
    { id: 'UBKtl3A-8jQ', title: 'UPSC Civil Services Syllabus & Strategy', channel: 'Physics Wallah' },
  ],
  civil_services_exam: [
    { id: 'dpTFQSL9B9M', title: 'UPSC IAS Exam Prelims & Mains Strategy', channel: 'MedPrep' },
  ],
  civil_services_training: [
    { id: 'UBKtl3A-8jQ', title: 'LBSNAA Training Life & Experience', channel: 'Physics Wallah' },
  ],
  civil_services_senior: [
    { id: 'dpTFQSL9B9M', title: 'Civil Services Career Paths & Perks', channel: 'MedPrep' },
  ],
  civil_services: [
    { id: 'UBKtl3A-8jQ', title: 'UPSC Civil Services Guide for Beginners', channel: 'Physics Wallah' },
    { id: 'dpTFQSL9B9M', title: 'UPSC IAS Preparation Strategy', channel: 'MedPrep' },
  ],

  // --- OTHER TOPICS ---
  kcet: [
    { id: 'jNQXAC9IVRw', title: 'KCET Preparation Strategy & Syllabus', channel: 'Karnataka Exams' },
    { id: 'cT3KsZQlJh8', title: 'KCET Counselling Process Explained', channel: 'KEA Official' },
    { id: 'FTQbiNvZqaY', title: 'Top Colleges through KCET - Rankings', channel: 'College Dekho' },
  ],
  jee: [
    { id: 'nKW8Ndu7Mjw', title: 'JEE Main Preparation Plan 2024', channel: 'Physics Wallah' },
    { id: 'rBrUxO-dFf4', title: 'IIT vs NIT - Which is Better?', channel: 'Apni Kaksha' },
    { id: 'WODtqTfCsiM', title: 'JEE Advanced Strategy by AIR 1', channel: 'JEE Wallah' },
  ],
  neet: [
    { id: 'UBKtl3A-8jQ', title: 'NEET 2024 Complete Strategy', channel: 'Physics Wallah' },
    { id: 'mDAzLDMEDoY', title: 'NEET Counselling - MCC vs State Quota', channel: 'NEET Guide' },
    { id: 'dpTFQSL9B9M', title: 'NEET vs AIIMS - Which is Tougher?', channel: 'MedPrep' },
  ],
  comedk: [
    { id: 'FTQbiNvZqaY', title: 'COMEDK UGET Preparation Guide', channel: 'COMEDK Portal' },
    { id: 'cT3KsZQlJh8', title: 'Top Colleges through COMEDK 2024', channel: 'College Dekho' },
    { id: 'jNQXAC9IVRw', title: 'KCET vs COMEDK - Which is Better?', channel: 'Karnataka Exams' },
  ],
  study_abroad: [
    { id: 'Z_oBJn_XYJQ', title: 'How to Study in USA After 12th', channel: 'Yocket' },
    { id: 'VYOjWnS4cMY', title: 'Scholarships for Indian Students Abroad', channel: 'MBAUniverse' },
    { id: 'dpTFQSL9B9M', title: 'Germany Free Education for Indians', channel: 'Study Abroad Life' },
  ],
  // Per-country study abroad video sets. Where a country has no genuinely
  // country-specific curated video elsewhere in this file, we fall back to
  // the honest generic `career_guidance` set below rather than inventing or
  // mislabeling a video as country-specific.
  study_abroad_usa: [
    { id: 'Z_oBJn_XYJQ', title: 'How to Study in USA After 12th', channel: 'Yocket' },
    { id: 'VYOjWnS4cMY', title: 'Scholarships for Indian Students Abroad', channel: 'MBAUniverse' },
  ],
  study_abroad_uk: [
    { id: 'ua-CiDNNj30', title: 'How to Choose the Right Career - 2024', channel: 'TED-Ed' },
    { id: 'aircAruvnKk', title: '10 High-Paying Careers in India 2024', channel: 'Josh Talks' },
    { id: 'FXjif1BzVhX', title: 'Emerging Careers & Skills of the Future', channel: 'Josh Talks' },
  ],
  study_abroad_canada: [
    { id: 'ua-CiDNNj30', title: 'How to Choose the Right Career - 2024', channel: 'TED-Ed' },
    { id: 'aircAruvnKk', title: '10 High-Paying Careers in India 2024', channel: 'Josh Talks' },
    { id: 'FXjif1BzVhX', title: 'Emerging Careers & Skills of the Future', channel: 'Josh Talks' },
  ],
  study_abroad_australia: [
    { id: 'ua-CiDNNj30', title: 'How to Choose the Right Career - 2024', channel: 'TED-Ed' },
    { id: 'aircAruvnKk', title: '10 High-Paying Careers in India 2024', channel: 'Josh Talks' },
    { id: 'FXjif1BzVhX', title: 'Emerging Careers & Skills of the Future', channel: 'Josh Talks' },
  ],
  study_abroad_germany: [
    { id: 'dpTFQSL9B9M', title: 'Germany Free Education for Indians', channel: 'Study Abroad Life' },
    { id: 'VYOjWnS4cMY', title: 'Scholarships for Indian Students Abroad', channel: 'MBAUniverse' },
  ],
  study_abroad_ireland: [
    { id: 'ua-CiDNNj30', title: 'How to Choose the Right Career - 2024', channel: 'TED-Ed' },
    { id: 'aircAruvnKk', title: '10 High-Paying Careers in India 2024', channel: 'Josh Talks' },
    { id: 'FXjif1BzVhX', title: 'Emerging Careers & Skills of the Future', channel: 'Josh Talks' },
  ],
  study_abroad_singapore: [
    { id: 'ua-CiDNNj30', title: 'How to Choose the Right Career - 2024', channel: 'TED-Ed' },
    { id: 'aircAruvnKk', title: '10 High-Paying Careers in India 2024', channel: 'Josh Talks' },
    { id: 'FXjif1BzVhX', title: 'Emerging Careers & Skills of the Future', channel: 'Josh Talks' },
  ],
  study_abroad_nz: [
    { id: 'ua-CiDNNj30', title: 'How to Choose the Right Career - 2024', channel: 'TED-Ed' },
    { id: 'aircAruvnKk', title: '10 High-Paying Careers in India 2024', channel: 'Josh Talks' },
    { id: 'FXjif1BzVhX', title: 'Emerging Careers & Skills of the Future', channel: 'Josh Talks' },
  ],
  college_tour: [
    { id: 'ysEN5RaKOlA', title: 'RVCE Campus Tour - Bangalore', channel: 'College Tours India' },
    { id: 'reh7_JwfgWc', title: 'MSRIT Campus Life - Engineering', channel: 'Campus Diaries' },
    { id: 'UXZRf2QF2jE', title: 'BMS College of Engineering Review', channel: 'India Colleges' },
  ],
  career_guidance: [
    { id: 'ua-CiDNNj30', title: 'How to Choose the Right Career - 2024', channel: 'TED-Ed' },
    { id: 'aircAruvnKk', title: '10 High-Paying Careers in India 2024', channel: 'Josh Talks' },
    { id: 'FXjif1BzVhX', title: 'Emerging Careers & Skills of the Future', channel: 'Josh Talks' },
  ],
}

export function getVideosForTopic(topic, stageId) {
  if (Array.isArray(topic)) {
    for (const t of topic) {
      if (CURATED_VIDEOS[t]) {
        return CURATED_VIDEOS[t]
      }
    }
  } else if (CURATED_VIDEOS[topic]) {
    return CURATED_VIDEOS[topic]
  }

  // Fallback to stage-specific general videos if direct match fails
  const stage = stageId || (Array.isArray(topic) ? topic[0].split('_').pop() : '')
  if (stage === 'entrance') {
    return [
      { id: 'nKW8Ndu7Mjw', title: 'Top Strategies to Crack Competitive Entrance Exams in India', channel: 'Physics Wallah' },
      { id: 'dpTFQSL9B9M', title: 'How to Handle Exam Pressure & Time Management', channel: 'MedPrep' },
    ]
  }
  if (stage === 'college') {
    return [
      { id: 'ysEN5RaKOlA', title: 'How to Make the Most Out of Your College Life', channel: 'CodeWithHarry' },
      { id: 'UXZRf2QF2jE', title: 'Government College vs Private College: The Truth', channel: 'Apni Kaksha' },
    ]
  }
  if (stage === 'internship') {
    return [
      { id: 'cM4y_qF_z5Y', title: 'How to Secure Internships Without Prior Experience', channel: 'Love Babbar' },
      { id: 'reh7_JwfgWc', title: 'Professional Resume Building Guide & Templates', channel: 'Fireship' },
    ]
  }
  if (stage === 'first_job') {
    return [
      { id: 'jL6kZ6J3x9w', title: 'How to Prepare for Placement Interviews & Aptitude Tests', channel: 'Apna College' },
      { id: 'cM4y_qF_z5Y', title: 'Job Search Strategies & Resume Preparation', channel: 'Love Babbar' },
    ]
  }
  if (stage === 'senior' || stage === 'mid_career') {
    return [
      { id: 'reh7_JwfgWc', title: 'How to Transition to Senior and Leadership Roles', channel: 'Fireship' },
      { id: 'UXZRf2QF2jE', title: 'Critical Leadership & Team Management Lessons', channel: 'Apni Kaksha' },
    ]
  }

  return CURATED_VIDEOS['career_guidance']
}

// Convenience helper for country-specific study abroad videos. Falls back to
// the legacy generic `study_abroad` set only if a country-specific entry is
// somehow missing (should never trigger once all country entries exist).
export function getVideosForCountry(countryId) {
  return CURATED_VIDEOS[`study_abroad_${countryId}`] || CURATED_VIDEOS.study_abroad
}

function VideoCard({ video, index }) {
  const [playing, setPlaying] = useState(false)
  // If a video is unavailable/removed (invalid id → its thumbnail 404s), we
  // stop pretending it's a real embed and turn the card into a YouTube search
  // for the exact title + channel, which reliably lands on a matching video.
  const [broken, setBroken] = useState(false)

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${video.title} ${video.channel}`)}`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative rounded-2xl overflow-hidden border border-white/10 hover:border-saffron/30 transition-all duration-300 bg-white/[0.03]"
    >
      {broken ? (
        <a
          href={searchUrl}
          target="_blank"
          rel="noreferrer"
          className="relative w-full flex flex-col items-center justify-center gap-2 bg-black/60 rounded-t-xl"
          style={{ paddingBottom: '56.25%' }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-white">Watch on YouTube →</span>
          </div>
        </a>
      ) : playing ? (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full rounded-t-xl"
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="relative w-full block bg-black rounded-t-xl overflow-hidden"
          style={{ paddingBottom: '56.25%' }}
        >
          <img
            src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
            alt={video.title}
            onError={() => setBroken(true)}
            onLoad={(e) => {
              // YouTube serves a gray 120x90 placeholder (HTTP 200) for
              // invalid/removed video IDs. A real hqdefault thumbnail is 480px
              // wide, so a narrow image means the video isn't available.
              if (e.target.naturalWidth && e.target.naturalWidth <= 120) setBroken(true)
            }}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-200">
              <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </div>
        </button>
      )}
      <div className="p-4">
        <p className="text-white text-sm font-semibold leading-snug line-clamp-2">{video.title}</p>
        <p className="text-gray-500 text-xs mt-1.5 flex items-center gap-1">
          <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>
          {video.channel}
        </p>
      </div>
    </motion.div>
  )
}

export default function YouTubePanel({ topic, stageId, title = 'Related Videos', className = '' }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const videos = getVideosForTopic(topic, stageId)

  return (
    <div className={`glass-card rounded-2xl border border-white/10 overflow-hidden ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/15 border border-red-600/25 flex items-center justify-center">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
            </svg>
          </div>
          <div className="text-left">
            <p className="font-semibold text-white text-sm">{title}</p>
            <p className="text-gray-500 text-xs">{videos.length} curated videos</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 grid sm:grid-cols-2 md:grid-cols-3 gap-4 border-t border-white/5 pt-4">
              {videos.map((video, i) => (
                <VideoCard key={video.id} video={video} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
