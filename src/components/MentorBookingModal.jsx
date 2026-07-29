import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { postMentorBook } from '../api'

const CLASS_LEVELS = ['10th', '12th', 'College']
const LANGUAGES = ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Marathi', 'Bengali', 'Other']

// "Book Mentor" request form (replaces the old Cal.com "Book Call" redirect).
// All sessions are conducted online, so there is no mode selection.
export default function MentorBookingModal({ mentor, onClose }) {
  const { session } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    classLevel: '',
    areaOfInterest: '',
    preferredLanguage: '',
    preferredDate: '',
    preferredTime: '',
    guidanceQuery: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  // Local YYYY-MM-DD for the date input's min attribute (avoids past dates).
  const todayStr = new Date().toISOString().slice(0, 10)

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const validate = () => {
    const next = {}
    if (!form.name.trim()) next.name = 'Please enter your name.'
    if (!form.email.trim()) next.email = 'Please enter your email.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) next.email = 'Please enter a valid email.'
    if (!form.classLevel) next.classLevel = 'Please select your current class.'
    if (!form.areaOfInterest.trim()) next.areaOfInterest = 'Please enter your area of interest.'
    if (!form.preferredLanguage) next.preferredLanguage = 'Please select a preferred language.'
    if (!form.preferredDate) next.preferredDate = 'Please pick a preferred date.'
    if (!form.preferredTime) next.preferredTime = 'Please pick a preferred time.'
    if (form.preferredDate && form.preferredTime) {
      const picked = new Date(`${form.preferredDate}T${form.preferredTime}`)
      if (Number.isNaN(picked.getTime())) {
        next.preferredDate = 'Please pick a valid date and time.'
      } else if (picked.getTime() < Date.now()) {
        next.preferredDate = 'Please pick a date and time in the future.'
      }
    }
    if (!form.guidanceQuery.trim()) next.guidanceQuery = 'Please tell us what guidance you need.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      // Combine the separate date + time inputs into a single ISO timestamp
      // for the backend (avoids the flaky native datetime-local widget).
      const preferredDateTime = new Date(`${form.preferredDate}T${form.preferredTime}`).toISOString()
      const res = await postMentorBook(
        {
          mentorId: mentor.id,
          contactName: form.name,
          contactEmail: form.email,
          contactPhone: form.phone,
          classLevel: form.classLevel,
          areaOfInterest: form.areaOfInterest,
          preferredLanguage: form.preferredLanguage,
          preferredDateTime,
          guidanceQuery: form.guidanceQuery,
        },
        session?.access_token
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to submit booking request.')
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
                📅
              </div>
              <h2 className="font-display text-2xl font-bold text-white">Book Mentor</h2>
              <p className="text-gray-400 text-sm mt-1">
                Request an online session with {mentor?.name || 'this mentor'}.
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
                <label className="block text-xs font-semibold text-gray-300 mb-1">Phone Number (optional)</label>
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="e.g. 9876543210" className={inputClass('phone')} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Current Class *</label>
                <select value={form.classLevel} onChange={set('classLevel')} className={inputClass('classLevel')}>
                  <option value="">Select class</option>
                  {CLASS_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.classLevel && <p className="text-[10px] text-rose-400 mt-1">{errors.classLevel}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Area of Interest / Career Domain *</label>
                <input type="text" value={form.areaOfInterest} onChange={set('areaOfInterest')} placeholder="e.g. Engineering, Medicine, Design" className={inputClass('areaOfInterest')} />
                {errors.areaOfInterest && <p className="text-[10px] text-rose-400 mt-1">{errors.areaOfInterest}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Preferred Language *</label>
                <select value={form.preferredLanguage} onChange={set('preferredLanguage')} className={inputClass('preferredLanguage')}>
                  <option value="">Select language</option>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
                {errors.preferredLanguage && <p className="text-[10px] text-rose-400 mt-1">{errors.preferredLanguage}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Preferred Date & Time *</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={form.preferredDate}
                  min={todayStr}
                  onChange={set('preferredDate')}
                  className={inputClass('preferredDate')}
                />
                <input
                  type="time"
                  value={form.preferredTime}
                  onChange={set('preferredTime')}
                  className={inputClass('preferredTime')}
                />
              </div>
              {(errors.preferredDate || errors.preferredTime) && (
                <p className="text-[10px] text-rose-400 mt-1">{errors.preferredDate || errors.preferredTime}</p>
              )}
              <p className="text-gray-600 text-[10px] mt-1">All mentor sessions are conducted online.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">What guidance are you looking for? *</label>
              <textarea
                rows="3"
                value={form.guidanceQuery}
                onChange={set('guidanceQuery')}
                placeholder="e.g. I'm confused between engineering and medicine, need help deciding."
                className={`${inputClass('guidanceQuery')} resize-none`}
              />
              {errors.guidanceQuery && <p className="text-[10px] text-rose-400 mt-1">{errors.guidanceQuery}</p>}
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
                {submitting ? 'Submitting...' : 'Book Mentor →'}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
            <h2 className="font-display text-2xl font-bold text-white mb-2">Booking Requested!</h2>
            <p className="text-gray-300 text-sm leading-relaxed max-w-sm mx-auto mb-6">
              Your mentor session has been booked successfully. Further details will be shared with your registered email.
            </p>
            <button onClick={onClose} className="btn-primary px-8 py-3 text-sm">Close Window</button>
          </div>
        )}
      </div>
    </div>
  )
}
