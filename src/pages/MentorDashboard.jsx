import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { patchMentorReply, getMentorWorkspace, respondMentorBooking } from '../api'

function formatDate(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

const CLASS_LABELS = { '10th': 'Class 10th', '12th': 'Class 12th', Other: 'Other / UG' }

// ─── Demo sandbox banner ───────────────────────────────────────────────────────
// Makes it unmistakable when the dashboard is showing hardcoded sandbox data
// instead of a real mentor's own data — this is NOT your real mentor account.
function DemoSandboxBanner() {
  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 mb-6 flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">🧪</span>
      <div>
        <p className="text-indigo-300 text-sm font-bold">You're viewing the Demo Sandbox.</p>
        <p className="text-gray-400 text-xs mt-0.5">
          This is sample data, not a real mentor account. To see your own student questions and bookings,
          sign out and sign in with your real mentor email and password.
        </p>
      </div>
    </div>
  )
}

// ─── Application status banner ────────────────────────────────────────────────
// Shows a new/returning mentor whether their application was accepted, rejected,
// or is still under review — right inside the dashboard.
function ApplicationBanner({ application, linked }) {
  const status = application?.status

  if (linked && status !== 'rejected') {
    return (
      <div className="glass-card border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 mb-6 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">🎉</span>
        <div>
          <p className="text-emerald-300 text-sm font-bold">You're an approved mentor.</p>
          <p className="text-gray-400 text-xs mt-0.5">Student questions and booking requests sent to you appear below.</p>
        </div>
      </div>
    )
  }

  if (status === 'rejected') {
    return (
      <div className="glass-card border-rose-500/20 bg-rose-500/5 p-4 sm:p-5 mb-6 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">📋</span>
        <div>
          <p className="text-rose-300 text-sm font-bold">Your mentor application wasn't approved.</p>
          {application?.rejection_reason
            ? <p className="text-gray-400 text-xs mt-0.5"><span className="font-semibold text-gray-300">Reason:</span> {application.rejection_reason}</p>
            : <p className="text-gray-400 text-xs mt-0.5">You're welcome to update your details and apply again.</p>}
          <Link to="/mentor-apply" className="inline-block mt-2 text-saffron text-xs font-semibold hover:underline">Update &amp; resubmit application →</Link>
        </div>
      </div>
    )
  }

  if (status === 'pending') {
    return (
      <div className="glass-card border-amber-500/20 bg-amber-500/5 p-4 sm:p-5 mb-6 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">⏳</span>
        <div>
          <p className="text-amber-300 text-sm font-bold">Your mentor application is under review.</p>
          <p className="text-gray-400 text-xs mt-0.5">
            You will be able to access mentoring features once your application has been approved.
            Submitted {formatDate(application?.created_at)}.
          </p>
        </div>
      </div>
    )
  }

  if (status === 'approved' && !linked) {
    return (
      <div className="glass-card border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5 mb-6 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">✅</span>
        <div>
          <p className="text-emerald-300 text-sm font-bold">Your application was approved!</p>
          <p className="text-gray-400 text-xs mt-0.5">
            We're linking your profile to this account. If it doesn't appear shortly, make sure you logged in with the same email you applied with ({application?.email || 'your application email'}).
          </p>
        </div>
      </div>
    )
  }

  return null
}

// ─── A single student query card with an inline answer box ────────────────────
function QueryCard({ msg, draft, onDraftChange, onSend, sending }) {
  const answered = msg.status === 'answered'
  return (
    <div className="glass-card border-white/5 p-5 sm:p-6 space-y-3">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="font-display font-bold text-white text-sm">{msg.subject || 'Question'}</h3>
          <p className="text-gray-400 text-xs mt-0.5">
            {msg.contact_name || 'Student'}
            {msg.class_level ? ` · ${CLASS_LABELS[msg.class_level] || msg.class_level}` : ''}
            {' '}· {msg.contact_email} · {formatDate(msg.created_at)}
          </p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${
          answered ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>{answered ? 'Replied' : 'Pending'}</span>
      </div>

      {msg.category && (
        <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-lg border bg-white/5 border-white/10 text-gray-400">
          {msg.category}
        </span>
      )}

      <div className="text-sm text-gray-200 bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
        <span className="text-gray-500 text-xs font-semibold block mb-1">Student asked:</span>
        {msg.question}
      </div>

      {answered ? (
        <div className="text-sm text-gray-200 bg-emerald-500/5 p-3.5 rounded-xl border border-emerald-500/15">
          <span className="text-emerald-400 text-xs font-semibold block mb-1">
            Your reply{msg.replied_at ? ` · ${formatDate(msg.replied_at)}` : ''}:
          </span>
          {msg.reply}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={draft || ''}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Write your reply to the student..."
            className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/20 resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={onSend}
              disabled={!(draft || '').trim() || sending}
              className="btn-primary py-2 px-6 text-xs disabled:opacity-50 inline-flex items-center gap-2"
            >
              {sending ? 'Sending...' : 'Reply →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── A single booking request card with approve / decline / reschedule ────────
function BookingCard({ booking, draft, onDraftChange, onRespond, busy }) {
  const status = booking.status || 'pending'
  const responded = status !== 'pending'
  const statusStyle =
    status === 'accepted' || status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
    : status === 'declined' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
    : status === 'rescheduled' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
  const statusLabel =
    status === 'accepted' ? 'Approved' : status === 'completed' ? 'Completed'
    : status === 'declined' ? 'Declined' : status === 'rescheduled' ? 'Rescheduled' : 'Pending'

  return (
    <div className="glass-card border-white/5 p-5 sm:p-6 space-y-3">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="font-display font-bold text-white text-sm">{booking.contact_name || 'Student'}</h3>
          <p className="text-gray-400 text-xs mt-0.5">{booking.contact_email}{booking.contact_phone ? ` · ${booking.contact_phone}` : ''}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs bg-white/5 rounded-xl p-3 border border-white/5">
        <div>
          <span className="text-gray-500 block text-[10px]">Class</span>
          <span className="text-white font-medium">{booking.class_level || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Language</span>
          <span className="text-white font-medium">{booking.preferred_language || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Area of Interest</span>
          <span className="text-white font-medium">{booking.area_of_interest || '—'}</span>
        </div>
        <div>
          <span className="text-gray-500 block text-[10px]">Preferred Date/Time</span>
          <span className="text-white font-medium">{booking.session_date ? formatDate(booking.session_date) : 'Flexible'}</span>
        </div>
      </div>

      {booking.guidance_query && (
        <div className="text-xs text-gray-300 bg-white/[0.02] p-3 rounded-xl border border-white/5">
          <span className="text-gray-500 block font-semibold mb-1">Guidance requested:</span>
          {booking.guidance_query}
        </div>
      )}

      {responded ? (
        booking.mentor_response ? (
          <div className={`text-sm text-gray-200 p-3.5 rounded-xl border ${
            status === 'declined' ? 'bg-rose-500/5 border-rose-500/15'
            : status === 'rescheduled' ? 'bg-blue-500/5 border-blue-500/15'
            : 'bg-emerald-500/5 border-emerald-500/15'
          }`}>
            <span className={`text-xs font-semibold block mb-1 ${
              status === 'declined' ? 'text-rose-300' : status === 'rescheduled' ? 'text-blue-300' : 'text-emerald-400'
            }`}>Your message to the student:</span>
            {booking.mentor_response}
          </div>
        ) : (
          <p className="text-gray-500 text-xs italic">You marked this request as {statusLabel.toLowerCase()}.</p>
        )
      ) : (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={draft || ''}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Add a message — e.g. 'Available Sat 5pm' or 'I am unavailable, free tomorrow between 5-6 PM.'"
            className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/20 resize-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onRespond('accepted')}
              disabled={busy}
              className="flex-1 btn-primary py-2 text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white disabled:opacity-50 min-w-[100px]"
            >
              {busy ? 'Saving...' : '✅ Approve'}
            </button>
            <button
              onClick={() => onRespond('rescheduled')}
              disabled={busy}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 text-blue-300 transition-all disabled:opacity-50 min-w-[130px]"
            >
              {busy ? 'Saving...' : '🕒 Suggest Another Time'}
            </button>
            <button
              onClick={() => onRespond('declined')}
              disabled={busy}
              className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-300 transition-all disabled:opacity-50 min-w-[100px]"
            >
              {busy ? 'Saving...' : '🚫 Decline'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MentorDashboard() {
  const { user, session, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const isDemoSandbox = session?.access_token === 'demo-mentor-token'

  const [mentorProfile, setMentorProfile] = useState(null)
  const [application, setApplication] = useState(null)
  const [messages, setMessages] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('queries') // queries | requests | accepted | completed | settings

  const [replyDrafts, setReplyDrafts] = useState({})
  const [replyingId, setReplyingId] = useState(null)

  const [bookingDrafts, setBookingDrafts] = useState({})
  const [bookingBusyId, setBookingBusyId] = useState(null)

  // Profile settings form
  const [settingsForm, setSettingsForm] = useState({ story: '', linkedin: '', available: true })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Guard: must be signed in. We deliberately do NOT bounce non-mentor
  // `profile.role` values away here — a real mentor's students.role often
  // still reads 'student' on first login and only flips to 'mentor' once
  // getMentorWorkspace() below links their account to an approved mentor
  // profile by email. Kicking them out based on the stale local role was
  // sending real mentors back to "/" and making it look like login failed.
  // Anyone with no mentor application at all still just sees the
  // "Apply to Mentor" screen further down, so this stays safe for students.
  useEffect(() => {
    if (!authLoading && !user) navigate('/')
  }, [user, authLoading, navigate])

  // Load application status + linked profile + received student questions/bookings.
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await getMentorWorkspace(session?.access_token)
      if (res.ok) {
        const { application: app, mentor: mp, messages: msgs, bookings: bks } = await res.json()
        setApplication(app || null)
        setMentorProfile(mp || null)
        setMessages(msgs || [])
        setBookings(bks || [])
        if (mp) {
          setSettingsForm({ story: mp.story || '', linkedin: mp.linkedin || '', available: mp.available !== false })
        }
      } else {
        setApplication(null); setMentorProfile(null); setMessages([]); setBookings([])
      }
    } catch {
      setApplication(null); setMentorProfile(null); setMessages([]); setBookings([])
    }
    setLoading(false)
  }, [user, session])

  useEffect(() => { loadData() }, [loadData])

  // Reply to a student question.
  const handleSend = async (messageId) => {
    const reply = (replyDrafts[messageId] || '').trim()
    if (!reply) return
    setReplyingId(messageId)
    try {
      const res = await patchMentorReply(messageId, reply, session?.access_token)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to send your reply.')
      }
      const { message } = await res.json().catch(() => ({}))
      setMessages((prev) => prev.map((m) => (m.id === messageId
        ? { ...m, reply, status: 'answered', replied_at: message?.replied_at || new Date().toISOString() }
        : m)))
      setReplyDrafts((prev) => ({ ...prev, [messageId]: '' }))
    } catch (err) {
      alert(err.message || 'Failed to send your reply.')
    } finally {
      setReplyingId(null)
    }
  }

  // Approve / decline / reschedule a booking request with a message.
  const handleBooking = async (bookingId, status) => {
    const message = (bookingDrafts[bookingId] || '').trim()
    if ((status === 'declined' || status === 'rescheduled') && !message) {
      alert('Please add a short message (e.g. a time you are available) before continuing.')
      return
    }
    setBookingBusyId(bookingId)
    try {
      const res = await respondMentorBooking(bookingId, status, message, session?.access_token)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to update the booking.')
      }
      setBookings((prev) => prev.map((b) => (b.id === bookingId
        ? { ...b, status, mentor_response: message }
        : b)))
      setBookingDrafts((prev) => ({ ...prev, [bookingId]: '' }))
    } catch (err) {
      alert(err.message || 'Failed to update the booking.')
    } finally {
      setBookingBusyId(null)
    }
  }

  // Mark an accepted session as completed.
  const handleComplete = async (bookingId) => {
    setBookingBusyId(bookingId)
    try {
      const res = await respondMentorBooking(bookingId, 'completed', bookingDrafts[bookingId] || '', session?.access_token)
      if (!res.ok) throw new Error('Failed to mark as completed.')
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'completed' } : b)))
    } catch (err) {
      alert(err.message || 'Failed to mark as completed.')
    } finally {
      setBookingBusyId(null)
    }
  }

  // Profile settings — direct Supabase update (RLS: mentors_self_write allows this).
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    if (!mentorProfile) return
    setSavingSettings(true)
    setSettingsSaved(false)
    try {
      const { error } = await supabase
        .from('mentors')
        .update({ story: settingsForm.story, linkedin: settingsForm.linkedin, available: settingsForm.available })
        .eq('id', mentorProfile.id)
      if (error) throw error
      setMentorProfile((prev) => ({ ...prev, ...settingsForm }))
      setSettingsSaved(true)
    } catch (err) {
      alert(err.message || 'Failed to save profile settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  if (authLoading || loading) return (
    <main className="pt-24 pb-16 min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </main>
  )

  // Not linked to an approved mentor profile yet — show status / next steps only.
  if (!mentorProfile) return (
    <main className="pt-24 pb-16 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">Mentor Dashboard</h1>
          <p className="text-gray-400 text-sm">Your application status and updates.</p>
        </div>

        <ApplicationBanner application={application} linked={false} />

        {!application && (
          <div className="glass-card border-white/10 p-10 text-center">
            <div className="text-4xl mb-4">🧭</div>
            <h2 className="font-display text-xl font-bold text-white mb-2">Become a mentor</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-md mx-auto">
              We couldn't find a mentor application for this email. Apply to start guiding students — once an admin approves you, student queries and bookings appear right here.
            </p>
            <Link to="/mentor-apply" className="btn-primary px-8 py-3 text-sm inline-flex items-center gap-2">
              Apply to Mentor →
            </Link>
          </div>
        )}
      </div>
    </main>
  )

  const pendingQueries = messages.filter((m) => m.status !== 'answered')
  const answeredQueries = messages.filter((m) => m.status === 'answered')

  const requestBookings = bookings.filter((b) => (b.status || 'pending') === 'pending')
  const acceptedBookings = bookings.filter((b) => b.status === 'accepted')
  const completedBookings = bookings.filter((b) => b.status === 'completed')

  const TABS = [
    { id: 'queries',  label: `💬 Student Queries (${pendingQueries.length})` },
    { id: 'requests', label: `📥 Booking Requests (${requestBookings.length})` },
    { id: 'accepted', label: `✅ Accepted Sessions (${acceptedBookings.length})` },
    { id: 'completed', label: `🏁 Completed Sessions (${completedBookings.length})` },
    { id: 'settings', label: '⚙️ Profile Settings' },
  ]

  return (
    <main className="pt-24 pb-16 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">

        {isDemoSandbox && <DemoSandboxBanner />}

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-14 h-14 rounded-2xl ${mentorProfile.initials_bg || 'bg-saffron/20 text-saffron'} flex items-center justify-center font-display font-bold text-lg flex-shrink-0`}>
            {mentorProfile.initials || 'M'}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-white truncate">{mentorProfile.name}</h1>
            <p className="text-gray-400 text-sm truncate">{mentorProfile.degree} · {mentorProfile.college}</p>
          </div>
        </div>

        {/* Approval / status banner */}
        {!isDemoSandbox && <ApplicationBanner application={application} linked={true} />}

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                activeTab === t.id
                  ? 'bg-saffron text-white border-saffron shadow-lg shadow-saffron/20'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Student Queries ── */}
        {activeTab === 'queries' && (
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="glass-card border-white/5 p-12 text-center">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-gray-300 text-sm mb-1">No student questions yet.</p>
                <p className="text-gray-500 text-xs">When a student sends you a question, it shows up here for you to answer.</p>
              </div>
            ) : (
              [...pendingQueries, ...answeredQueries].map((m) => (
                <QueryCard
                  key={m.id}
                  msg={m}
                  draft={replyDrafts[m.id]}
                  onDraftChange={(val) => setReplyDrafts((prev) => ({ ...prev, [m.id]: val }))}
                  onSend={() => handleSend(m.id)}
                  sending={replyingId === m.id}
                />
              ))
            )}
          </div>
        )}

        {/* ── Booking Requests (pending only) ── */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {requestBookings.length === 0 ? (
              <div className="glass-card border-white/5 p-12 text-center">
                <div className="text-4xl mb-3">📥</div>
                <p className="text-gray-300 text-sm mb-1">No new booking requests.</p>
                <p className="text-gray-500 text-xs">When a student books a session with you, it appears here to approve, decline, or reschedule.</p>
              </div>
            ) : (
              requestBookings.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  draft={bookingDrafts[b.id]}
                  onDraftChange={(val) => setBookingDrafts((prev) => ({ ...prev, [b.id]: val }))}
                  onRespond={(status) => handleBooking(b.id, status)}
                  busy={bookingBusyId === b.id}
                />
              ))
            )}
          </div>
        )}

        {/* ── Accepted Sessions ── */}
        {activeTab === 'accepted' && (
          <div className="space-y-4">
            {acceptedBookings.length === 0 ? (
              <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                No accepted sessions yet.
              </div>
            ) : (
              acceptedBookings.map((b) => (
                <div key={b.id} className="glass-card border-white/5 p-5 sm:p-6 space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h4 className="font-display text-sm font-bold text-white">{b.contact_name || 'Student'}</h4>
                      <p className="text-gray-400 text-xs">{b.contact_email}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Approved</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs bg-white/5 rounded-xl p-3 border border-white/5">
                    <div><span className="text-gray-500 block text-[10px]">Class</span><span className="text-white font-medium">{b.class_level || '—'}</span></div>
                    <div><span className="text-gray-500 block text-[10px]">Interest</span><span className="text-white font-medium">{b.area_of_interest || '—'}</span></div>
                  </div>
                  {b.mentor_response && (
                    <div className="text-sm text-gray-200 bg-emerald-500/5 p-3.5 rounded-xl border border-emerald-500/15">
                      <span className="text-emerald-400 text-xs font-semibold block mb-1">Your message:</span>
                      {b.mentor_response}
                    </div>
                  )}
                  <button
                    onClick={() => handleComplete(b.id)}
                    disabled={bookingBusyId === b.id}
                    className="w-full btn-primary py-2 text-xs disabled:opacity-50"
                  >
                    {bookingBusyId === b.id ? 'Saving...' : '🏁 Mark as Completed'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Completed Sessions ── */}
        {activeTab === 'completed' && (
          <div className="space-y-4">
            {completedBookings.length === 0 ? (
              <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                No completed sessions yet.
              </div>
            ) : (
              completedBookings.map((b) => (
                <div key={b.id} className="glass-card border-white/5 p-5 sm:p-6 space-y-2">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h4 className="font-display text-sm font-bold text-white">{b.contact_name || 'Student'}</h4>
                      <p className="text-gray-400 text-xs">{b.contact_email} · {formatDate(b.created_at)}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">Completed</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Profile Settings ── */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="glass-card border-white/5 p-6 sm:p-8 max-w-xl space-y-5">
            <h3 className="font-display text-lg font-bold text-white mb-2">Profile Settings</h3>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Your Story</label>
              <textarea
                rows={4}
                value={settingsForm.story}
                onChange={(e) => setSettingsForm((p) => ({ ...p, story: e.target.value }))}
                className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/20 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">LinkedIn Profile URL</label>
              <input
                type="text"
                value={settingsForm.linkedin}
                onChange={(e) => setSettingsForm((p) => ({ ...p, linkedin: e.target.value }))}
                placeholder="https://linkedin.com/in/yourname"
                className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/20"
              />
            </div>

            <div className="flex items-center justify-between bg-white/5 rounded-xl p-4 border border-white/5">
              <div>
                <p className="text-white text-sm font-semibold">Available for bookings</p>
                <p className="text-gray-500 text-xs mt-0.5">Turn this off to pause new mentor session requests.</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsForm((p) => ({ ...p, available: !p.available }))}
                className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${settingsForm.available ? 'bg-saffron' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settingsForm.available ? 'translate-x-6' : ''}`} />
              </button>
            </div>

            {settingsSaved && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl p-3">✅ Profile settings saved.</div>
            )}

            <button type="submit" disabled={savingSettings} className="btn-primary py-3 px-8 text-sm disabled:opacity-50">
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
