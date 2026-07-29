import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

function formatDate(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ts
  }
}

export default function MyMentorRequests() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) navigate('/')
  }, [user, authLoading, navigate])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // mentor_messages joined with the mentor's public info.
    const { data } = await supabase
      .from('mentor_messages')
      .select('*, mentors(name, initials, college)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  if (authLoading || loading) return (
    <main className="pt-24 pb-16 min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </main>
  )

  return (
    <main className="pt-24 pb-16 min-h-screen px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-2">My Mentor Requests</h1>
          <p className="text-gray-400 text-sm">Questions you've asked mentors and their replies.</p>
        </div>

        {requests.length === 0 ? (
          <div className="glass-card border-white/10 p-12 text-center max-w-xl mx-auto">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-300 text-base mb-1">You haven't asked any mentors yet.</p>
            <p className="text-gray-500 text-xs mb-6">Find a mentor who's been through what you're facing and ask them anything.</p>
            <Link to="/mentors" className="btn-primary px-8 py-3 text-sm inline-flex items-center gap-2">
              Browse Mentors →
            </Link>
          </div>
        ) : (
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
                        To {r.mentors?.name || 'Mentor'} · {formatDate(r.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${
                    r.status === 'answered' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>{r.status === 'answered' ? 'Answered' : 'Awaiting reply'}</span>
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
        )}
      </div>
    </main>
  )
}
