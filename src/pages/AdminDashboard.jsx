import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'
import { getAdminMentorMessages } from '../api'

export default function AdminDashboard() {
  const { session, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('analytics') // 'analytics' | 'mentors' | 'queries' | 'users'
  const [analytics, setAnalytics] = useState(null)
  const [applications, setApplications] = useState([])
  const [bookings, setBookings] = useState([])
  const [queries, setQueries] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [userSearch, setUserSearch] = useState('')
  // Reject flow: open a modal to collect a reason, then submit it.
  const [rejectTarget, setRejectTarget] = useState(null) // application being rejected
  const [rejectReason, setRejectReason] = useState('')

  // Client-side role protection. Computed here but enforced at render time
  // (below), so all hooks still run unconditionally in the same order.
  const isAdmin = profile && profile.role === 'admin'

  const fetchAllData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const headers = {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json'
      }

      const analyticsRes = await fetch('/api/analytics', { headers })
      const analyticsData = await analyticsRes.json()

      const appsRes = await fetch('/api/admin/mentor-applications', { headers })
      const appsData = await appsRes.json()

      const bookingsRes = await fetch('/api/admin/mentor-bookings', { headers })
      const bookingsData = await bookingsRes.json()

      const queriesRes = await getAdminMentorMessages(session?.access_token)
      const queriesData = queriesRes.ok ? await queriesRes.json() : { messages: [] }

      // Fetch users via the backend admin endpoint (service-role key) instead
      // of querying Supabase directly from the browser — the students table's
      // RLS policy ("students_self_rw") only allows a user to read their OWN
      // row, so a direct client-side query always returned 0/1 rows here.
      const usersRes = await fetch('/api/admin/users', { headers })
      let usersData = { users: [] }
      if (usersRes.ok) {
        usersData = await usersRes.json()
      } else {
        // Surface the real reason instead of silently showing an empty list —
        // e.g. 404 means the backend hasn't been redeployed with this route
        // yet (Render's autoDeploy is off for this project), 503 means
        // SUPABASE_SERVICE_ROLE_KEY isn't set on the server.
        const errBody = await usersRes.json().catch(() => ({}))
        console.error('Failed to load users:', usersRes.status, errBody)
        setErrorMsg(
          usersRes.status === 404
            ? 'Users list unavailable: the backend needs to be redeployed with the latest changes.'
            : errBody.message || `Failed to load users (HTTP ${usersRes.status}).`
        )
      }

      setAnalytics(analyticsData)
      setApplications(appsData.applications || [])
      setBookings(bookingsData.bookings || [])
      setQueries(queriesData.messages || [])
      setUsers(usersData.users || [])
    } catch (err) {
      console.error('Error fetching admin data:', err)
      setErrorMsg('Failed to load dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) fetchAllData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isAdmin])

  // Enforce role protection after hooks have run.
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  // ── Actions ──────────────────────────────────────────────────
  const handleApproveMentor = async (id) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/mentor-applications/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to approve')
      // Refresh
      await fetchAllData()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const openRejectModal = (app) => {
    setRejectTarget(app)
    setRejectReason('')
  }

  const submitReject = async () => {
    if (!rejectTarget) return
    const id = rejectTarget.id
    setActionLoading(id)
    try {
      const res = await fetch(`/api/admin/mentor-applications/${id}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      if (!res.ok) throw new Error('Failed to reject')
      setRejectTarget(null)
      setRejectReason('')
      await fetchAllData()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const pendingMentors = applications.filter(a => a.status === 'pending')
  const pendingBookings = bookings.filter(b => b.status === 'pending')

  const formatBookingDate = (ts) => {
    if (!ts) return 'Not specified'
    try {
      return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ts
    }
  }

  // ── Render Charts ────────────────────────────────────────────
  const renderStreamChart = () => {
    if (!analytics || !analytics.by_stream || analytics.by_stream.length === 0) {
      return <div className="text-gray-400 text-sm py-8 text-center">No stream data available</div>
    }

    const maxCount = Math.max(...analytics.by_stream.map(s => s.count))
    const chartHeight = 160
    const barWidth = 60
    const gap = 24
    const paddingLeft = 40
    const chartWidth = analytics.by_stream.length * (barWidth + gap) + paddingLeft

    return (
      <div className="overflow-x-auto pb-4">
        <svg width={chartWidth} height={chartHeight + 40} className="mx-auto overflow-visible">
          {analytics.by_stream.map((item, idx) => {
            const barHeight = (item.count / maxCount) * chartHeight
            const x = paddingLeft + idx * (barWidth + gap)
            const y = chartHeight - barHeight + 20

            return (
              <g key={idx} className="group">
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="6"
                  fill="url(#saffronGradient)"
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                />
                {/* Tooltip value */}
                <text
                  x={x + barWidth / 2}
                  y={y - 8}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="bold"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  {item.count}
                </text>
                {/* Label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 35}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="10"
                  className="font-medium"
                >
                  {item.stream.length > 8 ? item.stream.slice(0, 8) + '..' : item.stream}
                </text>
              </g>
            )
          })}
          {/* Gradients */}
          <defs>
            <linearGradient id="saffronGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] pt-24 pb-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Banner/Header */}
        <div className="relative rounded-3xl overflow-hidden mb-8 border border-white/10 bg-gradient-to-r from-saffron/15 via-[#111827] to-[#111827] p-8">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-saffron/40 to-transparent" />
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">Admin Control Panel</h1>
          <p className="mt-2 text-gray-400 max-w-2xl text-sm leading-relaxed">
            Monitor platform metrics, review and verify student mentor applications, and manage registered users.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/25 rounded-2xl p-4 text-rose-300 text-sm mb-6 flex items-center gap-3">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-5 mb-8">
          <div className="glass-card border-white/5 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl text-indigo-400">
              👥
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Students</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{analytics?.total_students ?? 0}</h3>
            </div>
          </div>

          <div className="glass-card border-white/5 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-saffron/10 border border-saffron/20 flex items-center justify-center text-2xl text-saffron">
              🌟
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Mentors</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{applications.filter(a => a.status === 'approved').length}</h3>
            </div>
          </div>

          <div className="glass-card border-white/5 p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl text-amber-400">
              ⏳
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pending Mentors</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{pendingMentors.length}</h3>
            </div>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { id: 'analytics', label: '📊 Analytics' },
            { id: 'mentors', label: `🌟 Mentors (${pendingMentors.length} pending, ${pendingBookings.length} bookings)` },
            { id: 'queries', label: `💬 Student Queries (${queries.length})` },
            { id: 'users', label: `👥 Users (${users.length})` },
          ].map(t => (
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

        {loading ? (
          <div className="min-h-[300px] flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-saffron mb-4" />
            <p className="text-gray-400 text-sm">Fetching database updates...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── Tab: Analytics ── */}
            {activeTab === 'analytics' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Stream Distribution */}
                <div className="glass-card border-white/5 p-6 relative overflow-hidden">
                  <h3 className="font-display text-lg font-bold text-white mb-6">Student Distribution by Stream</h3>
                  {renderStreamChart()}
                </div>

                {/* State Distribution */}
                <div className="glass-card border-white/5 p-6">
                  <h3 className="font-display text-lg font-bold text-white mb-6">Student Distribution by State</h3>
                  {(!analytics || !analytics.by_state || analytics.by_state.length === 0) ? (
                    <div className="text-gray-400 text-sm py-8 text-center">No state data available</div>
                  ) : (
                    <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2">
                      {analytics.by_state.map((item, idx) => {
                        const pct = Math.round((item.count / (analytics.total_students || 1)) * 100)
                        return (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-300 font-semibold">{item.state || 'Unknown'}</span>
                              <span className="text-saffron font-bold">{item.count} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-saffron to-amber-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tab: Mentors ── */}
            {activeTab === 'mentors' && (
              <div className="space-y-10">

                {/* ── Mentor Booking Requests ── */}
                <div className="space-y-4">
                  <h3 className="font-display text-lg font-bold text-white mb-2">Mentor Booking Requests</h3>
                  {bookings.length === 0 ? (
                    <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                      📅 No mentor booking requests yet.
                    </div>
                  ) : (
                    <div className="glass-card border-white/5 overflow-hidden rounded-2xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                              <th className="text-left px-5 py-3">Student</th>
                              <th className="text-left px-5 py-3">Mentor</th>
                              <th className="text-left px-5 py-3">Class</th>
                              <th className="text-left px-5 py-3">Interest</th>
                              <th className="text-left px-5 py-3">Language</th>
                              <th className="text-left px-5 py-3">Preferred Date/Time</th>
                              <th className="text-left px-5 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {bookings.map((b) => (
                              <tr key={b.id} className="hover:bg-white/[0.03] transition-colors align-top">
                                <td className="px-5 py-3">
                                  <div className="text-white font-medium">{b.contact_name || '—'}</div>
                                  <div className="text-gray-500 text-xs">{b.contact_email}</div>
                                  {b.contact_phone && <div className="text-gray-500 text-xs">{b.contact_phone}</div>}
                                </td>
                                <td className="px-5 py-3 text-gray-300">{b.mentors?.name || '—'}</td>
                                <td className="px-5 py-3 text-gray-400 text-xs">{b.class_level || '—'}</td>
                                <td className="px-5 py-3 text-gray-400 text-xs">{b.area_of_interest || '—'}</td>
                                <td className="px-5 py-3 text-gray-400 text-xs">{b.preferred_language || '—'}</td>
                                <td className="px-5 py-3 text-gray-400 text-xs">{formatBookingDate(b.session_date)}</td>
                                <td className="px-5 py-3">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                    b.status === 'completed' || b.status === 'accepted' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : b.status === 'rescheduled' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                    : b.status === 'declined' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                  }`}>{b.status || 'pending'}</span>
                                  {b.mentor_response && (
                                    <div className="text-[10px] text-gray-500 mt-1 max-w-[180px] truncate" title={b.mentor_response}>{b.mentor_response}</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Mentor Applications ── */}
                <div className="space-y-4">
                <h3 className="font-display text-lg font-bold text-white mb-2">Pending Mentor Applications</h3>
                {pendingMentors.length === 0 ? (
                  <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                    ✨ No pending mentor applications. All caught up!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {pendingMentors.map((app) => (
                      <div key={app.id} className="glass-card border-white/5 p-6 relative flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-display text-base font-bold text-white">{app.name}</h4>
                              <p className="text-xs text-saffron font-semibold mt-0.5">{app.profession || 'Mentor Applicant'}</p>
                              <p className="text-xs text-gray-400">{app.email}</p>
                            </div>
                            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                              Pending Review
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs mb-4 p-3.5 bg-white/5 rounded-xl border border-white/5">
                            <div>
                              <span className="text-gray-400 block text-[11px]">College & Degree:</span>
                              <p className="text-white font-medium truncate mt-0.5">{app.college || 'N/A'}</p>
                              <p className="text-gray-400 text-[11px] truncate">{app.degree || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-gray-400 block text-[11px]">Expertise & Exp:</span>
                              <p className="text-white font-medium truncate mt-0.5">{app.stream_category || 'General'}</p>
                              <p className="text-amber-400 text-[11px] font-semibold">{app.experience_years ? `${app.experience_years} yrs exp` : 'Fresh Graduate'}</p>
                            </div>
                          </div>

                          {/* Verification Links */}
                          <div className="flex flex-wrap gap-3 mb-4 text-xs">
                            {app.linkedin ? (
                              <a
                                href={app.linkedin.startsWith('http') ? app.linkedin : `https://${app.linkedin}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-300 hover:bg-blue-500/20 transition-all font-semibold"
                              >
                                🔗 Verify LinkedIn Profile ↗
                              </a>
                            ) : (
                              <span className="text-gray-500 text-xs italic">No LinkedIn provided</span>
                            )}

                          </div>

                          <div className="text-xs text-gray-300 leading-relaxed mb-6 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                            <span className="text-gray-400 block font-semibold mb-1">Background Story / Motivation:</span>
                            "{app.story}"
                          </div>
                        </div>

                        <div className="flex gap-3 border-t border-white/5 pt-4">
                          <button
                            onClick={() => handleApproveMentor(app.id)}
                            disabled={actionLoading === app.id}
                            className="flex-1 btn-primary py-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-500/30 text-white disabled:opacity-50"
                          >
                            {actionLoading === app.id ? 'Processing...' : '✅ Approve Mentor'}
                          </button>
                          <button
                            onClick={() => openRejectModal(app)}
                            disabled={actionLoading === app.id}
                            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/20 text-rose-300 transition-all text-center disabled:opacity-50"
                          >
                            {actionLoading === app.id ? 'Processing...' : '❌ Reject'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>
            )}

            {/* ── Tab: Student Queries (monitoring — read-only for admin) ── */}
            {activeTab === 'queries' && (
              <div className="space-y-4">
                <h3 className="font-display text-lg font-bold text-white mb-2">Student → Mentor Queries</h3>
                {queries.length === 0 ? (
                  <div className="glass-card border-white/5 p-12 text-center text-gray-400 text-sm">
                    💬 No student queries yet.
                  </div>
                ) : (
                  <div className="glass-card border-white/5 overflow-hidden rounded-2xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                            <th className="text-left px-5 py-3">Student</th>
                            <th className="text-left px-5 py-3">Class</th>
                            <th className="text-left px-5 py-3">Mentor</th>
                            <th className="text-left px-5 py-3">Subject</th>
                            <th className="text-left px-5 py-3">Category</th>
                            <th className="text-left px-5 py-3">Submitted</th>
                            <th className="text-left px-5 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {queries.map((q) => (
                            <tr key={q.id} className="hover:bg-white/[0.03] transition-colors align-top">
                              <td className="px-5 py-3">
                                <div className="text-white font-medium">{q.contact_name || '—'}</div>
                                <div className="text-gray-500 text-xs">{q.contact_email}</div>
                              </td>
                              <td className="px-5 py-3 text-gray-400 text-xs">{q.class_level || '—'}</td>
                              <td className="px-5 py-3 text-gray-300">{q.mentors?.name || '—'}</td>
                              <td className="px-5 py-3 text-gray-300 text-xs max-w-[220px] truncate">{q.subject || '—'}</td>
                              <td className="px-5 py-3 text-gray-400 text-xs">{q.category || '—'}</td>
                              <td className="px-5 py-3 text-gray-500 text-xs">{formatBookingDate(q.created_at)}</td>
                              <td className="px-5 py-3">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  q.status === 'answered' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                }`}>{q.status === 'answered' ? 'Replied' : 'Pending'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Users ── */}
            {activeTab === 'users' && (
              <div>
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <h3 className="font-display text-lg font-bold text-white">All Registered Users</h3>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search by name, state, stream..."
                    className="search-input max-w-xs text-sm py-2"
                  />
                </div>
                <div className="glass-card border-white/5 overflow-hidden rounded-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-xs text-gray-500 uppercase tracking-wider">
                          <th className="text-left px-5 py-3">Name</th>
                          <th className="text-left px-5 py-3">Role</th>
                          <th className="text-left px-5 py-3">Class Level</th>
                          <th className="text-left px-5 py-3">Stream</th>
                          <th className="text-left px-5 py-3">Marks</th>
                          <th className="text-left px-5 py-3">State</th>
                          <th className="text-left px-5 py-3">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {users
                          .filter(u => {
                            const q = userSearch.toLowerCase()
                            return !q || (u.full_name || '').toLowerCase().includes(q)
                              || (u.state || '').toLowerCase().includes(q)
                              || (u.stream || '').toLowerCase().includes(q)
                              || (u.role || '').toLowerCase().includes(q)
                          })
                          .map(u => (
                            <tr key={u.id} className="hover:bg-white/[0.03] transition-colors">
                              <td className="px-5 py-3 text-white font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-saffron/15 border border-saffron/20 flex items-center justify-center text-xs font-bold text-saffron flex-shrink-0">
                                    {(u.full_name || '?')[0].toUpperCase()}
                                  </div>
                                  {u.full_name || <span className="text-gray-600 italic">Unnamed</span>}
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  u.role === 'admin' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                  : u.role === 'mentor' ? 'bg-saffron/10 border-saffron/20 text-saffron'
                                  : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                }`}>{u.role || 'student'}</span>
                              </td>
                              <td className="px-5 py-3 text-gray-400">{u.class_level || '—'}</td>
                              <td className="px-5 py-3 text-gray-400 text-xs">{u.stream || '—'}</td>
                              <td className="px-5 py-3 text-gray-400">{u.marks ? `${u.marks}%` : '—'}</td>
                              <td className="px-5 py-3 text-gray-400 text-xs">{u.state || '—'}</td>
                              <td className="px-5 py-3 text-gray-500 text-xs">
                                {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {users.filter(u => {
                      const q = userSearch.toLowerCase()
                      return !q || (u.full_name || '').toLowerCase().includes(q)
                        || (u.state || '').toLowerCase().includes(q)
                        || (u.stream || '').toLowerCase().includes(q)
                    }).length === 0 && (
                      <div className="py-10 text-center text-gray-500 text-sm">No users found</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Reject reason modal ── */}
      {rejectTarget && (
        <div className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md p-6 sm:p-8 border-rose-500/30 relative shadow-2xl">
            <button
              onClick={() => setRejectTarget(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-2xl"
              aria-label="Close"
            >
              &times;
            </button>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-2xl mx-auto mb-3">❌</div>
              <h2 className="font-display text-xl font-bold text-white">Reject Application</h2>
              <p className="text-gray-400 text-sm mt-1">
                Let <span className="text-white font-medium">{rejectTarget.name}</span> know why. This reason is emailed to them.
              </p>
            </div>

            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Reason for rejection *</label>
            <textarea
              rows={4}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. We're looking for mentors with more experience in your chosen domain right now."
              className="w-full bg-white/[0.05] border border-white/10 hover:border-white/20 focus:border-rose-500/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm transition-all outline-none focus:ring-2 focus:ring-rose-500/20 resize-none"
            />

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={!rejectReason.trim() || actionLoading === rejectTarget.id}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 border border-rose-500/30 text-white transition-all disabled:opacity-50"
              >
                {actionLoading === rejectTarget.id ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
