import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const EXAMS = [
  // National exams first (relevant to students in every state)
  { id: 'jee_main', name: 'JEE Main', icon: '⚡', color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/20', desc: 'Joint Entrance Examination Main — NITs, IIITs, GFTIs (all-India)', stream: 'Science (PCM)' },
  { id: 'jee_advanced', name: 'JEE Advanced', icon: '🏆', color: 'from-purple-500/20 to-violet-500/10 border-purple-500/20', desc: 'For IIT Admissions (all-India)', stream: 'Science (PCM)' },
  { id: 'neet', name: 'NEET', icon: '🩺', color: 'from-emerald-500/20 to-green-500/10 border-emerald-500/20', desc: 'National Eligibility cum Entrance Test — MBBS/BDS (all-India)', stream: 'Science (PCB)' },
  { id: 'cuet', name: 'CUET', icon: '📚', color: 'from-rose-500/20 to-pink-500/10 border-rose-500/20', desc: 'Common University Entrance Test — DU, BHU & state universities', stream: 'All' },
  { id: 'clat', name: 'CLAT', icon: '⚖️', color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/20', desc: 'Common Law Admission Test — National Law Universities', stream: 'Arts / Design / Law' },
  { id: 'uceed', name: 'UCEED / NID', icon: '🎨', color: 'from-pink-500/20 to-rose-500/10 border-pink-500/20', desc: 'Design entrance for IITs & NIDs (all-India)', stream: 'Arts / Design / Law' },
  { id: 'bitsat', name: 'BITSAT', icon: '🚀', color: 'from-teal-500/20 to-cyan-500/10 border-teal-500/20', desc: 'BITS Pilani Admission Test (all-India)', stream: 'Science (PCM)' },
  { id: 'ipmat', name: 'IPMAT', icon: '💼', color: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/20', desc: 'Integrated MBA at IIM Indore/Rohtak (all-India)', stream: 'Commerce' },
  { id: 'ca_foundation', name: 'CA Foundation', icon: '📊', color: 'from-yellow-500/20 to-orange-500/10 border-yellow-500/20', desc: 'Chartered Accountancy Entry Exam (all-India)', stream: 'Commerce' },
  { id: 'iata', name: 'IISER Aptitude Test (IAT)', icon: '🔬', color: 'from-green-500/20 to-emerald-500/10 border-green-500/20', desc: 'For BS-MS Dual Degrees at IISERs (all-India)', stream: 'Science (PCM)' },
  // State engineering CETs — every major state has one
  { id: 'state_cet', name: 'State CETs', icon: '🗺️', color: 'from-slate-500/20 to-gray-500/10 border-slate-500/20', desc: 'Your state engineering CET — MHT-CET (MH), AP/TS EAMCET, WBJEE, KEAM (KL), UPCET, etc.', stream: 'Science (PCM)' },
  { id: 'kcet', name: 'KCET', icon: '🎯', color: 'from-orange-500/20 to-amber-500/10 border-orange-500/20', desc: 'Karnataka Common Entrance Test (Karnataka students)', stream: 'Science (PCM)' },
  { id: 'comedk', name: 'COMEDK', icon: '🎓', color: 'from-cyan-500/20 to-teal-500/10 border-cyan-500/20', desc: 'Karnataka private engineering/medical colleges', stream: 'Science (PCM)' },
]

// Mock counselling data
const COUNSELLING_DATA = {
  kcet: {
    ranges: [
      { rankRange: '1–500', branches: ['CS at RVCE', 'CS at MSRIT', 'CS at BMS', 'EC at RVCE', 'CS at PES University'], type: 'Top Tier' },
      { rankRange: '501–2000', branches: ['IS at RVCE', 'CS at DSCE', 'EC at MSRIT', 'CS at SJCE Mysore', 'ME at RVCE'], type: 'Excellent' },
      { rankRange: '2001–5000', branches: ['CS at Nitte MIT', 'EC at BMS', 'CS at JSS Mysore', 'Civil at RVCE', 'IS at MSRIT'], type: 'Very Good' },
      { rankRange: '5001–10000', branches: ['CS at BMSCE', 'CS at SDMCE', 'EC at Nitte MIT', 'ME at MSRIT', 'CS at AIT'], type: 'Good' },
      { rankRange: '10001–25000', branches: ['CS at various private colleges', 'EC at mid-tier colleges', 'Civil at state colleges', 'ME at regional colleges'], type: 'Average' },
      { rankRange: '25001–50000', branches: ['Any branch at tier-3 colleges', 'CS at smaller colleges', 'Non-circuit branches', 'Consider diploma lateral entry'], type: 'Low' },
    ]
  },
  jee_main: {
    ranges: [
      { rankRange: '1–1000', branches: ['CS at top NITs (Trichy, Surathkal, Warangal)', 'EC at NIT Trichy', 'CS at IIIT Hyderabad'], type: 'Top Tier' },
      { rankRange: '1001–5000', branches: ['CS at mid-tier NITs', 'EC at top NITs', 'CS at IIITs', 'DTU/NSUT Delhi'], type: 'Excellent' },
      { rankRange: '5001–15000', branches: ['CS/EC at lower NITs', 'ME at top NITs', 'CS at newer IIITs'], type: 'Very Good' },
      { rankRange: '1501–50000', branches: ['Non-CS branches at NITs', 'CS at state-funded colleges', 'GFTIs'], type: 'Good' },
      { rankRange: '50001–100000', branches: ['Any branch at lower NITs', 'CS at state engineering colleges', 'Consider private colleges'], type: 'Average' },
    ]
  },
  jee_advanced: {
    ranges: [
      { rankRange: '1–500', branches: ['CS at IIT Bombay', 'CS at IIT Delhi', 'CS at IIT Madras', 'CS at IIT Kanpur'], type: 'Top Tier' },
      { rankRange: '501–2000', branches: ['CS at IIT Kharagpur', 'EC at IIT Bombay', 'CS at IIT Roorkee', 'EE at IIT Delhi'], type: 'Excellent' },
      { rankRange: '2001–5000', branches: ['CS at newer IITs', 'EC at mid-tier IITs', 'ME at top IITs'], type: 'Very Good' },
      { rankRange: '5001–10000', branches: ['Non-CS at newer IITs', 'Any branch at various IITs'], type: 'Good' },
    ]
  },
  neet: {
    ranges: [
      { rankRange: '1–1000', branches: ['AIIMS New Delhi', 'JIPMER Puducherry', 'Top Government Medical Colleges', 'Maulana Azad Medical College'], type: 'Top Tier' },
      { rankRange: '1001–10000', branches: ['State government medical colleges (home state)', 'AIIMS in newer locations', 'Armed Forces Medical College'], type: 'Excellent' },
      { rankRange: '10001–50000', branches: ['Government medical colleges (all India quota)', 'ESI medical colleges', 'State dental colleges'], type: 'Very Good' },
      { rankRange: '50001–100000', branches: ['Private medical colleges', 'Deemed universities', 'BDS at top colleges'], type: 'Good' },
      { rankRange: '100001–200000', branches: ['BAMS/BHMS colleges', 'BPT programs', 'BSc Nursing at top hospitals', 'Consider re-attempt'], type: 'Average' },
    ]
  },
  comedk: {
    ranges: [
      { rankRange: '1–1000', branches: ['CS at MSRIT', 'CS at RVCE (MQ)', 'CS at BMS', 'EC at MSRIT'], type: 'Top Tier' },
      { rankRange: '1001–5000', branches: ['CS at DSCE', 'IS at MSRIT', 'CS at BMSCE', 'EC at BMS'], type: 'Excellent' },
      { rankRange: '5001–10000', branches: ['CS at Nitte MIT', 'CS at SJCE', 'CS at various colleges in Bangalore'], type: 'Very Good' },
      { rankRange: '10001–30000', branches: ['CS at tier-2 private colleges', 'EC/ME at mid-tier', 'CS at colleges outside Bangalore'], type: 'Good' },
    ]
  },
  cuet: {
    ranges: [
      { rankRange: 'Top 1%', branches: ['BA Hons at Delhi University (SRCC, LSR, Hindu)', 'BA at JNU', 'BHU top courses'], type: 'Top Tier' },
      { rankRange: 'Top 5%', branches: ['BA at mid-tier DU colleges', 'Central universities (Hyderabad, Allahabad)', 'Jamia Millia Islamia'], type: 'Excellent' },
      { rankRange: 'Top 15%', branches: ['State central universities', 'Integrated programs at CUs', 'BA/BSc at regional CUs'], type: 'Very Good' },
      { rankRange: 'Top 30%', branches: ['Newer central universities', 'Distance programs at IGNOU', 'State universities'], type: 'Good' },
    ]
  },
  clat: {
    ranges: [
      { rankRange: '1–100', branches: ['NLSIU Bangalore', 'NALSAR Hyderabad', 'WBNUJS Kolkata'], type: 'Top Tier' },
      { rankRange: '101–500', branches: ['NLU Jodhpur', 'GNLU Gandhinagar', 'NLIU Bhopal'], type: 'Excellent' },
      { rankRange: '501–1500', branches: ['HNLU Raipur', 'RMLNLU Lucknow', 'CNLU Patna'], type: 'Very Good' },
      { rankRange: '1501–4000', branches: ['DSNLU Visakhapatnam', 'NUALS Kochi', 'Other newer NLUs'], type: 'Good' },
    ]
  },
  uceed: {
    ranges: [
      { rankRange: '1–50', branches: ['B.Des at IIT Bombay', 'B.Des at IIT Delhi'], type: 'Top Tier' },
      { rankRange: '51–150', branches: ['B.Des at IIT Guwahati', 'B.Des at IIT Hyderabad'], type: 'Excellent' },
      { rankRange: '151–400', branches: ['B.Des at IIITDM Jabalpur', 'Top private design colleges'], type: 'Very Good' },
    ]
  },
  bitsat: {
    ranges: [
      { rankRange: '320–450', branches: ['CS at BITS Pilani', 'CS at BITS Goa', 'CS at BITS Hyderabad'], type: 'Top Tier' },
      { rankRange: '280–319', branches: ['ECE at BITS Pilani', 'CS/ECE at BITS Goa/Hyd', 'ENI at BITS Pilani'], type: 'Excellent' },
      { rankRange: '240–279', branches: ['Mechanical at BITS Pilani', 'Chemical at BITS Goa', 'Dual Degree Science at BITS Pilani'], type: 'Very Good' },
      { rankRange: '200–239', branches: ['Civil at BITS Hyderabad', 'Manufacturing at BITS Pilani'], type: 'Good' },
    ]
  },
  ipmat: {
    ranges: [
      { rankRange: 'Top 1%', branches: ['IPM (BBA+MBA) at IIM Indore'], type: 'Top Tier' },
      { rankRange: 'Top 3%', branches: ['IPM at IIM Rohtak', 'IPM at IIM Ranchi'], type: 'Excellent' },
      { rankRange: 'Top 10%', branches: ['IPM at IIM Jammu', 'IPM at IIM Bodh Gaya', 'Nirma University BBA+MBA'], type: 'Very Good' },
    ]
  },
  ca_foundation: {
    ranges: [
      { rankRange: 'Pass (Score 200+)', branches: ['Eligible for CA Intermediate & Articleship registration', 'Direct access to CA Inter study cohorts'], type: 'Top Tier' }
    ]
  },
  iata: {
    ranges: [
      { rankRange: '1–500', branches: ['BS-MS at IISc Bangalore', 'BS-MS at IISER Pune', 'BS-MS at IISER Kolkata'], type: 'Top Tier' },
      { rankRange: '501–1500', branches: ['BS-MS at IISER Mohali', 'BS-MS at IISER Bhopal', 'BS-MS at IISER Trivandrum'], type: 'Excellent' },
      { rankRange: '1501–3000', branches: ['BS-MS at IISER Tirupati', 'BS-MS at IISER Berhampur'], type: 'Very Good' },
    ]
  }
}

function RankInput({ value, onChange, label }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-200 mb-2">{label}</label>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your rank"
        className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-5 py-4 text-white text-lg font-display font-bold placeholder-gray-500 transition-all outline-none focus:ring-2 focus:ring-saffron/30"
      />
    </div>
  )
}

function renderBranchLink(branch) {
  const lower = branch.toLowerCase()
  if (lower.includes('rvce')) {
    const parts = branch.split(/rvce/i)
    return (
      <span>
        {parts[0]}
        <Link to="/college/rvce" className="text-saffron font-bold hover:underline">
          RVCE
        </Link>
        {parts[1]}
      </span>
    )
  }
  if (lower.includes('msrit')) {
    const parts = branch.split(/msrit/i)
    return (
      <span>
        {parts[0]}
        <Link to="/college/msrit" className="text-saffron font-bold hover:underline">
          MSRIT
        </Link>
        {parts[1]}
      </span>
    )
  }
  return <span>{branch}</span>
}

function ResultCard({ range, index }) {
  const tierColors = {
    'Top Tier': 'from-saffron/20 to-amber-500/5 border-saffron/30',
    'Excellent': 'from-emerald-500/15 to-green-500/5 border-emerald-500/25',
    'Very Good': 'from-blue-500/15 to-indigo-500/5 border-blue-500/25',
    'Good': 'from-purple-500/15 to-violet-500/5 border-purple-500/25',
    'Average': 'from-gray-500/15 to-gray-600/5 border-gray-500/25',
    'Low': 'from-rose-500/15 to-red-500/5 border-rose-500/25',
  }

  const tierIcons = {
    'Top Tier': '🏆',
    'Excellent': '🌟',
    'Very Good': '✨',
    'Good': '👍',
    'Average': '📋',
    'Low': '⚠️',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-gradient-to-br ${tierColors[range.type] || tierColors['Good']} border rounded-2xl p-6 hover:scale-[1.02] transition-transform duration-300`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{tierIcons[range.type]}</span>
          <div>
            <h3 className="font-display font-bold text-white text-lg">Rank {range.rankRange}</h3>
            <span className="tag tag-saffron">{range.type}</span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {range.branches.map((branch, i) => (
          <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
            <span className="w-1.5 h-1.5 rounded-full bg-saffron/60 flex-shrink-0" />
            {renderBranchLink(branch)}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default function CompetitiveExams() {
  const [selectedExam, setSelectedExam] = useState(null)
  const [rank, setRank] = useState('')
  const [simRank, setSimRank] = useState('')
  const [showSimulator, setShowSimulator] = useState(false)
  const resultsRef = useRef(null)

  // Search & Filter state
  const [activeStream, setActiveStream] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredExams = useMemo(() => {
    return EXAMS.filter(exam => {
      const matchesSearch = exam.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            exam.desc.toLowerCase().includes(searchQuery.toLowerCase())
      
      let matchesStream = true
      if (activeStream !== 'ALL') {
        if (activeStream === 'Science (PCM)') {
          matchesStream = exam.stream === 'Science (PCM)' || exam.stream === 'All'
        } else if (activeStream === 'Science (PCB)') {
          matchesStream = exam.stream === 'Science (PCB)' || exam.stream === 'All'
        } else if (activeStream === 'Commerce') {
          matchesStream = exam.stream === 'Commerce' || exam.stream === 'All'
        } else if (activeStream === 'Arts / Design / Law') {
          matchesStream = exam.stream === 'Arts / Design / Law' || exam.stream === 'All'
        }
      }
      return matchesSearch && matchesStream
    })
  }, [searchQuery, activeStream])

  const examData = selectedExam ? COUNSELLING_DATA[selectedExam] : null

  const getMatchingRange = (r) => {
    if (!examData || !r) return null
    const rankNum = parseInt(r)
    if (isNaN(rankNum)) return null
    return examData.ranges.find((range) => {
      if (range.rankRange.includes('Pass') && rankNum >= 200) return true
      if (range.rankRange.includes('Top')) {
        const pct = range.rankRange.match(/(\d+)%/)
        if (pct) return true // Mock match for simplicity
      }
      const parts = range.rankRange.replace(/,/g, '').match(/(\d+)[–-](\d+)/)
      if (parts) {
        return rankNum >= parseInt(parts[1]) && rankNum <= parseInt(parts[2])
      }
      return false
    })
  }

  const matchedRange = getMatchingRange(rank)

  useEffect(() => {
    if (selectedExam && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedExam])

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 font-sans relative">
      {/* Background */}
      <div className="fixed inset-0 bg-mesh-premium pointer-events-none" />
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none opacity-30" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-5 py-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
            <span className="text-saffron text-sm font-semibold">Counselling Simulator</span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black text-white mb-4">
            Competitive <span className="gradient-text">Exam Predictor</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Enter your entrance exam rank and instantly see which colleges and branches you can get.
            Simulate different scenarios in real-time.
          </p>
        </motion.div>

        {/* Search & Filters */}
        <div className="glass-card p-6 border-white/10 space-y-4 mb-8">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by exam name or description (e.g. JEE, CLAT, BITSAT)..."
              className="w-full bg-[#111827]/80 border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-12 py-3.5 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/30"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
          </div>

          {/* Stream pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['ALL', 'Science (PCM)', 'Science (PCB)', 'Commerce', 'Arts / Design / Law'].map((stream) => (
              <button
                key={stream}
                onClick={() => setActiveStream(stream)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  activeStream === stream
                    ? 'bg-saffron/15 border-saffron text-saffron'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/25'
                }`}
              >
                {stream}
              </button>
            ))}
          </div>
        </div>

        {/* Exam Selection Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-12">
          {filteredExams.map((exam, i) => (
            <motion.button
              key={exam.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => { setSelectedExam(exam.id); setRank(''); setShowSimulator(false) }}
              className={`p-6 rounded-2xl border text-left transition-all duration-300 bg-gradient-to-br ${exam.color} ${
                selectedExam === exam.id
                  ? 'ring-2 ring-saffron/50 scale-[1.02] shadow-lg shadow-saffron/10'
                  : 'hover:scale-[1.02] hover:shadow-lg'
              }`}
            >
              <div className="text-3xl mb-3">{exam.icon}</div>
              <h3 className="font-display font-bold text-white text-lg">{exam.name}</h3>
              <p className="text-gray-400 text-xs mt-1 line-clamp-2">{exam.desc}</p>
            </motion.button>
          ))}
          {filteredExams.length === 0 && (
            <div className="col-span-full glass-card p-12 text-center text-gray-400">
              No entrance exams match your current filters.
            </div>
          )}
        </div>

        {/* Rank Input & Results */}
        <AnimatePresence mode="wait">
          {selectedExam && (
            <motion.div
              key={selectedExam}
              ref={resultsRef}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 text-left"
            >
              {/* Rank Input Card */}
              <div className="glass-card-premium p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{EXAMS.find(e => e.id === selectedExam)?.icon}</span>
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white">
                      {EXAMS.find(e => e.id === selectedExam)?.name} Rank Predictor
                    </h2>
                    <p className="text-gray-400 text-sm">Enter your rank to see college & branch possibilities</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <RankInput value={rank} onChange={setRank} label="Your Rank" />
                  <div className="flex items-end">
                    <button
                      onClick={() => setShowSimulator(!showSimulator)}
                      className="btn-glass w-full py-4"
                    >
                      <span>🎮</span>
                      <span>{showSimulator ? 'Hide Simulator' : 'Open Counselling Simulator'}</span>
                    </button>
                  </div>
                </div>

                {/* Matched Result */}
                {matchedRange && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-6 p-6 bg-saffron/10 border border-saffron/20 rounded-2xl"
                  >
                    <h3 className="font-display font-bold text-white text-lg mb-3 flex items-center gap-2">
                      <span>🎯</span> Your Best Options (Rank {rank})
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {matchedRange.branches.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-200 bg-white/5 rounded-xl px-4 py-3 border border-white/5">
                          <span className="text-saffron">→</span>
                          {renderBranchLink(b)}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Counselling Simulator */}
              <AnimatePresence>
                {showSimulator && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="glass-card-premium p-8 overflow-hidden"
                  >
                    <h2 className="font-display text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <span>🎮</span> Interactive Counselling Simulator
                    </h2>
                    <p className="text-gray-400 text-sm mb-6">
                      Change your rank and instantly see how your options shift. Try different scenarios!
                    </p>

                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Simulate with Rank</label>
                      <input
                        type="range"
                        min="1"
                        max={selectedExam === 'neet' ? 200000 : selectedExam === 'jee_main' ? 100000 : 50000}
                        value={simRank || 1000}
                        onChange={(e) => setSimRank(e.target.value)}
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-saffron"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Rank 1</span>
                        <span className="text-saffron font-bold text-lg">{simRank || 1000}</span>
                        <span>Rank {selectedExam === 'neet' ? '200000' : selectedExam === 'jee_main' ? '100000' : '50000'}</span>
                      </div>
                    </div>

                    {/* Simulator results */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {examData?.ranges.map((range, i) => (
                        <ResultCard key={i} range={range} index={i} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* All Rank Ranges */}
              <div>
                <h2 className="font-display text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <span>📊</span> Complete Rank-wise College Map
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {examData?.ranges.map((range, i) => (
                    <ResultCard key={i} range={range} index={i} />
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <div>
                  <h4 className="text-amber-300 font-semibold text-sm mb-1">Important Disclaimer</h4>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    These predictions are based on previous year trends and are indicative only.
                    Actual cutoffs vary by year, category, and counselling round. Always verify with official
                    counselling portals for the most accurate and up-to-date information.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Links */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm mb-4">Need more help?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/onboarding" className="btn-outline text-sm py-2.5 px-5">
              Get Career Guidance
            </Link>
            <Link to="/mentors" className="btn-ghost text-sm py-2.5 px-5 border border-white/10 rounded-xl">
              Talk to a Mentor
            </Link>
            <Link to="/study-abroad" className="btn-ghost text-sm py-2.5 px-5 border border-white/10 rounded-xl">
              Study Abroad Options
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
