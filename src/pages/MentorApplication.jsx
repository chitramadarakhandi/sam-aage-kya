import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { postMentorApply } from '../api'

const STREAM_OPTIONS = ['Science (PCM)', 'Science (PCB)', 'Commerce', 'Arts / Humanities', 'Any Stream']

export default function MentorApplication() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '', email: '', profession: '', college: '', degree: '',
    streamExpertise: '', yearsExp: '', bio: '', linkedIn: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.name || !form.email || !form.profession || !form.bio || !form.linkedIn) {
      setError('Please fill all required fields.')
      return
    }
    setLoading(true); setError('')
    try {
      const res = await postMentorApply({
        name: form.name,
        email: form.email,
        profession: form.profession,
        college: form.college,
        degree: form.degree,
        streamExpertise: form.streamExpertise,
        yearsExp: form.yearsExp,
        story: form.bio,
        linkedIn: form.linkedIn,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Submission failed. Please try again.')
      }
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.')
    } finally { setLoading(false) }
  }

  const inputCls = 'w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/20'

  if (success) return (
    <main className="min-h-screen pt-28 pb-16 px-4 flex items-center justify-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
        <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-5xl mx-auto mb-6">🌟</div>
        <h1 className="font-display text-3xl font-black text-white mb-3">Application Submitted!</h1>
        <p className="text-gray-400 mb-6">Your mentor application is under review. We'll notify you at <strong className="text-white">{form.email}</strong> within 3–5 business days.</p>
        <button onClick={() => navigate('/mentors')} className="btn-primary px-8 py-3">View All Mentors →</button>
      </motion.div>
    </main>
  )

  return (
    <main className="min-h-screen pt-24 pb-20 px-4 sm:px-6 font-sans relative">
      <div className="fixed inset-0 bg-mesh-premium pointer-events-none" />
      <div className="max-w-2xl mx-auto relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-5 py-2 mb-5">
            <span className="text-lg">🌟</span>
            <span className="text-saffron text-sm font-semibold">Become a Mentor</span>
          </div>
          <h1 className="font-display text-4xl font-black text-white mb-3">Mentor Application</h1>
          <p className="text-gray-400">Share your journey. Guide the next generation. It only takes 20 minutes a week.</p>
        </motion.div>

        <div className="glass-card-premium p-8">
          {error && <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-rose-300 text-sm mb-5">⚠️ {error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Full Name *</label>
                <input value={form.name} onChange={set('name')} placeholder="e.g. Priya Sharma" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email *</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Current Profession / Role *</label>
              <input value={form.profession} onChange={set('profession')} placeholder="e.g. Senior Software Engineer at Google" className={inputCls} />
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">College / University</label>
                <input value={form.college} onChange={set('college')} placeholder="e.g. RVCE, Bangalore" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Degree</label>
                <input value={form.degree} onChange={set('degree')} placeholder="e.g. B.Tech CSE" className={inputCls} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Stream Expertise</label>
                <select value={form.streamExpertise} onChange={set('streamExpertise')} className={inputCls}>
                  <option value="">Select stream</option>
                  {STREAM_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="Class 10 / Stream Selection">Class 10 / Stream Selection</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Years of Experience</label>
                <input type="number" min="0" max="40" value={form.yearsExp} onChange={set('yearsExp')} placeholder="e.g. 5" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Your Story / Why Mentor? *</label>
              <textarea rows={4} value={form.bio} onChange={set('bio')} placeholder="Share your journey, what you wish you knew, and why you want to guide students..." className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">LinkedIn Profile URL *</label>
              <input value={form.linkedIn} onChange={set('linkedIn')} placeholder="https://linkedin.com/in/yourname" className={inputCls} />
              <p className="text-gray-600 text-xs mt-1">Used to verify your identity and background during review.</p>
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-4 text-base font-bold disabled:opacity-60">
              {loading ? 'Submitting...' : 'Submit Application →'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
