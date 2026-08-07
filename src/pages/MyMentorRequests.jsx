import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getMentorMessages, getStudentBookings } from '../api'

function formatDate(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

export default function MyMentorRequests() {
  const { user, session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [requests, setRequests] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) navigate('/')
  }, [user, authLoading, navigate])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [msgRes, bookRes] = await Promise.all([
        getMentorMessages(session?.access_token),
        getStudentBookings(session?.access_token),
      ])
      if (msgRes.ok) {
        const json = await msgRes.json()
        setRequests(json.messages || [])
      } else {
        setRequests([])
      }
      if (bookRes.ok) {
        const json = await bookRes.json()
        setBookings(json.bookings || [])
      } else {
        setBookings([])
      }
    } catch {
      setRequests([]); setBookings([])
    }
    setLoading(false)
  }, [user, session])

  useEffect(() => { load() }, [load])

  if (authLoading || loading) return (
    <main className="pt-24 pb-16 min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </main>
  )

  const CLASS_LABELS = { '10th': 'Class 10th', '12th': 'Class 12th', Other: 'Other / UG' }

  const bookingStatusMeta = (status) => {
    switch (status) {
      case 'accepted': return { label: 'Approved', cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' }
      case 'completed': return { label: 'Completed', cls: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' }
      case 'declined': return { label: 'Declined', cls: 'bg-rose-500/10 border-rose-500/20 text-rose-400' }
      case 'rescheduled': return { label: 'Rescheduled', cls: 'bg-blue-500/10 border-blue-500/20 text-blue-400' }
      default: return { label: 'Pending', cls: 'bg-amber-500/10 border-amber-500/20 text-amber-400' }
    }
  }

  const nothingYet = requests.length === 0 && bookings.length === 0

  return (
    <main className="pt-24 pb-16 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">My Mentor Requests</h1>
          <p className="text-gray-400 text-sm">Your questions, session bookings, and mentor replies.</p>
        </div>

        {nothingYet ? (
          <div className="glass-card border-white/10 p-12 text-center max-w-xl mx-auto">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-300 text-base mb-1">You haven't contacted any mentors yet.</p>
            <p className="text-gray-500 text-xs mb-6">Find a mentor who's been through what you're facing — ask a question or book a session.</p>
            <Link to="/mentors" className="btn-primary px-8 py-3 text-sm inline-flex items-center gap-2">
              Browse Mentors →
            </Link>
          </div>
        ) : (
        <>
        {/* ── Session Bookings ── */}
        {bookings.length > 0 && (
          <div className="mb-10">
            <h2 className="font-display text-lg font-bold text-white mb-4">Session Bookings</h2>
            <div className="space-y-4">
              {bookings.map((b) => {
                const meta = bookingStatusMeta(b.status || 'pending')
                return (
                  <div key={b.id} className="glass-card border-white/5 p-5 sm:p-6 space-y-3">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-saffron/20 text-saffron flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
                          {b.mentors?.initials || 'M'}
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-white text-sm">Session with {b.mentors?.name || 'Mentor'}</h3>
                          <p className="text-gray-400 text-xs">
                            Requested {formatDate(b.created_at)}{b.session_date ? ` · Preferred: ${formatDate(b.session_date)}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
                    </div>

                    {b.guidance_query && (
                      <div className="text-sm text-gray-200 bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
                        <span className="text-gray-500 text-xs font-semibold block mb-1">You requested:</span>
                        {b.guidance_query}
                      </div>
                    )}

                    {b.mentor_response ? (
                      <div className={`text-sm text-gray-200 p-3.5 rounded-xl border ${
                        b.status === 'declined' ? 'bg-rose-500/5 border-rose-500/15'
                        : b.status === 'rescheduled' ? 'bg-blue-500/5 border-blue-500/15'
                        : 'bg-emerald-500/5 border-emerald-500/15'
                      }`}>
                        <span className={`text-xs font-semibold block mb-1 ${
                          b.status === 'declined' ? 'text-rose-300' : b.status === 'rescheduled' ? 'text-blue-300' : 'text-emerald-400'
                        }`}>
                          {b.mentors?.name || 'Mentor'} responded:
                        </span>
                        {b.mentor_response}
                      </div>
                    ) : (b.status === 'accepted' || b.status === 'completed') ? (
                      <p className="text-emerald-400/80 text-xs italic">Your session was approved. Details will be shared by email.</p>
                    ) : b.status === 'declined' ? (
                      <p className="text-rose-400/80 text-xs italic">The mentor couldn't take this session.</p>
                    ) : (
                      <p className="text-gray-500 text-xs italic">Waiting for the mentor to respond. You'll get an email when they do.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Questions ── */}
        {requests.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-bold text-white mb-4">Questions</h2>
            <div className="space-y-4">
            {requests.map((r) => (
              <div key={r.id} className="glass-card border-white/5 p-5 sm:p-6 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-saffron/20 text-saffron flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
                      {r.mentors?.initials || 'M'}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-white text-sm">{r.subject || 'Question'}</h3>
                      <p className="text-gray-400 text-xs">
                        To {r.mentors?.name || 'Mentor'}{r.class_level ? ` · ${CLASS_LABELS[r.class_level] || r.class_level}` : ''} · {formatDate(r.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    r.status === 'answered' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>{r.status === 'answered' ? 'Replied' : 'Pending'}</span>
                </div>

                {r.category && (
                  <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-lg border bg-white/5 border-white/10 text-gray-400">
                    {r.category}
                  </span>
                )}

                <div className="text-sm text-gray-200 bg-white/[0.03] p-3.5 rounded-xl border border-white/5">
                  <span className="text-gray-500 text-xs font-semibold block mb-1">You asked:</span>
                  {r.question}
                </div>

                {r.status === 'answered' ? (
                  <div className="text-sm text-gray-200 bg-emerald-500/5 p-3.5 rounded-xl border border-emerald-500/15">
                    <span className="text-emerald-400 text-xs font-semibold block mb-1">
                      {r.mentors?.name || 'Mentor'} replied{r.replied_at ? ` · ${formatDate(r.replied_at)}` : ''}:
                    </span>
                    {r.reply}
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs italic">The mentor hasn't replied yet. You'll get an email when they do.</p>
                )}
              </div>
            ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </main>
  )
}
