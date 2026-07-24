import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const ALL_ITEMS = [
  // Careers
  { id: 'c1', type: 'career', title: 'Software Engineer', desc: 'B.Tech CS/IT → JEE/KCET → ₹4–80+ LPA', icon: '💻', href: '/career-pipeline' },
  { id: 'c2', type: 'career', title: 'Data Scientist', desc: 'B.Tech/B.Sc → ML specialization → ₹6–100+ LPA', icon: '📊', href: '/career-pipeline' },
  { id: 'c3', type: 'career', title: 'Doctor (MBBS)', desc: 'PCB → NEET → 5.5yr MBBS → ₹10–100+ LPA', icon: '🩺', href: '/career-pipeline' },
  { id: 'c4', type: 'career', title: 'Chartered Accountant', desc: 'Commerce → CA Foundation/Inter/Final → ₹7–80+ LPA', icon: '📋', href: '/career-pipeline' },
  { id: 'c5', type: 'career', title: 'UI/UX Designer', desc: 'B.Des/Self-taught → Portfolio → ₹4–60+ LPA', icon: '🎨', href: '/career-pipeline' },
  { id: 'c6', type: 'career', title: 'IAS Officer', desc: 'Any degree → UPSC → ₹56K–2.5L/month', icon: '🏛️', href: '/career-pipeline' },
  // Exams
  { id: 'e1', type: 'exam', title: 'KCET', desc: 'Karnataka Common Entrance Test for Engineering', icon: '🎯', href: '/competitive-exams' },
  { id: 'e2', type: 'exam', title: 'JEE Main', desc: 'Joint Entrance Exam for NITs/IIITs/GFTIs', icon: '⚡', href: '/competitive-exams' },
  { id: 'e3', type: 'exam', title: 'JEE Advanced', desc: 'IIT admission via JEE Advanced', icon: '🏆', href: '/competitive-exams' },
  { id: 'e4', type: 'exam', title: 'NEET', desc: 'Medical entrance for MBBS/BDS', icon: '🩺', href: '/competitive-exams' },
  { id: 'e5', type: 'exam', title: 'COMEDK', desc: 'Karnataka private engineering college entrance', icon: '🎓', href: '/competitive-exams' },
  { id: 'e6', type: 'exam', title: 'CUET', desc: 'Central University Entrance Test', icon: '📚', href: '/competitive-exams' },
  // Scholarships
  { id: 's1', type: 'scholarship', title: 'NTSE Scholarship', desc: '₹1,250–2,000/month for Class 10 toppers', icon: '💰', href: '/scholarships' },
  { id: 's2', type: 'scholarship', title: 'Fulbright-Nehru Fellowship', desc: 'Full funding for USA – Prestigious', icon: '🇺🇸', href: '/scholarships' },
  { id: 's3', type: 'scholarship', title: 'Chevening Scholarship', desc: 'Full funding for UK Master\'s degree', icon: '🇬🇧', href: '/scholarships' },
  { id: 's4', type: 'scholarship', title: 'DAAD Scholarship', desc: '€861–1,200/month for Germany', icon: '🇩🇪', href: '/scholarships' },
  { id: 's5', type: 'scholarship', title: 'INSPIRE Scholarship', desc: '₹80,000/year for top 1% in Class 12', icon: '🌟', href: '/scholarships' },
  // Study Abroad
  { id: 'a1', type: 'abroad', title: 'Study in USA', desc: 'Top universities, F1 visa, SAT/GRE/TOEFL', icon: '🇺🇸', href: '/study-abroad' },
  { id: 'a2', type: 'abroad', title: 'Study in Germany', desc: 'Free education, no tuition, TestDaF/IELTS', icon: '🇩🇪', href: '/study-abroad' },
  { id: 'a3', type: 'abroad', title: 'Study in Canada', desc: 'PR pathway, co-op programs, IELTS', icon: '🇨🇦', href: '/study-abroad' },
  { id: 'a4', type: 'abroad', title: 'Study in UK', desc: 'Russell Group, 1-yr Masters, IELTS', icon: '🇬🇧', href: '/study-abroad' },
  // Mentors
  { id: 'm1', type: 'mentor', title: 'Talk to a Mentor', desc: 'Book 20-min session with industry mentors', icon: '🌟', href: '/mentors' },
]

const TYPE_COLORS = {
  career:      'bg-blue-500/10 border-blue-500/20 text-blue-400',
  exam:        'bg-saffron/10 border-saffron/20 text-saffron',
  scholarship: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  abroad:      'bg-purple-500/10 border-purple-500/20 text-purple-400',
  mentor:      'bg-rose-500/10 border-rose-500/20 text-rose-400',
}

const TYPE_LABELS = {
  career: 'Career', exam: 'Exam', scholarship: 'Scholarship', abroad: 'Abroad', mentor: 'Mentor'
}

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const filtered = query.trim().length > 0
    ? ALL_ITEMS.filter(item =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.desc.toLowerCase().includes(query.toLowerCase()) ||
        item.type.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : ALL_ITEMS.slice(0, 6)

  const handleSelect = (item) => {
    onClose()
    setQuery('')
    navigate(item.href)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
        onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setQuery('') } }}
      >
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl bg-[#0D1117] border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-white/10">
            <svg className="w-5 h-5 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search careers, exams, scholarships, countries..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-base outline-none"
            />
            <kbd className="hidden sm:inline text-[10px] text-gray-600 bg-white/5 border border-white/10 px-2 py-1 rounded-md font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
            {query.trim() === '' && (
              <div className="px-4 py-2.5">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600">Quick Access</p>
              </div>
            )}
            {filtered.length > 0 ? filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.05] transition-colors text-left group"
              >
                <span className="text-2xl flex-shrink-0 w-10 text-center">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold">{item.title}</p>
                  <p className="text-gray-500 text-xs truncate mt-0.5">{item.desc}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${TYPE_COLORS[item.type]}`}>
                  {TYPE_LABELS[item.type]}
                </span>
                <svg className="w-4 h-4 text-gray-600 group-hover:text-saffron transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )) : (
              <div className="py-10 text-center text-gray-500 text-sm">
                No results for "<span className="text-white">{query}</span>"
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/5 flex items-center gap-4 text-[11px] text-gray-600">
            <span>↵ to select</span>
            <span>↑↓ to navigate</span>
            <span>ESC to close</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
