import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import YouTubePanel from '../components/YouTubePanel'
import { COURSES_DATA } from '../data/coursesData'

const CAREER_PATHS = [
  {
    id: 'software_engineer',
    title: 'Software Engineer',
    icon: '💻',
    color: 'from-blue-500/20 to-indigo-500/10',
    stages: [
      { id: 'current', label: 'Current Stage', icon: '📍', desc: 'Class 10/12 Student', skills: ['Basic Math', 'Logical Thinking', 'English Communication'], certs: [], salary: 'N/A', demand: 'N/A', next: ['Choose PCM stream', 'Learn basics of programming'] },
      { id: 'entrance', label: 'Entrance Exams', icon: '📝', desc: 'JEE Main / KCET / COMEDK / Direct', skills: ['Problem Solving', 'Time Management', 'Physics + Math'], certs: [], salary: 'N/A', demand: 'Very High', next: ['Practice mock tests', 'Join coaching if needed', 'Prepare for JEE/KCET'] },
      { id: 'college', label: 'College', icon: '🏫', desc: '4-year B.Tech CSE or 3-year BCA / B.Sc CS', skills: ['Data Structures', 'Algorithms', 'OOP', 'Full Stack Dev', 'System Design', 'Git & DevOps'], certs: ['NPTEL Programming', 'AWS Cloud Practitioner', 'Google IT Support'], salary: 'N/A', demand: 'Very High', next: ['Build 5+ projects', 'Contribute to open source', 'Start coding on LeetCode'] },
      { id: 'internship', label: 'Internships', icon: '💼', desc: '2-6 month industry internship', skills: ['Team Collaboration', 'Agile/Scrum', 'Code Review', 'Testing'], certs: ['Coursera Specialization'], salary: '₹10K–₹40K/month', demand: 'Very High', next: ['Apply via LinkedIn/AngelList', 'Network at tech meetups'] },
      { id: 'first_job', label: 'First Job', icon: '🚀', desc: 'Junior/Associate Software Engineer', skills: ['React/Angular', 'Node.js/Python', 'SQL', 'REST APIs'], certs: ['Meta Front-End Developer', 'Google Data Analytics'], salary: '₹4–12 LPA', demand: 'Very High', next: ['Focus on one tech stack', 'Build side projects'] },
      { id: 'mid_career', label: 'Mid Career', icon: '📈', desc: 'Senior Engineer / Tech Lead', skills: ['System Architecture', 'Mentoring', 'Performance Optimization'], certs: ['AWS Solutions Architect', 'Kubernetes'], salary: '₹15–35 LPA', demand: 'High', next: ['Lead projects', 'Speak at conferences'] },
      { id: 'senior', label: 'Ultimate Goal', icon: '👑', desc: 'Staff Engineer / Engineering Manager / CTO', skills: ['Leadership', 'Strategic Thinking', 'Business Acumen'], certs: ['MBA (optional)', 'Management Certifications'], salary: '₹40–80+ LPA', demand: 'High', next: ['Build a team', 'Shape company tech strategy'] },
    ]
  },
  {
    id: 'data_scientist',
    title: 'Data Scientist',
    icon: '📊',
    color: 'from-purple-500/20 to-violet-500/10',
    stages: [
      { id: 'current', label: 'Current Stage', icon: '📍', desc: 'Student with Math aptitude', skills: ['Statistics Basics', 'Excel', 'Logical Reasoning'], certs: [], salary: 'N/A', demand: 'N/A', next: ['Focus on Math & Statistics', 'Learn Python basics'] },
      { id: 'entrance', label: 'Entrance Exams', icon: '📝', desc: 'JEE / CUET / University Entrance', skills: ['Math + Science', 'Quantitative Aptitude'], certs: [], salary: 'N/A', demand: 'Very High', next: ['Focus on math sections', 'Build analysis portfolio'] },
      { id: 'college', label: 'College', icon: '🏫', desc: '4-year B.Tech CSE/IT or B.Sc Statistics/Math/Data Science', skills: ['Linear Algebra', 'Probability', 'Python', 'Machine Learning', 'Deep Learning', 'NLP'], certs: ['Google Data Analytics', 'IBM Data Science', 'Coursera ML Specialization'], salary: 'N/A', demand: 'Very High', next: ['Kaggle competitions', 'Research papers', 'Take online ML courses'] },
      { id: 'internship', label: 'Internships', icon: '💼', desc: 'Data Analyst / ML Intern', skills: ['SQL', 'Tableau/PowerBI', 'A/B Testing', 'ETL'], certs: ['Tableau Desktop Specialist'], salary: '₹15K–₹50K/month', demand: 'Very High', next: ['Work on real datasets', 'Learn business context'] },
      { id: 'first_job', label: 'First Job', icon: '🚀', desc: 'Junior Data Scientist / Analyst', skills: ['Scikit-learn', 'TensorFlow/PyTorch', 'Feature Engineering'], certs: ['AWS ML Specialty'], salary: '₹6–15 LPA', demand: 'Very High', next: ['Specialize in a domain', 'Publish on Medium/GitHub'] },
      { id: 'mid_career', label: 'Mid Career', icon: '📈', desc: 'Senior Data Scientist / ML Engineer', skills: ['MLOps', 'Model Deployment', 'Research', 'Team Leadership'], certs: ['Google Cloud ML Engineer'], salary: '₹20–45 LPA', demand: 'High', next: ['Lead ML projects', 'Patent innovations'] },
      { id: 'senior', label: 'Ultimate Goal', icon: '👑', desc: 'Principal Scientist / VP Analytics / AI Founder', skills: ['AI Strategy', 'Business Intelligence', 'Research Direction'], certs: ['PhD (optional)', 'Executive Programs'], salary: '₹50–100+ LPA', demand: 'High', next: ['Shape AI strategy', 'Build AI products'] },
    ]
  },
  {
    id: 'doctor',
    title: 'Doctor (MBBS)',
    icon: '🩺',
    color: 'from-emerald-500/20 to-green-500/10',
    stages: [
      { id: 'current', label: 'Current Stage', icon: '📍', desc: 'Science (PCB) Student', skills: ['Biology', 'Chemistry', 'Empathy'], certs: [], salary: 'N/A', demand: 'N/A', next: ['Focus on NEET prep', 'Shadow doctors if possible'] },
      { id: 'entrance', label: 'NEET Exam', icon: '📝', desc: 'NEET-UG for MBBS admission', skills: ['Biology Mastery', 'Chemistry Concepts', 'Physics Basics'], certs: [], salary: 'N/A', demand: 'Very High', next: ['Join NEET coaching', 'Solve 10+ years papers'] },
      { id: 'college', label: 'MBBS', icon: '🏫', desc: '5.5 years (including internship)', skills: ['Anatomy', 'Physiology', 'Pharmacology', 'Clinical Skills'], certs: ['First Aid Certification'], salary: 'Stipend: ₹15–30K/month', demand: 'Very High', next: ['Excel in clinical rotations', 'Prepare for NEET PG'] },
      { id: 'pg', label: 'PG Specialization', icon: '🔬', desc: 'MD/MS (3 years)', skills: ['Surgical Skills', 'Research', 'Specialized Medicine'], certs: ['MD/MS Degree'], salary: '₹50K–₹1L/month', demand: 'Very High', next: ['Choose specialization wisely', 'Publish research'] },
      { id: 'first_job', label: 'First Practice', icon: '🚀', desc: 'Specialist Doctor', skills: ['Patient Management', 'Diagnosis', 'Surgery'], certs: ['Medical License'], salary: '₹10–25 LPA', demand: 'Very High', next: ['Build patient trust', 'Join reputed hospital'] },
      { id: 'senior', label: 'Ultimate Goal', icon: '👑', desc: 'Senior Consultant / Own Clinic / Professor', skills: ['Leadership', 'Hospital Management', 'Teaching'], certs: ['Super Specialization (DM/MCh)'], salary: '₹30–100+ LPA', demand: 'Very High', next: ['Open own practice', 'Contribute to medical education'] },
    ]
  },
  {
    id: 'ca',
    title: 'Chartered Accountant',
    icon: '📋',
    color: 'from-amber-500/20 to-yellow-500/10',
    stages: [
      { id: 'current', label: 'Current Stage', icon: '📍', desc: 'Commerce Student', skills: ['Accounting Basics', 'Math', 'Excel'], certs: [], salary: 'N/A', demand: 'N/A', next: ['Register for CA Foundation', 'Study accounts thoroughly'] },
      { id: 'foundation', label: 'CA Foundation', icon: '📝', desc: 'Entry-level CA exam', skills: ['Accounting', 'Business Law', 'Economics', 'Math'], certs: ['CA Foundation Pass'], salary: 'N/A', demand: 'High', next: ['Clear in first attempt', 'Join articleship soon'] },
      { id: 'intermediate', label: 'CA Intermediate', icon: '📚', desc: '8 papers in 2 groups', skills: ['Advanced Accounting', 'Taxation', 'Audit', 'Cost Accounting'], certs: ['CA Inter Pass'], salary: 'Articleship Stipend', demand: 'High', next: ['Join Big 4 firms for articleship', 'Self-study or coaching'] },
      { id: 'articleship', label: 'Articleship', icon: '💼', desc: '3 years mandatory training', skills: ['Practical Auditing', 'Tax Filing', 'Client Management'], certs: [], salary: '₹5K–₹25K/month', demand: 'High', next: ['Learn from senior CAs', 'Prepare for CA Final alongside'] },
      { id: 'final', label: 'CA Final', icon: '🏆', desc: 'Final examination', skills: ['Financial Reporting', 'Strategic Management', 'Advanced Audit'], certs: ['CA Membership'], salary: 'N/A', demand: 'High', next: ['Clear both groups', 'Network for job offers'] },
      { id: 'first_job', label: 'First Job', icon: '🚀', desc: 'Junior CA / Audit Associate', skills: ['IFRS', 'Tax Planning', 'Due Diligence'], certs: ['CA License'], salary: '₹7–15 LPA', demand: 'High', next: ['Specialize in a domain', 'Consider Big 4 or industry'] },
      { id: 'senior', label: 'Ultimate Goal', icon: '👑', desc: 'CFO / Partner at CA Firm / Own Practice', skills: ['Strategic Finance', 'M&A', 'Leadership'], certs: ['CPA/CFA (optional)'], salary: '₹30–80+ LPA', demand: 'High', next: ['Build client base', 'Establish own firm'] },
    ]
  },
  {
    id: 'designer',
    title: 'UI/UX Designer',
    icon: '🎨',
    color: 'from-pink-500/20 to-rose-500/10',
    stages: [
      { id: 'current', label: 'Current Stage', icon: '📍', desc: 'Creative Student', skills: ['Visual Thinking', 'Creativity', 'Observation'], certs: [], salary: 'N/A', demand: 'N/A', next: ['Start with Figma', 'Redesign existing apps for practice'] },
      { id: 'education', label: 'Education', icon: '🎓', desc: 'B.Des / BFA / Self-taught', skills: ['Typography', 'Color Theory', 'Layout Design', 'Prototyping'], certs: ['Google UX Design Certificate'], salary: 'N/A', demand: 'High', next: ['Build a portfolio website', 'Study design systems'] },
      { id: 'internship', label: 'Internships', icon: '💼', desc: 'Design Intern at startups/agencies', skills: ['Figma', 'User Research', 'Wireframing', 'Design Thinking'], certs: ['Interaction Design Foundation'], salary: '₹10K–₹30K/month', demand: 'High', next: ['Work on real products', 'Get user feedback'] },
      { id: 'first_job', label: 'First Job', icon: '🚀', desc: 'Junior UI/UX Designer', skills: ['Design Systems', 'Usability Testing', 'Motion Design', 'Accessibility'], certs: ['Adobe Certified'], salary: '₹4–10 LPA', demand: 'High', next: ['Specialize (product/visual/motion)', 'Present at design meetups'] },
      { id: 'mid_career', label: 'Mid Career', icon: '📈', desc: 'Senior Designer / Design Lead', skills: ['Design Strategy', 'Mentoring', 'Cross-functional Leadership'], certs: ['HFI CUA', 'Nielsen Norman UX'], salary: '₹12–30 LPA', demand: 'High', next: ['Lead design teams', 'Shape product vision'] },
      { id: 'senior', label: 'Ultimate Goal', icon: '👑', desc: 'Head of Design / Design Director / Founder', skills: ['Business Strategy', 'Brand Building', 'Innovation'], certs: ['MBA (optional)'], salary: '₹30–60+ LPA', demand: 'High', next: ['Build a design studio', 'Influence industry standards'] },
    ]
  },
  {
    id: 'civil_services',
    title: 'IAS / Civil Services',
    icon: '🏛️',
    color: 'from-teal-500/20 to-cyan-500/10',
    stages: [
      { id: 'current', label: 'Current Stage', icon: '📍', desc: 'Any Stream Student', skills: ['General Knowledge', 'Reading Habit', 'Current Affairs'], certs: [], salary: 'N/A', demand: 'N/A', next: ['Read newspapers daily', 'Start NCERT foundation'] },
      { id: 'education', label: 'Graduation', icon: '🎓', desc: 'Any Bachelor\'s Degree', skills: ['Analytical Writing', 'Ethics', 'Indian Polity', 'Economics'], certs: ['Any UG Degree'], salary: 'N/A', demand: 'Stable', next: ['Choose optional subject', 'Start prelims prep in final year'] },
      { id: 'preparation', label: 'UPSC Preparation', icon: '📝', desc: '1-3 years focused prep', skills: ['Essay Writing', 'Answer Structuring', 'Current Affairs', 'Geography'], certs: [], salary: 'N/A', demand: 'Stable', next: ['Join coaching or self-study', 'Give mock tests'] },
      { id: 'exam', label: 'UPSC CSE', icon: '🏆', desc: 'Prelims → Mains → Interview', skills: ['Time Management', 'Personality Development', 'Subject Mastery'], certs: ['UPSC Qualification'], salary: 'N/A', demand: 'Stable', next: ['Clear prelims first', 'Focus on mains answer writing'] },
      { id: 'training', label: 'LBSNAA Training', icon: '🏫', desc: '2-year Foundation Course', skills: ['Administration', 'Law', 'Public Policy', 'Leadership'], certs: ['IAS/IPS/IFS Officer'], salary: '₹56,100/month (start)', demand: 'Prestigious', next: ['Build strong network', 'Learn field administration'] },
      { id: 'senior', label: 'Ultimate Goal', icon: '👑', desc: 'Secretary / Chief Secretary / Ambassador', skills: ['Policy Making', 'Governance', 'Diplomacy', 'Nation Building'], certs: ['Career Progression'], salary: '₹2.5L/month + perks', demand: 'Prestigious', next: ['Serve with integrity', 'Drive policy reforms'] },
    ]
  },
]

function StageNode({ stage, isActive, isCompleted, onClick, index, total }) {
  return (
    <div className="flex items-start gap-4">
      {/* Timeline Line + Dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClick}
          className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-xl transition-all duration-300 z-10 ${
            isActive
              ? 'bg-saffron border-saffron text-white shadow-lg shadow-saffron/30'
              : isCompleted
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
              : 'bg-white/5 border-white/15 text-gray-500 hover:border-saffron/40'
          }`}
        >
          {stage.icon}
        </motion.button>
        {index < total - 1 && (
          <div className={`w-0.5 h-16 ${isCompleted ? 'bg-emerald-500/40' : 'bg-white/10'} transition-colors duration-300`} />
        )}
      </div>

      {/* Content */}
      <motion.div
        initial={false}
        animate={{ opacity: isActive ? 1 : 0.6 }}
        className={`flex-1 pb-6 cursor-pointer ${isActive ? '' : 'opacity-60 hover:opacity-80'}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`font-display font-bold ${isActive ? 'text-white text-lg' : 'text-gray-300 text-base'}`}>
            {stage.label}
          </h3>
          {isCompleted && <span className="tag tag-emerald text-[8px]">✓ Passed</span>}
        </div>
        <p className="text-gray-400 text-sm">{stage.desc}</p>
      </motion.div>
    </div>
  )
}

function StageDetail({ stage, pathId }) {
  return (
    <motion.div
      key={stage.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="glass-card-premium p-8"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-saffron/15 border border-saffron/30 flex items-center justify-center text-3xl">
          {stage.icon}
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-white">{stage.label}</h2>
          <p className="text-gray-400 text-sm">{stage.desc}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Skills Required */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
          <h3 className="text-sm font-bold text-saffron uppercase tracking-wider mb-3">🛠️ Skills Required</h3>
          <div className="flex flex-wrap gap-2">
            {stage.skills.map((s, i) => (
              <span key={i} className="tag tag-blue">{s}</span>
            ))}
          </div>
        </div>

        {/* Certifications */}
        {stage.certs.length > 0 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-3">📜 Certifications</h3>
            <div className="space-y-2">
              {stage.certs.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                  <span className="text-emerald-400">✦</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Salary */}
        {stage.salary !== 'N/A' && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">💰 Salary Expectations</h3>
            <p className="text-xl font-display font-bold text-white">{stage.salary}</p>
          </div>
        )}

        {/* Industry Demand */}
        {stage.demand !== 'N/A' && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
            <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3">📈 Industry Demand</h3>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                stage.demand === 'Very High' ? 'bg-emerald-500/15 text-emerald-400' :
                stage.demand === 'High' ? 'bg-blue-500/15 text-blue-400' :
                stage.demand === 'Stable' ? 'bg-amber-500/15 text-amber-400' :
                'bg-gray-500/15 text-gray-400'
              }`}>
                {stage.demand}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Next Steps */}
      <div className="mt-6 bg-saffron/8 border border-saffron/15 rounded-xl p-5 mb-6">
        <h3 className="text-sm font-bold text-saffron uppercase tracking-wider mb-3">🚀 Action Steps</h3>
        <div className="space-y-2">
          {stage.next.map((n, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-200">
              <span className="w-6 h-6 rounded-lg bg-saffron/10 border border-saffron/20 flex items-center justify-center text-[10px] text-saffron font-bold flex-shrink-0">{i+1}</span>
              <span>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* YouTubePanel for career roadmap video guidance */}
      <YouTubePanel topic={[`${pathId}_${stage.id}`, pathId]} stageId={stage.id} title={`Curated Video Guide for ${stage.label}`} />
    </motion.div>
  )
}

function CourseCard({ course }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="glass-card hover:border-saffron/30 transition-all duration-300 p-5 overflow-hidden">
      <div 
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
            {course.icon}
          </div>
          <div className="text-left">
            <span className="text-[10px] uppercase font-bold tracking-widest text-saffron bg-saffron/10 px-2.5 py-1 rounded-full">{course.category}</span>
            <h3 className="font-display font-bold text-white text-lg mt-2">{course.title}</h3>
            <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-1">
              <div>⏱️ <span className="font-medium text-gray-300">{course.duration}</span></div>
              <div>🎓 Eligibility: <span className="font-medium text-gray-300">{course.eligibility}</span></div>
            </div>
          </div>
        </div>
        <button className="text-gray-400 hover:text-white p-1">
          <span className={`inline-block transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-5 pt-5 border-t border-white/5 space-y-4 text-left overflow-hidden"
          >
            <div>
              <h4 className="text-xs uppercase font-bold tracking-widest text-saffron mb-1.5">Description</h4>
              <p className="text-gray-300 text-sm leading-relaxed">{course.description}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/2 border border-white/5 p-4 rounded-xl">
                <h4 className="text-xs uppercase font-bold tracking-widest text-emerald-400 mb-1.5">📚 Key Subjects</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{course.subjects}</p>
              </div>
              <div className="bg-white/2 border border-white/5 p-4 rounded-xl">
                <h4 className="text-xs uppercase font-bold tracking-widest text-cyan-400 mb-1.5">🛠️ Required Skills</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{course.requiredSkills}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/2 border border-white/5 p-4 rounded-xl">
                <h4 className="text-xs uppercase font-bold tracking-widest text-amber-400 mb-1.5">📝 Entrance Exams</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{course.entranceExams}</p>
              </div>
              <div className="bg-white/2 border border-white/5 p-4 rounded-xl">
                <h4 className="text-xs uppercase font-bold tracking-widest text-purple-400 mb-1.5">📈 Future Scope</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{course.futureScope}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/2 border border-white/5 p-4 rounded-xl">
                <h4 className="text-xs uppercase font-bold tracking-widest text-rose-400 mb-1.5">💰 Starting Salary</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{course.salary}</p>
              </div>
              <div className="bg-white/2 border border-white/5 p-4 rounded-xl">
                <h4 className="text-xs uppercase font-bold tracking-widest text-indigo-400 mb-1.5">🎓 Higher Studies</h4>
                <p className="text-gray-300 text-xs leading-relaxed">{course.higherStudies}</p>
              </div>
            </div>

            <div className="bg-saffron/5 border border-saffron/10 p-4 rounded-xl">
              <h4 className="text-xs uppercase font-bold tracking-widest text-saffron mb-1">💡 Important Information</h4>
              <p className="text-gray-300 text-xs leading-relaxed">{course.importantInfo}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function CareerPipeline() {
  const [searchParams] = useSearchParams()
  const classParam = searchParams.get('class')

  const [activeTab, setActiveTab] = useState(classParam ? 'catalog' : 'roadmaps') // roadmaps | catalog
  const [selectedPath, setSelectedPath] = useState(null)
  const [activeStageIdx, setActiveStageIdx] = useState(0)

  // Profile-based state
  // eslint-disable-next-line no-unused-vars
  const [profile, setProfile] = useState(() => {
    try {
      const data = localStorage.getItem('aageKyaFormData')
      return data ? JSON.parse(data) : null
    } catch (_) {
      return null
    }
  })

  // Dynamic Career Path generator state
  const [careerPathsList, setCareerPathsList] = useState(CAREER_PATHS)
  const [customProfession, setCustomProfession] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)

  // Catalog state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  const path = careerPathsList.find(p => p.id === selectedPath)

  const handlePathSwitch = useCallback((pathId) => {
    setSelectedPath(pathId)
    setActiveStageIdx(0)
  }, [])

  const isRecommended = useCallback((pId, stream) => {
    if (!stream) return false
    const lowerStream = stream.toLowerCase()
    if (lowerStream.includes('pcm')) {
      return pId === 'software_engineer' || pId === 'data_scientist'
    }
    if (lowerStream.includes('pcb')) {
      return pId === 'doctor'
    }
    if (lowerStream.includes('commerce')) {
      return pId === 'ca'
    }
    if (lowerStream.includes('arts') || lowerStream.includes('humanities')) {
      return pId === 'designer' || pId === 'civil_services'
    }
    return false
  }, [])

  const handleGenerateCustomPath = async (e) => {
    e.preventDefault()
    if (!customProfession.trim()) return
    setGenerating(true)
    setGenError(null)

    try {
      const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const res = await fetch(`${backendUrl}/api/generate-career-path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profession: customProfession.trim(),
          formData: profile
        })
      })

      if (!res.ok) {
        throw new Error('Failed to generate career path roadmap')
      }

      const newPath = await res.json()
      // Prepend to current list and select it
      setCareerPathsList(prev => [newPath, ...prev])
      setSelectedPath(newPath.id)
      setActiveStageIdx(0)
      setCustomProfession('')
    } catch (err) {
      setGenError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Filter courses
  const filteredCourses = useMemo(() => {
    return COURSES_DATA.filter(course => {
      const matchesSearch = 
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.subjects.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.requiredSkills.toLowerCase().includes(searchQuery.toLowerCase())

      let matchesCategory = true
      if (selectedCategory !== 'ALL') {
        matchesCategory = course.category.toLowerCase().includes(selectedCategory.toLowerCase())
      }

      // If user came specifically looking for class 10 options, filter relevant ones
      if (classParam === '10' && selectedCategory === 'ALL') {
        const lowerTitle = course.title.toLowerCase()
        // Diploma, ITI, Polytechnic, 10th options are primary
        if (lowerTitle.includes('b.tech') || lowerTitle.includes('mbbs') || lowerTitle.includes('pilot') || lowerTitle.includes('civil services')) {
          return false
        }
      }

      return matchesSearch && matchesCategory
    })
  }, [searchQuery, selectedCategory, classParam])

  // Get unique categories for filters
  const categories = useMemo(() => {
    const cats = new Set(COURSES_DATA.map(c => {
      // Split compound categories for simpler filter buttons
      if (c.category.includes('&')) return c.category.split('&')[1].trim()
      return c.category
    }))
    return ['ALL', ...Array.from(cats)]
  }, [])

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 font-sans relative">
      <div className="fixed inset-0 bg-mesh-premium pointer-events-none" />
      <div className="fixed inset-0 bg-grid-pattern pointer-events-none opacity-30" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-5 py-2 mb-6">
            <span className="text-lg">🗺️</span>
            <span className="text-emerald-300 text-sm font-semibold">
              {classParam === '10' ? 'Post-10th Career & Stream Options' : classParam === '12' ? 'Post-12th Career & Degree Options' : 'Career Pipeline & Course Catalog'}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black text-white mb-4">
            Explore Your <span className="gradient-text">Future Paths</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Review detailed guidelines on major Indian career streams and interactive job roadmaps from high school directly to ultimate corporate goals.
          </p>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex justify-center bg-white/5 border border-white/10 rounded-xl p-1 mb-8 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('roadmaps')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'roadmaps'
                ? 'bg-saffron text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🧭 Interactive Roadmaps
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'catalog'
                ? 'bg-saffron text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📖 Expandable Course Catalog
          </button>
        </div>

        {activeTab === 'roadmaps' ? (
          <>
            {/* Custom AI Career Generator */}
            <div className="glass-card-premium p-6 border-saffron/20 bg-saffron/5 rounded-2xl mb-8 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-saffron/10 rounded-full filter blur-xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="font-display font-bold text-white text-lg flex items-center gap-2">
                    <span>✨</span> AI Custom Career Path Generator
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Type any profession in the world, and our AI will build a personalized step-by-step career path for you.
                  </p>
                  
                  {/* Quick click suggestions based on profile */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="text-xs text-gray-500 font-medium">Try these:</span>
                    {profile?.stream?.toLowerCase().includes('pcm') ? (
                      <>
                        {['Robotics Engineer', 'Cybersecurity Specialist', 'Game Developer'].map(sug => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setCustomProfession(sug)}
                            className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/5"
                          >
                            {sug}
                          </button>
                        ))}
                      </>
                    ) : profile?.stream?.toLowerCase().includes('pcb') ? (
                      <>
                        {['Geneticist', 'Pharmacologist', 'Clinical Research'].map(sug => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setCustomProfession(sug)}
                            className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/5"
                          >
                            {sug}
                          </button>
                        ))}
                      </>
                    ) : profile?.stream?.toLowerCase().includes('commerce') ? (
                      <>
                        {['Investment Banker', 'Stock Analyst', 'Actuary'].map(sug => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setCustomProfession(sug)}
                            className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/5"
                          >
                            {sug}
                          </button>
                        ))}
                      </>
                    ) : (
                      <>
                        {['UX Researcher', 'Digital Marketer', 'Content Strategist'].map(sug => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setCustomProfession(sug)}
                            className="px-2.5 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 text-gray-300 transition-all border border-white/5"
                          >
                            {sug}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
                <form onSubmit={handleGenerateCustomPath} className="w-full md:max-w-md flex gap-2 flex-shrink-0">
                  <input
                    type="text"
                    required
                    value={customProfession}
                    onChange={(e) => setCustomProfession(e.target.value)}
                    placeholder="e.g. Space Scientist, Chef, Ethical Hacker..."
                    className="flex-1 bg-[#111827]/80 border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/30"
                  />
                  <button
                    type="submit"
                    disabled={generating}
                    className="btn-primary text-sm px-5 py-2.5 flex items-center gap-1.5 whitespace-nowrap bg-gradient-to-r from-saffron to-amber-500 hover:from-saffron-dark hover:to-amber-600 shadow-md shadow-saffron/25"
                  >
                    {generating ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <span>⚡ Generate</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
              {genError && (
                <p className="mt-3 text-xs text-rose-400 font-medium">⚠️ {genError}</p>
              )}
            </div>

            {/* Career Path Selection */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-12">
              {careerPathsList.map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePathSwitch(p.id)}
                  className={`p-5 rounded-2xl border text-left bg-gradient-to-br ${p.color} transition-all duration-300 relative ${
                    selectedPath === p.id ? 'ring-2 ring-saffron/50 border-saffron/30' : 'border-white/10'
                  }`}
                >
                  {profile && isRecommended(p.id, profile.stream) && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      🎯 Recommended
                    </span>
                  )}
                  <span className="text-3xl">{p.icon}</span>
                  <h3 className="font-display font-bold text-white text-sm mt-2">{p.title}</h3>
                </motion.button>
              ))}
            </div>

            {/* Pipeline */}
            <AnimatePresence mode="wait">
              {path && (
                <motion.div
                  key={path.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="grid lg:grid-cols-[320px_1fr] gap-8"
                >
                  {/* Timeline */}
                  <div className="glass-card p-6 rounded-2xl border border-white/10 self-start lg:sticky lg:top-24">
                    <h3 className="font-display font-bold text-white text-lg mb-6 flex items-center gap-2">
                      <span>{path.icon}</span> {path.title}
                    </h3>
                    <div>
                      {path.stages.map((stage, i) => (
                        <StageNode
                          key={stage.id}
                          stage={stage}
                          index={i}
                          total={path.stages.length}
                          isActive={i === activeStageIdx}
                          isCompleted={i < activeStageIdx}
                          onClick={() => setActiveStageIdx(i)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Stage Detail */}
                  <AnimatePresence mode="wait">
                    <StageDetail key={path.stages[activeStageIdx].id} stage={path.stages[activeStageIdx]} pathId={path.id} />
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty State */}
            {!selectedPath && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-premium p-16 text-center">
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="font-display text-2xl font-bold text-white mb-2">Select a Career Path</h3>
                <p className="text-gray-400 max-w-md mx-auto">
                  Click on any career above to see your complete journey — from where you are now to your ultimate career goal.
                </p>
              </motion.div>
            )}
          </>
        ) : (
          <div className="space-y-8">
            {/* Search & Filters */}
            <div className="glass-card p-6 border-white/10 space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by course title, subjects, or skills (e.g. Coding, Law, B.Tech)..."
                  className="w-full bg-[#111827]/80 border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-12 py-3.5 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/30"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-2 pt-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      (selectedCategory === cat || (cat !== 'ALL' && selectedCategory.toLowerCase().includes(cat.toLowerCase())))
                        ? 'bg-saffron/15 border-saffron text-saffron'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/25'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Courses grid */}
            <div className="space-y-4">
              {filteredCourses.length > 0 ? (
                filteredCourses.map((course, idx) => (
                  <CourseCard key={idx} course={course} />
                ))
              ) : (
                <div className="glass-card-premium p-16 text-center">
                  <div className="text-5xl mb-4">🤷‍♂️</div>
                  <h3 className="font-display text-xl font-bold text-white mb-2">No Courses Found</h3>
                  <p className="text-gray-400 max-w-sm mx-auto">
                    We couldn't find any courses matching your search query. Try checking your spelling or clearing filters.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/onboarding" className="btn-primary text-sm py-3 px-6">Get Personalized Guidance</Link>
            <Link to="/competitive-exams" className="btn-outline text-sm py-3 px-6">Check Exam Rankings</Link>
          </div>
        </div>
      </div>
    </main>
  )
}
