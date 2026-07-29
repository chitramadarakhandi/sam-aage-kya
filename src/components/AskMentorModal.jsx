import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postMentorAsk } from '../api'

const CATEGORIES = [
  'Career Guidance',
  'Stream / Subject Choice',
  'College Admissions',
  'Exam Preparation',
  'Study Abroad',
  'Scholarships',
  'Project / Skills Help',
  'Other',
]

// "Ask Mentor" async messaging modal (replaces the old real-time "Chat Now").
// A student sends a question; the mentor replies later from their dashboard.
export default function AskMentorModal({ mentor, onClose }) {
  const { session } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    question: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!form.email.trim()) next.email = 'Please enter your email.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) next.email = 'Please enter a valid email.'
    if (!form.subject.trim()) next.subject = 'Please enter a subject.'
    if (!form.category) next.category = 'Please select a category.'
    if (!form.question.trim()) next.question = 'Please type your question.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await postMentorAsk(
        {
          mentorId: mentor.id,
          contactName: form.name,
          contactEmail: form.email,
          subject: form.subject,
          category: form.category,
          question: form.question,
        },
        session?.access_token
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to send your question.')
      }
      setIsSubmitted(true)
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = (field) =>
    `w-full bg-navy-800 border rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm transition-all duration-200 outline-none focus:ring-2 focus:ring-saffron/40 ${
      errors[field] ? 'border-rose-500/50 focus:border-rose-500' : 'border-white/10 hover:border-white/20 focus:border-saffron/60'
    }`

  return (
    <div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-lg p-6 sm:p-8 border-saffron/30 relative animate-slide-up shadow-2xl overflow-y-auto max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-2xl"
          aria-label="Close"
        >
          &times;
        </button>

        {!isSubmitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-saffron/10 border border-saffron/30 flex items-center justify-center text-2xl mx-auto mb-3">
                💬
              </div>
              <h2 className="font-display text-2xl font-bold text-white">Ask Mentor</h2>
              <p className="text-gray-400 text-sm mt-1">
                Send your question to {mentor?.name || 'this mentor'}. They'll reply and you'll be notified by email.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Full Name *</label>
                <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Rahul Sharma" className={inputClass('name')} />
                {errors.name && <p className="text-[10px] text-rose-400 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address *</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" className={inputClass('email')} />
                {errors.email && <p className="text-[10px] text-rose-400 mt-1">{errors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Subject *</label>
                <input type="text" value={form.subject} onChange={set('subject')} placeholder="e.g. Confused about PCM vs PCB" className={inputClass('subject')} />
                {errors.subject && <p className="text-[10px] text-rose-400 mt-1">{errors.subject}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Category *</label>
                <select value={form.category} onChange={set('category')} className={inputClass('category')}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="text-[10px] text-rose-400 mt-1">{errors.category}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Your Question *</label>
              <textarea
                rows="4"
                value={form.question}
                onChange={set('question')}
                placeholder="Ask anything about their journey, career path, or how they got where they are."
                className={`${inputClass('question')} resize-none`}
              />
              {errors.question && <p className="text-[10px] text-rose-400 mt-1">{errors.question}</p>}
            </div>

            {submitError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-4">⚠️ {submitError}</div>
            )}

            <div className="pt-2">
              <button type="submit" disabled={submitting} className="w-full btn-primary py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && (
                  <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {submitting ? 'Sending...' : 'Send Question →'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Question Sent!</h2>
            <p className="text-gray-300 text-sm leading-relaxed max-w-sm mx-auto mb-6">
              Your question has been sent to {mentor?.name || 'the mentor'}. They'll reply soon and you'll be notified at your registered email. You can track it under "My Mentor Requests".
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/my-mentor-requests" onClick={onClose} className="btn-primary px-6 py-3 text-sm">View My Requests</Link>
              <button onClick={onClose} className="px-6 py-3 text-sm rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
