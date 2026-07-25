import { useState, useEffect } from 'react'
import { getCourseReality } from '../data/courseReality'
import { getCourseFeedback } from '../api'

// ─── YouTube embed card ───────────────────────────────────────────────────────

function VideoCard({ video }) {
  const [loaded, setLoaded] = useState(false)
  const thumb = `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-navy-800 flex flex-col">
      {loaded ? (
        <div className="relative" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="relative group w-full"
          style={{ paddingBottom: '56.25%' }}
          aria-label={`Play: ${video.title}`}
        >
          <img
            src={thumb}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}
      <div className="p-3">
        <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{video.title}</p>
        <p className="text-gray-500 text-[10px] mt-1">{video.channel}</p>
      </div>
    </div>
  )
}

// ─── CSS-only outcome bar chart ───────────────────────────────────────────────

function OutcomeChart({ outcomes }) {
  return (
    <div className="space-y-2.5">
      {outcomes.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-gray-400 text-xs w-36 flex-shrink-0 leading-tight text-right">{item.label}</span>
          <div className="flex-1 h-4 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-saffron to-saffron-light transition-all duration-700"
              style={{ width: `${item.pct}%` }}
            />
          </div>
          <span className="text-saffron text-xs font-bold w-8 flex-shrink-0">{item.pct}%</span>
        </div>
      ))}
      <p className="text-gray-600 text-[10px] mt-2 italic">
        * Approximate outcomes based on aggregated placement & admission data. Actual results vary.
      </p>
    </div>
  )
}

// ─── Student feedback section ─────────────────────────────────────────────────

function _StudentFeedback({ streamKey }) {
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    getCourseFeedback(streamKey, { signal: controller.signal })
      .then(r => r.ok ? r.json() : { feedback: [] })
      .then(d => { setFeedback(d.feedback || []); setLoading(false) })
      .catch(() => setLoading(false))
    return () => controller.abort()
  }, [streamKey])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <div className="w-3 h-3 rounded-full border-2 border-saffron border-t-transparent animate-spin" />
        <span className="text-gray-500 text-xs">Loading feedback…</span>
      </div>
    )
  }

  if (feedback.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
        <p className="text-gray-500 text-sm">No student feedback yet for this path.</p>
        <p className="text-gray-600 text-xs mt-1">Be the first to share your experience — coming soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {feedback.slice(0, 4).map((fb, i) => (
        <div key={i} className="bg-white/4 border border-white/8 rounded-xl p-4">
          <p className="text-gray-300 text-sm leading-relaxed">"{fb.content}"</p>
          <p className="text-gray-600 text-[10px] mt-2">
            {fb.created_at ? new Date(fb.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Recent'}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab navigation ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: '📋 Overview', icon: '📋' },
  { id: 'videos',   label: '▶️ Videos',   icon: '▶️' },
  { id: 'outcomes', label: '📊 Outcomes', icon: '📊' },
]

// ─── Main CourseReality component ─────────────────────────────────────────────

/**
 * CourseReality — shared "What is this really like?" insight layer.
 *
 * Props:
 *   streamKey  {string}  Stream name from Class 10 (e.g. "Science (PCM)") OR
 *                        career path name from Class 12 guidance result
 *   compact    {boolean} If true, renders a smaller collapsible trigger button
 */
export default function CourseReality({ streamKey, compact = false }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const data = getCourseReality(streamKey)

  if (!data || !streamKey) return null

  return (
    <div className="mt-3 animate-fade-in">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-3 rounded-xl border transition-all duration-200 group
          ${open
            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
            : 'bg-white/4 border-white/8 text-gray-400 hover:border-saffron/30 hover:text-white hover:bg-saffron/5'
          } ${compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'}`}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{data.emoji}</span>
          <div className="text-left">
            <span className="font-semibold">See what {data.label} is really like</span>
            {!open && (
              <span className="block text-xs text-gray-500 mt-0.5">{data.tagline}</span>
            )}
          </div>
        </div>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="mt-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 overflow-hidden animate-slide-up">
          {/* Tagline header */}
          <div className="px-5 pt-5 pb-3 border-b border-white/8">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{data.emoji}</span>
              <div>
                <h4 className="text-white font-display font-bold text-base">{data.label}</h4>
                <p className="text-indigo-300 text-xs italic mt-0.5">"{data.tagline}"</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/8 overflow-x-auto overflow-y-hidden">
            {TABS.map(tab => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px
                  ${activeTab === tab.id
                    ? 'border-saffron text-saffron'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">

            {/* Overview — pros & cons */}
            {activeTab === 'overview' && (
              <div className="grid sm:grid-cols-2 gap-5 animate-fade-in">
                <div>
                  <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span>✅</span> Advantages
                  </p>
                  <ul className="space-y-2">
                    {data.pros.map((pro, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </span>
                        <span className="text-gray-300 text-sm leading-snug">{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-rose-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span>⚠️</span> Realities / Challenges
                  </p>
                  <ul className="space-y-2">
                    {data.cons.map((con, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="w-4 h-4 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-2.5 h-2.5 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                          </svg>
                        </span>
                        <span className="text-gray-300 text-sm leading-snug">{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Mentor CTA */}
                <div className="sm:col-span-2 mt-2">
                  <div className="flex items-center gap-3 bg-saffron/8 border border-saffron/20 rounded-xl p-4">
                    <span className="text-2xl flex-shrink-0">👋</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-saffron text-xs font-bold uppercase tracking-wider">Talk to a Mentor</p>
                      <p className="text-gray-300 text-sm mt-0.5">
                        Ask someone who's been there about <em>{data.mentorTopic}</em>.
                      </p>
                    </div>
                    <a
                      href="/mentors"
                      className="flex-shrink-0 text-xs font-bold bg-saffron/15 border border-saffron/30 text-saffron hover:bg-saffron/25 px-3 py-2 rounded-lg transition-all"
                    >
                      Find Mentor →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Videos */}
            {activeTab === 'videos' && (
              <div className="animate-fade-in">
                <p className="text-gray-400 text-xs mb-4">Curated videos to help you understand what this path actually looks like day-to-day.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(data.videos || []).map((v, i) => (
                    <VideoCard key={i} video={v} />
                  ))}
                </div>
                {(!data.videos || data.videos.length === 0) && (
                  <p className="text-gray-500 text-sm text-center py-6">No curated videos yet — check YouTube for "{data.label} student life India".</p>
                )}
              </div>
            )}

            {/* Outcomes */}
            {activeTab === 'outcomes' && (
              <div className="animate-fade-in">
                <p className="text-gray-400 text-xs mb-5">
                  Where students who choose <strong className="text-white">{data.label}</strong> typically end up — based on aggregated data.
                </p>
                {data.outcomes && data.outcomes.length > 0 ? (
                  <OutcomeChart outcomes={data.outcomes} />
                ) : (
                  <p className="text-gray-500 text-sm text-center py-6">Outcome data not available yet.</p>
                )}
              </div>
            )}



          </div>
        </div>
      )}
    </div>
  )
}
