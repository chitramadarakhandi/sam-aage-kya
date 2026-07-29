import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import { patchMentorReply } from '../api'

function formatDateTime(ts) {
  if (!ts) return 'Not specified'
  try {
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

// ─── Booking Request Card ─────────────────────────────────────────────────────

function BookingCard({ booking, onAccept, onReject, onComplete, actionLoading }) {
  const isLoading = actionLoading === booking.id
  return (
    <div className="glass-card border-white/5 p-5 flex flex-col gap-3">
      <div className="flex justify-between items-start gap-3">
        <div>
          <h4 className="font-display text-sm font-bold text-white">{booking.contact_name || 'Student'}</h4>
          <p className="text-gray-400 text-xs">{booking.contact_email}</p>
          {booking.contact_phone && <p className="text-gray-500 text-xs">{booking.contact_phone}</p>}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${
          booking.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : booking.status === 'accepted' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          : booking.status === 'rejected' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>{booking.status || 'pending'}</span>
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
          <span className="text-white font-medium">{formatDateTime(booking.session_date)}</span>
        </div>
      </div>

      {booking.guidance_query && (
        <div className="text-xs text-gray-300 bg-white/[0.02] p-3 rounded-xl border border-white/5">
          <span className="text-gray-500 block font-semibold mb-1">Guidance requested:</span>
          "{booking.guidance_query}"
        </div>
      )}

      {booking.status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAccept(booking.id)}
            disabled={isLoading}
            className="flex-1 btn-primary py-2 text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : '✅ Accept'}
          </button>
          <button
            onClick={() => onReject(booking.id)}
            disabled={isLoading}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-300 transition-all disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : '❌ Reject'}
          </button>
        </div>
      )}

      {booking.status === 'accepted' && (
        <div className="pt-1">
          <button
            onClick={() => onComplete(booking.id)}
            disabled={isLoading}
            className="w-full btn-primary py-2 text-xs disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : '🏁 Mark as Completed'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MentorDashboard() {
  const { user, profile, session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [mentorProfile, setMentorProfile] = useState(null)
  const [bookings, setBookings] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [activeTab, setActiveTab] = useState('upcoming') // 'upcoming' | 'accepted' | 'completed' | 'messages' | 'settings'

  // Per-message reply drafts + in-flight state
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replyingId, setReplyingId] = useState(null)

  // Profile settings form
  const [settingsForm, setSettingsForm] = useState({ story: '', linkedin: '', available: true })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // ── Guard: redirect non-mentors ─────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) navigate('/')
    if (!authLoading && profile && profile.role !== 'mentor') navigate('/')
  }, [user, profile, authLoading, navigate])

  // ── Load mentor profile and booking requests ────────────────
  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: mp } = await supabase
      .from('mentors')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    setMentorProfile(mp)
    if (mp) {
      setSettingsForm({ story: mp.story || '', linkedin: mp.linkedin || '', available: mp.available !== false })

      const { data: sess } = await supabase
        .from('mentor_sessions')
        .select('*')
        .eq('mentor_id', mp.id)
        .order('created_at', { ascending: false })
      setBookings(sess || [])

      const { data: msgs } = await supabase
        .from('mentor_messages')
        .select('*')
        .eq('mentor_id', mp.id)
        .order('created_at', { ascending: false })
      setMessages(msgs || [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  // ── Actions on booking requests ──────────────────────────────
  const updateBookingStatus = async (id, status) => {
    setActionLoading(id)
    try {
      const { error } = await supabase.from('mentor_sessions').update({ status }).eq('id', id)
      if (error) throw error
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
    } catch (err) {
      alert(err.message || 'Failed to update booking.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAccept = (id) => updateBookingStatus(id, 'accepted')
  const handleReject = (id) => updateBookingStatus(id, 'rejected')
  const handleComplete = (id) => updateBookingStatus(id, 'completed')

  // ── Reply to a student question ──────────────────────────────
  const handleReply = async (messageId) => {
    const reply = (replyDrafts[messageId] || '').trim()
    if (!reply) return
    setReplyingId(messageId)
    try {
      const res = await patchMentorReply(messageId, reply, session?.access_token)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Failed to send reply.')
      }
      const { message } = await res.json().catch(() => ({}))
      setMessages((prev) => prev.map((m) => (m.id === messageId
        ? { ...m, reply, status: 'answered', replied_at: message?.replied_at || new Date().toISOString() }
        : m)))
      setReplyDrafts((prev) => ({ ...prev, [messageId]: '' }))
    } catch (err) {
      alert(err.message || 'Failed to send reply.')
    } finally {
      setReplyingId(null)
    }
  }

  // ── Profile settings ──────────────────────────────────────────
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

  if (!mentorProfile) return (
    <main className="pt-24 pb-16 min-h-screen flex items-center justify-center px-4">
      <div className="glass-card p-10 text-center max-w-md">
        <div className="text-4xl mb-4">🔗</div>
        <h2 className="font-display text-xl font-bold text-white mb-3">No mentor profile linked</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Your account isn't linked to a mentor profile yet. Contact an admin to link your <code className="text-saffron text-xs bg-saffron/10 px-1.5 py-0.5 rounded">user_id</code> to your mentor row in the database.
        </p>
      </div>
    </main>
  )

  const now = Date.now()
  const upcoming = bookings.filter((b) => (b.status === 'pending' || b.status === 'accepted') && (!b.session_date || new Date(b.session_date).getTime() >= now))
  const accepted = bookings.filter((b) => b.status === 'accepted')
  const completed = bookings.filter((b) => b.status === 'completed')

  const pendingMessages = messages.filter((m) => m.status !== 'answered')

  const TABS = [
    { id: 'upcoming', label: `📅 Upcoming (${upcoming.length})` },
    { id: 'accepted', label: `✅ Accepted (${accepted.length})` },
    { id: 'completed', label: `🏁 Completed (${completed.length})` },
    { id: 'messages', label: `💬 Messages (${pendingMessages.length})` },
    { id: 'settings', label: '⚙️ Profile Settings' },
  ]

  return (
    <main className="pt-24 pb-16 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* ── Profile Information ── */}
        <div className="glass-card border-white/5 p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className={`w-16 h-16 rounded-2xl ${mentorProfile.initials_bg || 'bg-saffron/20 text-saffron'} flex items-center justify-center font-display font-bold text-xl flex-shrink-0`}>
            {mentorProfile.initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold text-white">{mentorProfile.name}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{mentorProfile.degree} · {mentorProfile.college}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border bg-saffron/10 text-saffron border-saffron/20">
                {mentorProfile.stream_category}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                mentorProfile.available ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${mentorProfile.available ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                {mentorProfile.available ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                activeTab === t.id
                  ? 'bg-saffron text-white border-saffron shadow-lg shadow-saffron/20'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Upcoming Booking Requests ── */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {upcoming.length === 0 ? (
              <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                ✨ No upcoming booking requests right now.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {upcoming.map((b) => (
                  <BookingCard key={b.id} booking={b} onAccept={handleAccept} onReject={handleReject} onComplete={handleComplete} actionLoading={actionLoading} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Accepted Sessions ── */}
        {activeTab === 'accepted' && (
          <div className="space-y-4">
            {accepted.length === 0 ? (
              <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                No accepted sessions yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {accepted.map((b) => (
                  <BookingCard key={b.id} booking={b} onAccept={handleAccept} onReject={handleReject} onComplete={handleComplete} actionLoading={actionLoading} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Completed Sessions ── */}
        {activeTab === 'completed' && (
          <div className="space-y-4">
            {completed.length === 0 ? (
              <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                No completed sessions yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {completed.map((b) => (
                  <BookingCard key={b.id} booking={b} onAccept={handleAccept} onReject={handleReject} onComplete={handleComplete} actionLoading={actionLoading} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Messages (Ask Mentor questions) ── */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                💬 No student questions yet. They'll show up here when a student asks you something.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="glass-card border-white/5 p-5 sm:p-6 space-y-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <h4 className="font-display text-sm font-bold text-white">{m.subject || 'Question'}</h4>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {m.contact_name} · {m.contact_email}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        m.status === 'answered' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      }`}>{m.status === 'answered' ? 'Answered' : 'Pending'}</span>
                      {m.category && <span className="text-[10px] text-gray-500">{m.category}</span>}
                    </div>
                  </div>

                  <div className="text-sm text-gray-200 bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
                    {m.question}
                  </div>

                  {m.status === 'answered' ? (
                    <div className="text-sm text-gray-200 bg-emerald-500/5 p-3.5 rounded-xl border border-emerald-500/15">
                      <span className="text-emerald-400 text-xs font-semibold block mb-1">Your reply:</span>
                      {m.reply}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={replyDrafts[m.id] || ''}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [m.id]: e.target.value }))}
                        placeholder="Write your reply to the student..."
                        className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-saffron/20 resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleReply(m.id)}
                          disabled={!(replyDrafts[m.id] || '').trim() || replyingId === m.id}
                          className="btn-primary py-2 px-6 text-xs disabled:opacity-50"
                        >
                          {replyingId === m.id ? 'Sending...' : 'Send Reply'}
                        </button>
                      </div>
                    </div>
                  )}
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
