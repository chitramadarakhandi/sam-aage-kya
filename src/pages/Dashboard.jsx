import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { getMentors, postReOnboard, putWallet } from '../api'

export default function Dashboard() {
  const { user, session, profile, loading: authLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState('guidance') // guidance | tracker | wallet | parent | history
  const [guidance, setGuidance] = useState(null)
  const [roadmaps, setRoadmaps] = useState([])
  const [matchedMentor, setMatchedMentor] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)

  // Academic Wallet state
  const [wallet, setWallet] = useState([])
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [walletEditingEntry, setWalletEditingEntry] = useState(null)
  const [walletForm, setWalletForm] = useState({ type: 'skill', title: '', description: '', date: '', tags: '' })
  const [walletSaving, setWalletSaving] = useState(false)

  // Goal Tracker state
  const [completedTasks, setCompletedTasks] = useState({})

  // Re-onboarding state
  const [reOnboarding, setReOnboarding] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) navigate('/')
  }, [user, authLoading, navigate])

  // Load dashboard data
  useEffect(() => {
    if (!user) return
    const load = async () => {
      setDataLoading(true)
      try {
        const [{ data: g }, { data: r }, { data: student }] = await Promise.all([
          supabase.from('guidance_results').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('roadmaps').select('*').eq('student_id', user.id).order('created_at', { ascending: false }),
          supabase.from('students').select('*').eq('id', user.id).maybeSingle()
        ])
        setGuidance(g)
        setRoadmaps(r || [])
        setWallet(student?.academic_wallet || [])

        // Load completed tracker tasks from localStorage
        const storedTasks = localStorage.getItem(`aageKyaCompletedTasks:${user.id}`)
        if (storedTasks) {
          setCompletedTasks(JSON.parse(storedTasks))
        }

        // Fetch matched mentor
        if (student) {
          const streamToMatch = student.stream || 'Class 10 / Stream Selection'
          const classLevel = student.class_level || 'class12'

          const res = await getMentors()
          if (res.ok) {
            const mentors = await res.json()
            const match = mentors.find(m => {
              if (classLevel === 'class10') {
                return m.stream_category === 'Class 10 / Stream Selection' && m.available
              }
              return m.stream_category === streamToMatch && m.available
            })
            setMatchedMentor(match || null)
          }
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setDataLoading(false)
      }
    }
    load()
  }, [user])

  if (authLoading || (dataLoading && !guidance)) {
    return (
      <main className="pt-24 pb-16 min-h-screen flex items-center justify-center bg-navy text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-saffron border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-400 text-sm font-medium">Loading your dashboard...</span>
        </div>
      </main>
    )
  }

  if (!user || !profile) return null

  const initials = profile?.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?'
  const joinDate = new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })

  // Re-run Onboarding Trigger
  const handleReOnboard = async () => {
    if (!window.confirm('This will archive your current guidance results to history so you can generate a fresh report. Are you sure you want to proceed?')) return
    setReOnboarding(true)
    try {
      const token = session?.access_token
      const res = await postReOnboard(token)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.message || 'Archiving failed')
      }
      // Re-fetch profile inputs
      await refreshProfile()
      localStorage.removeItem('aageKyaFormData')
      // Navigate to onboarding
      const nextOnboard = profile?.role === 'other' ? '/onboarding' : profile?.class_level === 'class10' ? '/class10/onboarding' : '/class12/onboarding'
      navigate(nextOnboard)
    } catch (err) {
      console.error('Error re-onboarding:', err)
      alert(err.message || 'Could not archive results. Please try again.')
    } finally {
      setReOnboarding(false)
    }
  }

  // Restore snapshot from history
  const handleRestoreHistory = async (snapshot) => {
    if (!window.confirm('This will replace your current active guidance report with this archived version. Your current report will be archived. Restore now?')) return
    setReOnboarding(true)
    try {
      const token = session?.access_token
      
      // Step 1: Archive current report first
      await postReOnboard(token)

      // Step 2: Write snapshot data into database
      const client = supabase
      // Update student profile input fields
      await client.from('students').update({
        full_name: snapshot.profile.fullName || '',
        state: snapshot.profile.state || '',
        board: snapshot.profile.board || '',
        stream: snapshot.profile.stream || '',
        marks: Number(snapshot.profile.marks) || 0,
        income_range: snapshot.profile.incomeRange || '',
        first_gen_college: snapshot.profile.firstGenCollege === true,
        preferred_cities: snapshot.profile.preferredCities || [],
        interests: snapshot.profile.interests || '',
        biggest_fear: snapshot.profile.biggestFear || '',
        class_level: snapshot.profile.classLevel || 'class12',
        parent_pressure: snapshot.profile.parentPressure === true,
        parent_expectations: snapshot.profile.parentExpectations || '',
        risk_comfort: snapshot.profile.riskComfort || '',
        coaching_access: snapshot.profile.coachingAccess === true,
      }).eq('id', user.id)

      // Insert guidance result
      if (snapshot.guidance) {
        await client.from('guidance_results').insert({
          student_id: user.id,
          summary: snapshot.guidance.summary,
          options: snapshot.guidance.options,
          scholarship_to_check: snapshot.guidance.scholarship_to_check,
          one_thing_to_do_this_week: snapshot.guidance.one_thing_to_do_this_week
        })
      }

      // Insert roadmaps
      if (snapshot.roadmaps && snapshot.roadmaps.length > 0) {
        await client.from('roadmaps').insert(
          snapshot.roadmaps.map(r => ({
            student_id: user.id,
            career_path: r.career_path,
            overview: r.overview,
            years: r.years
          }))
        )
      }

      // Refresh page
      await refreshProfile()
      window.location.reload()
    } catch (err) {
      console.error('Error restoring snapshot:', err)
      alert('Could not restore snapshot. Please try again.')
    } finally {
      setReOnboarding(false)
    }
  }

  // Academic Wallet Helpers
  const handleOpenWalletModal = (entry = null) => {
    if (entry) {
      setWalletEditingEntry(entry)
      setWalletForm({
        type: entry.type,
        title: entry.title,
        description: entry.description,
        date: entry.date || '',
        tags: (entry.tags || []).join(', ')
      })
    } else {
      setWalletEditingEntry(null)
      setWalletForm({ type: 'skill', title: '', description: '', date: '', tags: '' })
    }
    setWalletModalOpen(true)
  }

  const handleSaveWalletEntry = async (e) => {
    e.preventDefault()
    if (!walletForm.title.trim()) return
    setWalletSaving(true)

    try {
      const parsedTags = walletForm.tags.split(',').map(t => t.trim()).filter(Boolean)
      let updatedWallet = []

      if (walletEditingEntry) {
        // Edit mode
        updatedWallet = wallet.map(w => w.id === walletEditingEntry.id ? {
          ...w,
          type: walletForm.type,
          title: walletForm.title,
          description: walletForm.description,
          date: walletForm.date,
          tags: parsedTags
        } : w)
      } else {
        // Add mode
        const newEntry = {
          id: crypto.randomUUID(),
          type: walletForm.type,
          title: walletForm.title,
          description: walletForm.description,
          date: walletForm.date,
          tags: parsedTags,
          created_at: new Date().toISOString()
        }
        updatedWallet = [newEntry, ...wallet]
      }

      const token = session?.access_token
      const res = await putWallet(updatedWallet, token)

      if (!res.ok) throw new Error('Failed to update wallet')
      const resData = await res.json()
      setWallet(resData.wallet)
      setWalletModalOpen(false)
    } catch (err) {
      console.error('Wallet save error:', err)
      alert('Could not save entry. Please try again.')
    } finally {
      setWalletSaving(false)
    }
  }

  const handleDeleteWalletEntry = async (id) => {
    if (!window.confirm('Delete this entry from your Academic Wallet?')) return
    try {
      const updatedWallet = wallet.filter(w => w.id !== id)
      const token = session?.access_token
      const res = await putWallet(updatedWallet, token)

      if (!res.ok) throw new Error('Failed to delete')
      const resData = await res.json()
      setWallet(resData.wallet)
    } catch (err) {
      console.error('Wallet delete error:', err)
      alert('Could not delete entry.')
    }
  }

  // Goal Tracker Helpers
  const toggleTask = (taskId) => {
    const nextTasks = { ...completedTasks, [taskId]: !completedTasks[taskId] }
    setCompletedTasks(nextTasks)
    localStorage.setItem(`aageKyaCompletedTasks:${user.id}`, JSON.stringify(nextTasks))
  }

  // Action plan items extractor
  const getActionPlanTasks = () => {
    const list = []
    if (guidance?.one_thing_to_do_this_week) {
      list.push({
        id: 'one_thing_this_week',
        category: 'Immediate Action',
        task: guidance.one_thing_to_do_this_week,
        timeframe: 'This Week'
      })
    }

    if (guidance?.options) {
      guidance.options.forEach((opt, oIdx) => {
        list.push({
          id: `opt_${oIdx}_watchout`,
          category: `Option ${oIdx + 1}: ${opt.path}`,
          task: `Address risks: ${opt.watch_out_for}`,
          timeframe: 'Month 1'
        })
        list.push({
          id: `opt_${oIdx}_colleges`,
          category: `Option ${oIdx + 1}: ${opt.path}`,
          task: `Research entry criteria for target institutions: ${(opt.realistic_colleges || []).join(', ')}`,
          timeframe: 'Month 2'
        })
      })
    }

    if (roadmaps.length > 0) {
      roadmaps.forEach((rm) => {
        (rm.years || []).forEach((yearData) => {
          const yearLabel = profile.class_level === 'class10'
            ? (yearData.year === 1 ? 'Class 11' : yearData.year === 2 ? 'Class 12' : `College Yr ${yearData.year - 2}`)
            : `Year ${yearData.year}`
          
          if (yearData.skills && yearData.skills.length > 0) {
            list.push({
              id: `rm_${rm.id}_yr_${yearData.year}_skills`,
              category: `Roadmap: ${rm.career_path} (${yearLabel})`,
              task: `Acquire key skills: ${yearData.skills.join(', ')}`,
              timeframe: 'Ongoing'
            })
          }
          if (yearData.certifications && yearData.certifications.length > 0) {
            list.push({
              id: `rm_${rm.id}_yr_${yearData.year}_certifications`,
              category: `Roadmap: ${rm.career_path} (${yearLabel})`,
              task: `Complete certifications: ${yearData.certifications.join(', ')}`,
              timeframe: 'Recommended'
            })
          }
        })
      })
    }

    return list
  }

  const tasksList = getActionPlanTasks()
  const completedCount = tasksList.filter(t => completedTasks[t.id]).length
  const trackerPercentage = tasksList.length > 0 ? Math.round((completedCount / tasksList.length) * 100) : 0

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8 bg-navy text-white font-sans">
      <div className="max-w-5xl mx-auto">

        {/* ── Profile Header ── */}
        <div className="glass-card p-6 sm:p-8 mb-8 relative overflow-hidden rounded-3xl border border-white/10">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-saffron/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-saffron/5 via-transparent to-transparent pointer-events-none" />

          <div className="relative flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-saffron to-saffron-dark flex items-center justify-center text-white font-display font-black text-3xl shadow-lg shadow-saffron/15 flex-shrink-0">
                {initials}
              </div>

              <div className="text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mb-1.5">
                  <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                    {profile?.full_name || 'My Dashboard'}
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-300 self-center sm:self-auto">
                    🎓 {profile?.role === 'other' ? 'General Learner' : `Student (${profile?.class_level === 'class10' ? 'Class 10' : 'Class 12'})`}
                  </span>
                </div>
                <p className="text-gray-400 text-sm">{user.email}</p>
                <p className="text-gray-600 text-xs mt-1">Guided since {joinDate}</p>

                {/* Quick Profile Parameters */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-2.5 mt-4">
                  {[
                    profile.stream && { label: 'Stream', value: profile.stream },
                    profile.marks && { label: 'Marks', value: `${profile.marks}%` },
                    profile.state && { label: 'State', value: profile.state },
                    profile.board && { label: 'Board', value: profile.board },
                  ].filter(Boolean).map((item) => (
                    <div key={item.label} className="bg-navy-800 border border-white/5 rounded-xl px-3.5 py-1.5 text-center min-w-[70px]">
                      <div className="text-white text-xs font-bold leading-tight">{item.value}</div>
                      <div className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-wide">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto self-stretch md:self-start">
              <button
                onClick={handleReOnboard}
                disabled={reOnboarding}
                className="flex-1 md:flex-none btn-outline text-xs py-3 px-5 text-center hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {reOnboarding ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🔄</span>
                )}
                <span>Re-run Guidance</span>
              </button>
              <Link
                to={profile?.role === 'other' ? '/result' : profile?.class_level === 'class10' ? '/class10/result' : '/class12/result'}
                className="flex-1 md:flex-none btn-primary text-xs py-3 px-6 text-center shadow-lg shadow-saffron/15 font-semibold text-white bg-saffron hover:bg-saffron-light active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <span>🧭</span>
                <span>Active Guide</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Role-Based Quick Access Tiles ── */}
        {(() => {
          const tiles = [
            { icon: '🎒', label: 'Post 10th Options', desc: 'Streams, courses & roadmaps after class 10', to: '/career-pipeline?class=10', color: 'from-blue-500/15 to-indigo-500/5 border-blue-500/20' },
            { icon: '🎓', label: 'Post 12th Options', desc: 'Degrees, admissions & pathways after class 12', to: '/career-pipeline?class=12', color: 'from-emerald-500/15 to-teal-500/5 border-emerald-500/20' },
            { icon: '📝', label: 'Profile Builder', desc: 'Fill/update your details for AI guidance', to: '/onboarding', color: 'from-saffron/15 to-orange-500/5 border-saffron/20' },
            { icon: '✈️', label: 'Study Abroad', desc: 'Universities, countries, exams & visas', to: '/study-abroad', color: 'from-purple-500/15 to-violet-500/5 border-purple-500/20' },
            { icon: '💰', label: 'Scholarships', desc: 'Find relevant financial aid opportunities', to: '/scholarships', color: 'from-amber-500/15 to-yellow-500/5 border-amber-500/20' },
            { icon: '🌟', label: 'Mentors', desc: 'Book a free call with verified seniors', to: '/mentors', color: 'from-rose-500/15 to-pink-500/5 border-rose-500/20' },
            { icon: '🎯', label: 'Competitive Exams', desc: 'KCET, JEE, NEET, CUET & more', to: '/competitive-exams', color: 'from-cyan-500/15 to-blue-500/5 border-cyan-500/20' },
            { icon: '💬', label: 'AI Chatbot', desc: 'Ask the Career Engine anything 24/7', to: '/chat', color: 'from-teal-500/15 to-emerald-500/5 border-teal-500/20' },
            { icon: '🗣️', label: 'Community Q&A', desc: 'Ask questions and view senior answers', to: '/qa', color: 'from-pink-500/15 to-rose-500/5 border-pink-500/20' },
          ]
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
              {tiles.map(tile => (
                <Link key={tile.to + tile.label} to={tile.to}
                  className={`bg-gradient-to-br ${tile.color} border rounded-2xl p-5 hover:scale-[1.02] hover:shadow-lg transition-all duration-200 group flex flex-col justify-between`}>
                  <div>
                    <div className="text-3xl mb-3">{tile.icon}</div>
                    <p className="text-white font-bold text-sm leading-tight">{tile.label}</p>
                    <p className="text-gray-400 text-xs mt-1.5 leading-relaxed group-hover:text-gray-300 transition-colors">{tile.desc}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-end">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-saffron opacity-0 group-hover:opacity-100 transition-opacity">Explore →</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        })()}

        {/* ── Dynamic Tab Selector ── */}
        <div className="flex border-b border-white/10 mb-8 overflow-x-auto overflow-y-hidden pb-px gap-2">
          {[
            { id: 'guidance', label: 'Guidance Hub', icon: '🧭' },
            { id: 'tracker', label: 'Goal Tracker', icon: '🎯', badge: tasksList.length > 0 ? `${completedCount}/${tasksList.length}` : null },
            { id: 'wallet', label: 'Academic Wallet', icon: '💼', badge: wallet.length > 0 ? wallet.length : null },
            { id: 'parent', label: 'Parent Mode', icon: '🛡️' },
            { id: 'history', label: 'History Archive', icon: '⏳', badge: profile.history?.length > 0 ? profile.history.length : null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 outline-none
                ${activeTab === tab.id
                  ? 'border-saffron text-saffron bg-saffron/5'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="ml-1 text-[10px] bg-navy-700 border border-white/10 px-2 py-0.5 rounded-full text-gray-300 font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}

        {/* ── 1. Guidance Hub Tab ── */}
        {activeTab === 'guidance' && (
          <div className="space-y-6 animate-fade-in">
            {guidance ? (
              <>
                <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10 relative">
                  <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>🧭</span> Career Guidance Overview
                  </h2>
                  <p className="text-gray-300 text-base leading-relaxed border-l-3 border-saffron pl-4">
                    {guidance.summary}
                  </p>

                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                    {(guidance.options || []).map((opt, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 hover:border-white/20 transition-all rounded-xl p-5">
                        <div className="text-[10px] text-saffron font-bold uppercase tracking-wider mb-1">Option {i + 1}</div>
                        <h3 className="font-semibold text-white text-base mb-2 line-clamp-1">{opt.path}</h3>
                        <p className="text-gray-400 text-xs leading-relaxed line-clamp-3 mb-4">{opt.honest_take}</p>
                        <Link
                          to={profile?.class_level === 'class10' ? '/class10/roadmap' : '/class12/roadmap'}
                          state={{ option: opt, formData: profile }}
                          className="text-xs text-saffron font-semibold hover:underline flex items-center gap-1"
                        >
                          <span>Explore Roadmap</span>
                          <span>→</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Matched Mentor Section */}
                {matchedMentor && (
                  <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center gap-6">
                    {/* Mentor Photo */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-saffron/30 to-saffron/10 border border-saffron/35 flex items-center justify-center text-2xl flex-shrink-0">
                      👤
                    </div>
                    <div className="flex-1 text-center sm:text-left">
                      <span className="text-[10px] text-saffron font-bold uppercase tracking-wider bg-saffron/10 border border-saffron/20 px-2 py-0.5 rounded">
                        Matched Mentor
                      </span>
                      <h3 className="font-display font-bold text-lg text-white mt-1.5">{matchedMentor.name}</h3>
                      <p className="text-gray-400 text-xs mt-0.5">{matchedMentor.headline} · {matchedMentor.experience_years} yrs exp</p>
                      <p className="text-gray-300 text-sm mt-2 max-w-xl leading-relaxed">{matchedMentor.bio}</p>
                    </div>
                    <Link
                      to="/mentors"
                      className="btn-primary py-2.5 px-5 text-xs font-semibold shrink-0"
                    >
                      Book Mentor
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="glass-card p-12 text-center rounded-2xl border border-white/10">
                <div className="text-5xl mb-4">🧭</div>
                <h3 className="font-display font-bold text-xl text-white mb-2">No Active Guidance Found</h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto mb-6">
                  You haven't generated a career guide report yet. Take our honest 3-minute quiz now.
                </p>
                <Link
                  to={profile?.class_level === 'class10' ? '/class10/onboarding' : '/class12/onboarding'}
                  className="btn-primary py-3 px-8 text-sm inline-flex items-center gap-2"
                >
                  <span>Start quiz</span>
                  <span>🚀</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── 2. Goal Tracker Tab ── */}
        {activeTab === 'tracker' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                    <span>🎯</span> Action Plan & Milestones
                  </h2>
                  <p className="text-gray-400 text-xs mt-1">Converts your active career advice and roadmaps into task checklists.</p>
                </div>
                
                {/* Progress Indicator */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-white text-sm font-bold block">{completedCount} of {tasksList.length} done</span>
                    <span className="text-gray-500 text-[10px] uppercase font-bold">Progress</span>
                  </div>
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    {/* SVG circular progress */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="24" cy="24" r="20" className="stroke-navy-800 fill-none" strokeWidth="4" />
                      <circle cx="24" cy="24" r="20" className="stroke-saffron fill-none transition-all duration-500" strokeWidth="4"
                        strokeDasharray="125.6"
                        strokeDashoffset={125.6 - (125.6 * trackerPercentage) / 100}
                      />
                    </svg>
                    <span className="absolute text-[10px] text-white font-extrabold">{trackerPercentage}%</span>
                  </div>
                </div>
              </div>

              {tasksList.length > 0 ? (
                <div className="divide-y divide-white/5 space-y-4">
                  {tasksList.map((task) => (
                    <div key={task.id} className="flex items-start gap-4 pt-4 first:pt-0 group">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mt-0.5 transition-all
                          ${completedTasks[task.id]
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-white/20 hover:border-saffron bg-navy-800'
                          }`}
                      >
                        {completedTasks[task.id] && (
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400`}>
                          {task.category}
                        </span>
                        <p className={`text-sm text-gray-200 mt-1.5 leading-relaxed transition-all
                          ${completedTasks[task.id] ? 'line-through text-gray-500' : ''}`}>
                          {task.task}
                        </p>
                      </div>

                      <span className="text-[10px] font-bold text-gray-500 bg-navy-800/60 border border-white/5 px-2 py-1 rounded-md shrink-0">
                        ⏱️ {task.timeframe}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <span className="text-4xl block mb-2">🎯</span>
                  <p className="text-gray-400 text-sm">No goals or tasks loaded yet. Complete the Quiz & activate a Roadmap first.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 3. Academic Wallet Tab ── */}
        {activeTab === 'wallet' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                    <span>💼</span> Academic Wallet
                  </h2>
                  <p className="text-gray-400 text-xs mt-1">A secure log of your credentials, projects, and activities without storing sensitive IDs.</p>
                </div>
                <button
                  onClick={() => handleOpenWalletModal()}
                  className="btn-primary text-xs py-2.5 px-4 font-semibold inline-flex items-center gap-1.5"
                >
                  <span>＋</span>
                  <span>Add Entry</span>
                </button>
              </div>

              {wallet.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {wallet.map((w) => {
                    const tagColors = {
                      skill: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
                      certification: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
                      project: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
                      internship: 'bg-saffron/10 border-saffron/20 text-saffron'
                    }
                    const badgeIcon = {
                      skill: '🛠️',
                      certification: '📜',
                      project: '💻',
                      internship: '🏢'
                    }

                    return (
                      <div key={w.id} className="bg-white/5 border border-white/8 hover:border-white/15 rounded-xl p-5 relative flex flex-col justify-between group">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full border ${tagColors[w.type] || 'bg-white/10 border-white/20'}`}>
                              <span>{badgeIcon[w.type]}</span>
                              <span>{w.type}</span>
                            </span>
                            {w.date && <span className="text-[10px] text-gray-500 font-medium">{w.date}</span>}
                          </div>

                          <h3 className="font-bold text-white text-base mt-3 leading-snug">{w.title}</h3>
                          <p className="text-gray-300 text-xs leading-relaxed mt-2">{w.description}</p>
                          
                          {w.tags && w.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-4">
                              {w.tags.map((tag, tIdx) => (
                                <span key={tIdx} className="text-[9px] font-semibold bg-navy-800 border border-white/5 px-2 py-0.5 rounded-md text-gray-400">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-3 border-t border-white/5 pt-3.5 mt-4 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenWalletModal(w)}
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteWalletEntry(w.id)}
                            className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-white/4 border border-dashed border-white/10 rounded-2xl">
                  <span className="text-4xl block mb-2">💼</span>
                  <p className="text-gray-400 text-sm mb-4">No activities logged yet.</p>
                  <button
                    onClick={() => handleOpenWalletModal()}
                    className="btn-outline text-xs py-2.5 px-5"
                  >
                    Log your first skill or project
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 4. Parent Mode Tab ── */}
        {activeTab === 'parent' && (
          <div className="space-y-6 animate-fade-in">
            {guidance ? (
              <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-white/10">
                  <div>
                    <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                      <span>🛡️</span> Parent Presentation Mode
                    </h2>
                    <p className="text-gray-400 text-xs mt-1">A transparent, read-only dashboard layout designed with parents in mind.</p>
                  </div>
                  <button
                    onClick={() => window.print()}
                    className="btn-outline text-xs py-2 px-4 flex items-center gap-1 hover:bg-white/5"
                  >
                    <span>🖨️</span> Print / Save Report
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Executive Summary */}
                  <div className="bg-white/4 border border-white/8 rounded-xl p-5">
                    <p className="text-saffron text-[10px] font-bold uppercase tracking-widest mb-1.5">Executive Summary for Parents</p>
                    <h3 className="font-display font-bold text-white text-lg mb-3">Understanding the Recommendations</h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      We analyzed your child's inputs (Subject interests: <strong className="text-white">"{profile.interests}"</strong>, Board: <strong className="text-white">{profile.board}</strong>, Marks: <strong className="text-white">{profile.marks}%</strong>) to identify the most viable pathways. Here is a summary of the best options tailored to their profile.
                    </p>
                  </div>

                  {/* Options Cards */}
                  <div className="space-y-4">
                    {(guidance.options || []).map((opt, idx) => (
                      <div key={idx} className="bg-navy-800 border border-white/10 rounded-xl p-5 grid sm:grid-cols-3 gap-5">
                        <div className="sm:col-span-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-5 h-5 rounded-full bg-saffron flex items-center justify-center text-xs font-bold text-white">
                              {idx + 1}
                            </span>
                            <h4 className="font-bold text-white text-base leading-tight">{opt.path}</h4>
                          </div>
                          <p className="text-gray-400 text-xs leading-relaxed mt-2">{opt.honest_take}</p>
                          
                          {/* Backup Plan */}
                          {opt.backup_plan && (
                            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-xs text-emerald-300">
                              <strong className="text-white block mb-0.5">🛡️ Safety Net / Backup Plan</strong>
                              {opt.backup_plan}
                            </div>
                          )}
                        </div>

                        <div className="bg-white/4 border border-white/10 rounded-lg p-4 flex flex-col justify-between shrink-0">
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Estimated Cost</span>
                            <span className="text-white font-display font-black text-xl block mt-1">{opt.avg_yearly_cost}</span>
                            <span className="text-[9px] text-gray-500">Includes tuition, hostel, misc</span>
                          </div>

                          <div className="mt-3">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block">Target Outcomes</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(opt.opens_doors_to || []).slice(0, 3).map((d, i) => (
                                <span key={i} className="text-[9px] bg-navy-950 border border-white/5 text-gray-300 px-1.5 py-0.5 rounded">
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-10 text-center rounded-2xl border border-white/10">
                <p className="text-gray-400 text-sm">Please generate your guidance report first.</p>
              </div>
            )}
          </div>
        )}

        {/* ── 5. History Archive Tab ── */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6 sm:p-8 rounded-2xl border border-white/10">
              <h2 className="font-display text-xl font-bold text-white mb-2 flex items-center gap-2">
                <span>⏳</span> History Archive
              </h2>
              <p className="text-gray-400 text-xs mb-6">Review snapshots of your previous guide configurations and marks updates.</p>

              {profile.history && profile.history.length > 0 ? (
                <div className="space-y-4">
                  {profile.history.map((snapshot, idx) => {
                    const snapDate = new Date(snapshot.timestamp).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })

                    return (
                      <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/5">
                          <div>
                            <span className="text-xs text-saffron font-bold">{snapDate}</span>
                            <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400">
                              Marks: {snapshot.profile.marks}% ({snapshot.profile.classLevel === 'class10' ? 'Class 10' : 'Class 12'})
                            </span>
                          </div>
                          
                          <button
                            onClick={() => handleRestoreHistory(snapshot)}
                            disabled={reOnboarding}
                            className="text-xs btn-outline py-1 px-3 text-saffron hover:bg-saffron/15 transition-all"
                          >
                            Restore Snapshot
                          </button>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 mt-3">
                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Interests back then</span>
                            <p className="text-xs text-gray-300 mt-1 line-clamp-2">"{snapshot.profile.interests}"</p>
                          </div>

                          <div>
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Top Recommended Option</span>
                            <p className="text-xs text-white font-semibold mt-1">
                              {snapshot.guidance?.options?.[0]?.path || 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-10 bg-white/4 border border-dashed border-white/10 rounded-2xl">
                  <span className="text-4xl block mb-2">⏳</span>
                  <p className="text-gray-400 text-sm">No historical runs saved yet. Re-running onboarding stores snapshots here.</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── ACADEMIC WALLET MODAL ── */}
      {walletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-navy-900 border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <h3 className="font-display font-bold text-xl text-white mb-4">
              {walletEditingEntry ? 'Edit Academic Activity' : 'Add Academic Activity'}
            </h3>

            <form onSubmit={handleSaveWalletEntry} className="space-y-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1">Type</label>
                <select
                  value={walletForm.type}
                  onChange={(e) => setWalletForm({ ...walletForm, type: e.target.value })}
                  className="w-full bg-navy-800 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-saffron text-sm"
                >
                  <option value="skill">🛠️ Skill / Competency</option>
                  <option value="certification">📜 Certification</option>
                  <option value="project">💻 Independent Project</option>
                  <option value="internship">🏢 Internship / Work Experience</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Responsive Web Design, Django API Development"
                  value={walletForm.title}
                  onChange={(e) => setWalletForm({ ...walletForm, title: e.target.value })}
                  className="w-full bg-navy-800 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-saffron text-sm"
                  required
                />
              </div>

              <div>
                <label className="text-gray-400 text-xs font-semibold block mb-1">Description</label>
                <textarea
                  rows="3"
                  placeholder="Summarise what you learned, built, or accomplished..."
                  value={walletForm.description}
                  onChange={(e) => setWalletForm({ ...walletForm, description: e.target.value })}
                  className="w-full bg-navy-800 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-saffron text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold block mb-1">Completion Date (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. June 2026, Ongoing"
                    value={walletForm.date}
                    onChange={(e) => setWalletForm({ ...walletForm, date: e.target.value })}
                    className="w-full bg-navy-800 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-saffron text-sm"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs font-semibold block mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Python, CSS, Excel"
                    value={walletForm.tags}
                    onChange={(e) => setWalletForm({ ...walletForm, tags: e.target.value })}
                    className="w-full bg-navy-800 border border-white/15 rounded-xl px-4 py-2.5 text-white outline-none focus:border-saffron text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="btn-outline text-xs py-2.5 px-4"
                  disabled={walletSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2.5 px-6 font-semibold"
                  disabled={walletSaving}
                >
                  {walletSaving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Save Activity'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
