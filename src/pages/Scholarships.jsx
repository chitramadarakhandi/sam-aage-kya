import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  { id: 'after10', label: 'After 10th', icon: '📗', color: 'tag-emerald' },
  { id: 'after12', label: 'After 12th', icon: '📘', color: 'tag-blue' },
  { id: 'undergraduate', label: 'Undergraduate', icon: '🎓', color: 'tag-purple' },
  { id: 'abroad', label: 'Study Abroad', icon: '✈️', color: 'tag-saffron' },
]

const STATUS_COLORS = {
  applied: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  pending: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  received: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
}
const STATUS_LABELS = { applied: '📤 Applied', pending: '⏳ Pending', received: '✅ Received' }

const SCHOLARSHIPS = [
  // After 10th
  { id: 1, name: 'NTSE (National Talent Search Examination)', category: 'after10', amount: '₹1,250 – ₹2,000/month', eligibility: 'Class 10 students with top scores in State & National level exam', deadline: 'August – November (varies by state)', link: 'https://ncert.nic.in/national-talent-examination.php', tags: ['Merit-based', 'National', 'Prestigious'] },
  { id: 2, name: 'NMMS (National Means-cum-Merit Scholarship)', category: 'after10', amount: '₹12,000/year for Class 9-12', eligibility: 'Class 8 students from government schools, family income < ₹3.5 LPA', deadline: 'November – January', link: 'https://scholarships.gov.in', tags: ['Government', 'Merit+Need', 'Free'] },
  { id: 3, name: 'Inspire Awards – MANAK', category: 'after10', amount: '₹10,000 one-time', eligibility: 'Class 6-10 students with innovative science ideas', deadline: 'Ongoing', link: 'https://www.inspireawards-dst.gov.in', tags: ['Science', 'Innovation', 'DST'] },
  { id: 4, name: 'Vidyasiri Scholarship (Karnataka)', category: 'after10', amount: '₹10,000 – ₹15,000/year', eligibility: 'SC/ST/OBC students in Karnataka, income limit applies', deadline: 'September – November', link: 'https://ssp.postmatric.karnataka.gov.in', tags: ['State', 'SC/ST/OBC', 'Karnataka'] },

  // After 12th
  { id: 5, name: 'Central Sector Scheme of Scholarships (CSSS)', category: 'after12', amount: '₹10,000 – ₹20,000/year', eligibility: 'Top 20 percentile in Class 12 boards, family income < ₹8 LPA', deadline: 'October – November', link: 'https://scholarships.gov.in', tags: ['Central Govt', 'Merit', 'All Streams'] },
  { id: 6, name: 'Post Matric Scholarship for SC/ST/OBC', category: 'after12', amount: 'Full tuition + maintenance', eligibility: 'SC/ST/OBC students, income limit varies by category', deadline: 'August – November', link: 'https://scholarships.gov.in', tags: ['Government', 'Category-based', 'Full Support'] },
  { id: 7, name: 'INSPIRE-SHE (Science Scholarship, replaces KVPY)', category: 'after12', amount: '₹80,000/year for BSc/BS students', eligibility: 'Top performers in Class 12 pursuing Basic/Natural Sciences', deadline: 'August – October', link: 'https://online-inspire.gov.in', tags: ['Science', 'DST', 'Research'] },
  { id: 8, name: 'Pragati Scholarship for Girls', category: 'after12', amount: '₹50,000/year', eligibility: 'Girls admitted to AICTE-approved technical institutions', deadline: 'October – December', link: 'https://www.aicte-india.org', tags: ['Girls Only', 'Technical', 'AICTE'] },

  // Undergraduate
  { id: 9, name: 'INSPIRE Scholarship (SHE)', category: 'undergraduate', amount: '₹80,000/year for 5 years', eligibility: 'Top 1% in Class 12 boards pursuing BSc/BS/Integrated MS', deadline: 'August – October', link: 'https://online-inspire.gov.in', tags: ['Science', 'Top 1%', 'DST'] },
  { id: 10, name: 'Aditya Birla Scholarship', category: 'undergraduate', amount: '₹65,000 – ₹1,80,000/year', eligibility: 'Students at IITs, IIMs, BITS, XLRI, Law schools (top scorers)', deadline: 'August – September', link: 'https://www.adityabirlascholars.net', tags: ['Premium', 'Top Institutes', 'Corporate'] },
  { id: 11, name: 'Foundation For Excellence (FFE) Scholarship', category: 'undergraduate', amount: 'Full tuition + mentoring', eligibility: 'Economically disadvantaged students in Engineering/Medical at recognised Indian institutions', deadline: 'Rolling', link: 'https://www.ffe.org', tags: ['Full Ride', 'Need-Based', 'NGO'] },
  { id: 12, name: 'Tata Trusts Scholarships', category: 'undergraduate', amount: 'Up to ₹1,00,000/year', eligibility: 'Meritorious students from low-income families across India', deadline: 'Various', link: 'https://www.tatatrusts.org', tags: ['Tata', 'Need-Based', 'All Fields'] },

  // Study Abroad
  { id: 13, name: 'Fulbright-Nehru Fellowship (USA)', category: 'abroad', amount: 'Full funding (tuition + living)', eligibility: 'Indian graduates with work experience for Master\'s/PhD in USA', deadline: 'February – June', link: 'https://www.usief.org.in', tags: ['USA', 'Full Ride', 'Prestigious'] },
  { id: 14, name: 'Chevening Scholarship (UK)', category: 'abroad', amount: 'Full funding for 1-year Master\'s', eligibility: 'Indian graduates with 2+ years work experience for UK universities', deadline: 'August – November', link: 'https://www.chevening.org', tags: ['UK', 'Full Ride', 'Leadership'] },
  { id: 15, name: 'DAAD Scholarship (Germany)', category: 'abroad', amount: '€861 – €1,200/month + travel', eligibility: 'Indian graduates for Master\'s/PhD in German universities', deadline: 'October – November', link: 'https://www.daad.de', tags: ['Germany', 'Monthly Stipend', 'Research'] },
  { id: 16, name: 'Australia Awards Scholarships', category: 'abroad', amount: 'Full tuition + living + travel', eligibility: 'Indian citizens for Master\'s/PhD at Australian universities', deadline: 'February – April', link: 'https://www.dfat.gov.au/people-to-people/australia-awards', tags: ['Australia', 'Full Ride', 'Government'] },
  { id: 17, name: 'Commonwealth Scholarships (UK)', category: 'abroad', amount: 'Full funding', eligibility: 'Citizens of Commonwealth countries for UK Master\'s/PhD', deadline: 'October – December', link: 'https://cscuk.fcdo.gov.uk', tags: ['UK', 'Full Ride', 'Commonwealth'] },
  { id: 18, name: 'Erasmus Mundus (Europe)', category: 'abroad', amount: '€1,400/month + tuition waiver', eligibility: 'Students for joint Master\'s programs across EU universities', deadline: 'Varies by program', link: 'https://www.eacea.ec.europa.eu', tags: ['Europe', 'Joint Degree', 'EU Funded'] },
]

function ScholarshipCard({ scholarship, index, status, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-card-glow p-6 rounded-2xl relative"
    >
      <div className="flex justify-between items-start gap-3 mb-3">
        <h3 className="font-display font-bold text-white text-base leading-snug">{scholarship.name}</h3>
        <span className="tag tag-saffron text-[8px] flex-shrink-0 whitespace-nowrap">{scholarship.amount}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {scholarship.tags.map((tag, i) => (
          <span key={i} className="text-[9px] font-semibold bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-gray-400">
            {tag}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 mb-4 overflow-hidden"
          >
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Eligibility</span>
              <p className="text-gray-300 text-sm mt-1">{scholarship.eligibility}</p>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Deadline</span>
              <p className="text-gray-300 text-sm mt-1">{scholarship.deadline}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between border-t border-white/5 pt-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            {expanded ? 'Show Less ↑' : 'View Details ↓'}
          </button>
          <a
            href={scholarship.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-saffron font-semibold hover:underline flex items-center gap-1"
          >
            Apply →
          </a>
        </div>
        {/* Application Tracker */}
        <div className="flex gap-1">
          {['applied', 'pending', 'received'].map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(scholarship.id, status === s ? null : s)}
              className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${
                status === s ? STATUS_COLORS[s] : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export default function Scholarships() {
  const { user, profile } = useAuth()
  const [activeCategory, setActiveCategory] = useState('after12')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  
  // Load tracked scholarships from localStorage on mount/user change
  const [applicationStatus, setApplicationStatus] = useState(() => {
    const key = user ? `aageKyaScholarshipStatus:${user.id}` : 'aageKyaScholarshipStatus'
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : {}
  })

  // Sync to localStorage
  useEffect(() => {
    const key = user ? `aageKyaScholarshipStatus:${user.id}` : 'aageKyaScholarshipStatus'
    localStorage.setItem(key, JSON.stringify(applicationStatus))
  }, [applicationStatus, user])

  // Profile-aware default category
  useEffect(() => {
    if (profile) {
      if (profile.class_level === 'class10') {
        setActiveCategory('after10')
      } else if (profile.class_level === 'class12') {
        setActiveCategory('after12')
      }
    }
  }, [profile])

  const filtered = SCHOLARSHIPS.filter(s => {
    const matchesCategory = s.category === activeCategory
    const matchesSearch = searchQuery
      ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
    
    let matchesType = true
    if (selectedType === 'government') {
      matchesType = s.tags.some(t => ['Government', 'Central Govt', 'State'].includes(t))
    } else if (selectedType === 'need') {
      matchesType = s.tags.some(t => ['Need-Based', 'Merit+Need'].includes(t)) || s.eligibility.toLowerCase().includes('income')
    } else if (selectedType === 'merit') {
      matchesType = s.tags.some(t => ['Merit', 'Merit-based', 'Top 1%'].includes(t))
    } else if (selectedType === 'girls') {
      matchesType = s.tags.some(t => ['Girls Only'].includes(t))
    } else if (selectedType === 'stem') {
      matchesType = s.tags.some(t => ['Science', 'Technical', 'Research'].includes(t))
    }
    
    return matchesCategory && matchesSearch && matchesType
  })

  const handleStatusChange = (id, status) => {
    setApplicationStatus(prev => ({ ...prev, [id]: status }))
  }

  const trackedCount = Object.values(applicationStatus).filter(Boolean).length

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 font-sans relative">
      <div className="fixed inset-0 bg-mesh-premium pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-5 py-2 mb-6">
            <span className="text-lg">💰</span>
            <span className="text-emerald-300 text-sm font-semibold">Financial Aid Directory</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black text-white mb-4">
            <span className="gradient-text">Scholarships</span> & Financial Aid
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Discover scholarships you actually qualify for — organized by your education level.
            Every rupee counts.
          </p>
          {trackedCount > 0 && (
            <div className="inline-flex items-center gap-2 mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-4 py-2">
              <span className="text-emerald-400 text-sm font-bold">✅ {trackedCount} scholarship{trackedCount > 1 ? 's' : ''} tracked</span>
            </div>
          )}
        </motion.div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="relative mb-4">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search scholarships by name or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input pl-12"
            />
          </div>

          {/* Advanced Type Filters */}
          <div className="flex flex-wrap gap-1.5 justify-center mt-2">
            {[
              { id: 'all', label: 'All Types' },
              { id: 'government', label: '🏛️ Government' },
              { id: 'need', label: '🤝 Need-based' },
              { id: 'merit', label: '⭐ Merit-based' },
              { id: 'girls', label: '👩 Girls Only' },
              { id: 'stem', label: '🔬 STEM' },
            ].map(type => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  selectedType === type.id
                    ? 'bg-saffron/15 border-saffron text-saffron font-bold shadow-sm'
                    : 'bg-white/4 border-white/8 text-gray-400 hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition-all duration-300 ${
                activeCategory === cat.id
                  ? 'bg-saffron text-white border-saffron shadow-lg shadow-saffron/20'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Scholarships Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((s, i) => (
            <ScholarshipCard
              key={s.id}
              scholarship={s}
              index={i}
              status={applicationStatus[s.id]}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="glass-card-premium p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="font-display font-bold text-white text-lg mb-2">No Scholarships Found</h3>
            <p className="text-gray-400 text-sm">Try a different search term or category.</p>
          </div>
        )}

        {/* NSP CTA */}
        <div className="mt-12 glass-card-premium p-8 text-center">
          <div className="text-4xl mb-3">🇮🇳</div>
          <h3 className="font-display text-xl font-bold text-white mb-2">National Scholarship Portal (NSP)</h3>
          <p className="text-gray-400 text-sm max-w-lg mx-auto mb-4">
            The Government of India's one-stop portal for all central and state scholarship schemes.
            Check your eligibility and apply directly.
          </p>
          <a href="https://scholarships.gov.in" target="_blank" rel="noopener noreferrer" className="btn-primary text-sm py-3 px-8 inline-flex">
            Visit NSP Portal →
          </a>
        </div>

        {/* Quick Links */}
        <div className="mt-12 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/study-abroad" className="btn-outline text-sm py-2.5 px-5">Study Abroad Scholarships</Link>
            <Link to="/onboarding" className="btn-ghost text-sm py-2.5 px-5 border border-white/10 rounded-xl">Get Career Guidance</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
