import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { getQAPosts, postQAQuestion, patchQAAnswer } from '../api'

const STREAMS = ['All', 'Science (PCM)', 'Science (PCB)', 'Commerce', 'Arts / Humanities', 'Class 10 / Stream Selection']

// ─── Inline answer form — shown only to a signed-in mentor, on an
// unanswered question. Submits via PATCH /api/qa/:id/answer, which verifies
// mentor ownership server-side (so this is safe even if someone without a
// linked mentor profile somehow saw the button — the backend would reject it).
function MentorAnswerForm({ postId, session, onAnswered }) {
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (answer.trim().length < 5) { setError('Please write at least 5 characters.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await patchQAAnswer(postId, answer.trim(), session?.access_token)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Failed to post your answer.')
      onAnswered(data.post)
      setAnswer('')
    } catch (err) {
      setError(err.message || 'Failed to post your answer.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t border-white/10 pt-4 space-y-2">
      <textarea
        rows={2}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer as a mentor…"
        className="w-full bg-navy-800 border border-white/10 hover:border-white/20 focus:border-saffron/60 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm resize-none outline-none focus:ring-2 focus:ring-saffron/30 transition-all"
      />
      {error && <p className="text-rose-400 text-xs">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || answer.trim().length < 5}
          className="btn-primary py-2 px-6 text-xs disabled:opacity-50"
        >
          {submitting ? 'Posting…' : 'Post Answer →'}
        </button>
      </div>
    </form>
  )
}

function PostCard({ post, isMentor, session, onAnswered }) {
  const date = new Date(post.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const answered = !!post.answer
  return (
    <div className={`rounded-2xl border p-5 sm:p-6 transition-all animate-slide-up ${answered ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10 bg-white/4'}`}>
      {/* Stream tag */}
      {post.stream_tag && (
        <span className="text-[10px] font-bold text-saffron uppercase tracking-widest bg-saffron/10 border border-saffron/20 px-2 py-0.5 rounded mb-3 inline-block">
          {post.stream_tag}
        </span>
      )}

      {/* Question */}
      <p className="text-white text-sm font-semibold leading-snug">{post.question}</p>
      <p className="text-gray-600 text-[11px] mt-1">{date}</p>

      {/* Answer */}
      {answered ? (
        <div className="mt-4 border-t border-emerald-500/15 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs">
              {post.mentors?.initials || '✓'}
            </div>
            <span className="text-emerald-400 text-xs font-bold">{post.mentors?.name || 'Senior Mentor'} answered</span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">{post.answer}</p>
        </div>
      ) : (
        <>
          <p className="text-gray-600 text-xs mt-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Waiting for a mentor to answer…
          </p>
          {isMentor && (
            <MentorAnswerForm postId={post.id} session={session} onAnswered={onAnswered} />
          )}
        </>
      )}
    </div>
  )
}

function AskForm({ session, onPosted }) {
  const [question, setQuestion] = useState('')
  const [streamTag, setStreamTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (question.trim().length < 10) { setError('Please write at least 10 characters.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await postQAQuestion(question.trim(), streamTag || '', session.access_token)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to post')
      setQuestion('')
      setStreamTag('')
      onPosted(data.post)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 mb-8 space-y-4">
      <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
        <span>💬</span>
        <span>Ask a Senior</span>
      </h3>

      <textarea
        rows={3}
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Ask something honest — e.g. 'Is CLAT worth it if I'm not from a coaching background?' or 'Can I get into NIT with 75% in CBSE?'"
        className="w-full bg-navy-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm resize-none outline-none focus:ring-2 focus:ring-saffron/40 focus:border-saffron/60 transition-all"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={streamTag}
          onChange={e => setStreamTag(e.target.value)}
          className="flex-1 bg-navy-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-300 outline-none focus:ring-2 focus:ring-saffron/40 transition-all"
        >
          <option value="">No stream tag</option>
          {STREAMS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          type="submit"
          disabled={loading || question.trim().length < 10}
          className="btn-primary py-2.5 px-6 text-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Posting…' : 'Post Question'}
        </button>
      </div>

      {error && <p className="text-rose-400 text-xs">{error}</p>}
    </form>
  )
}

export default function QABoard() {
  const { session, profile, loading: authLoading } = useAuth()
  const isMentor = (profile?.roles || (profile?.role ? [profile.role] : [])).includes('mentor')

  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [stream, setStream] = useState('All')
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (p = 1, s = 'All', replace = true) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: p })
      if (s !== 'All') params.set('stream', s)
      const res = await getQAPosts(params)
      const data = await res.json()
      const newPosts = data.posts || []
      setPosts(prev => replace ? newPosts : [...prev, ...newPosts])
      setHasMore(newPosts.length === 20)
    } catch { }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(1, stream, true) }, [stream, load])

  const handlePosted = (newPost) => {
    setPosts(prev => [newPost, ...prev])
  }

  const handleAnswered = (updatedPost) => {
    setPosts(prev => prev.map(p => (p.id === updatedPost.id ? updatedPost : p)))
  }

  const handleStreamChange = (s) => {
    setStream(s)
    setPage(1)
  }

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    load(next, stream, false)
  }

  return (
    <main className="pt-24 pb-20 min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
            <span className="text-saffron text-sm font-semibold">Ask a Senior</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Real Questions,{' '}
            <span className="gradient-text">Real Answers</span>
          </h1>
          <p className="text-gray-400 text-base max-w-lg mx-auto">
            Ask seniors who've already been through what you're facing. Our mentor network answers publicly so everyone benefits.
          </p>
        </div>

        {/* Ask form — only for logged-in users */}
        {session && !authLoading && (
          <AskForm session={session} onPosted={handlePosted} />
        )}
        {!session && !authLoading && (
          <div className="glass-card p-6 mb-8 text-center border-saffron/20">
            <p className="text-gray-300 text-sm mb-3">Log in to ask your own question.</p>
            <p className="text-gray-500 text-xs">You can still read all questions and answers below without logging in.</p>
          </div>
        )}

        {/* Stream filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STREAMS.map(s => (
            <button
              key={s}
              onClick={() => handleStreamChange(s)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all
                ${stream === s
                  ? 'bg-saffron border-saffron text-navy font-bold'
                  : 'border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
                }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading && posts.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-saffron border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <div className="text-4xl mb-4">🤔</div>
            <h3 className="font-display font-bold text-white text-xl mb-2">No questions yet</h3>
            <p className="text-gray-400 text-sm">Be the first to ask something!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                isMentor={isMentor}
                session={session}
                onAnswered={handleAnswered}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && posts.length > 0 && (
          <div className="flex justify-center mt-8">
            <button onClick={loadMore} className="btn-outline text-sm py-2.5 px-8">
              Load More
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
