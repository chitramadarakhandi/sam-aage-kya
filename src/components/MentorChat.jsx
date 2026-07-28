import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

// Format timestamp to human-friendly time
function formatTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function MentorChat({ mentor, onClose, onSignInRequest }) {
  const { user }    = useAuth()
  const [session, setSession]   = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText]         = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const bottomRef = useRef(null)
  const channelRef = useRef(null)

  // Sample/fallback mentors (shown when the DB has none) use string ids like
  // "fallback-1", which are not valid UUIDs and can't be a chat_sessions
  // foreign key. Detect them so we show a friendly message instead of a
  // silently-broken chat box.
  const isUuid = (v) =>
    typeof v === 'string' &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
  const isSampleMentor = !isUuid(mentor.id)

  // ── Get or create a chat session ────────────────────────────
  const initSession = useCallback(async () => {
    if (!user) return
    if (isSampleMentor) { setLoading(false); return }
    setLoading(true)
    setSessionError(false)

    try {
      // Upsert session (unique on student_id + mentor_id)
      const { data: sess, error } = await supabase
        .from('chat_sessions')
        .upsert(
          { student_id: user.id, mentor_id: mentor.id },
          { onConflict: 'student_id,mentor_id', ignoreDuplicates: false }
        )
        .select()
        .single()

      if (error) {
        // If upsert fails (e.g. duplicate), fetch the existing session
        const { data: existing, error: fetchErr } = await supabase
          .from('chat_sessions')
          .select()
          .eq('student_id', user.id)
          .eq('mentor_id', mentor.id)
          .single()
        if (fetchErr || !existing) throw (fetchErr || new Error('Could not open chat session'))
        setSession(existing)
        await loadMessages(existing.id)
      } else {
        setSession(sess)
        await loadMessages(sess.id)
      }
    } catch (err) {
      console.error('Chat session error:', err.message)
      setSessionError(true)
    } finally {
      setLoading(false)
    }
  }, [user, mentor.id, isSampleMentor])

  // ── Load existing messages ───────────────────────────────────
  const loadMessages = async (sessionId) => {
    if (!sessionId) return
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  // ── Subscribe to real-time messages ─────────────────────────
  useEffect(() => {
    if (!session?.id) return

    const channel = supabase
      .channel(`chat:${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates (optimistic vs real)
            if (prev.find((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.id])

  // ── Scroll to bottom on new messages ────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Init on mount ────────────────────────────────────────────
  useEffect(() => {
    initSession()
  }, [initSession])

  // ── Send a message ───────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || !session?.id || sending) return

    setSending(true)
    setText('')

    // Optimistic update
    const optimistic = {
      id: `opt-${Date.now()}`,
      session_id: session.id,
      sender_id: user.id,
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    const { error } = await supabase.from('chat_messages').insert({
      session_id: session.id,
      sender_id: user.id,
      content,
    })

    if (error) {
      // Remove optimistic on error
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setText(content)
      console.error('Send error:', error.message)
    }
    setSending(false)
  }

  const mentorInitials = mentor.initials || mentor.name?.slice(0, 2).toUpperCase()

  return (
    // Overlay + slide-in panel
    <div className="fixed inset-0 z-[90] flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Chat panel */}
      <div className="w-full max-w-md h-full bg-[#0D1220] border-l border-white/10 flex flex-col shadow-2xl animate-slide-from-right">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 bg-[#0A0F1E]">
          <div className={`w-10 h-10 rounded-xl ${mentor.initials_bg || 'bg-saffron/20 text-saffron'} flex items-center justify-center font-display font-bold text-base flex-shrink-0`}>
            {mentorInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-white text-sm">{mentor.name}</div>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online · {mentor.college}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Not logged in */}
        {!user ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-saffron/10 border border-saffron/30 flex items-center justify-center text-3xl">
              💬
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-lg mb-2">Sign in to chat</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Create a free account to send a message to {mentor.name}.
              </p>
            </div>
            <button
              onClick={onSignInRequest}
              className="btn-primary text-sm py-3 px-6"
            >
              Sign In / Sign Up →
            </button>
          </div>
        ) : isSampleMentor ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
              👋
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-lg mb-2">Sample mentor</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {mentor.name} is a sample profile shown while our verified mentor community grows.
                Live chat opens up once real mentors join. Know someone great?
              </p>
            </div>
            <a href="/mentor-apply" className="btn-primary text-sm py-3 px-6">Invite a Mentor →</a>
          </div>
        ) : sessionError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-3xl">
              ⚠️
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-lg mb-2">Couldn&apos;t open chat</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                We couldn&apos;t start a chat session right now. Please try again in a moment.
              </p>
            </div>
            <button onClick={initSession} className="btn-primary text-sm py-3 px-6">Try Again</button>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-10">
                  <div className="text-3xl mb-3">👋</div>
                  <p className="text-gray-400 text-sm">Start the conversation with {mentor.name}!</p>
                  <p className="text-gray-600 text-xs mt-1">Ask anything about their path.</p>
                </div>
              )}

              {messages.map((msg) => {
                const isMe = msg.sender_id === user?.id
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    {!isMe && (
                      <div className={`w-8 h-8 rounded-full ${mentor.initials_bg || 'bg-saffron/20 text-saffron'} flex items-center justify-center text-xs font-bold flex-shrink-0 mt-auto`}>
                        {mentorInitials}
                      </div>
                    )}

                    <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-saffron text-white rounded-tr-sm'
                            : 'bg-white/8 border border-white/10 text-gray-200 rounded-tl-sm'
                        } ${msg.id?.toString().startsWith('opt-') ? 'opacity-70' : ''}`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-gray-600 text-[10px] px-1">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/8 p-4">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Message ${mentor.name}...`}
                  className="flex-1 bg-white/5 border border-white/10 hover:border-white/20 focus:border-saffron/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm outline-none transition-all"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!text.trim() || sending}
                  className="w-11 h-11 rounded-xl bg-saffron hover:bg-saffron-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                  aria-label="Send"
                >
                  {sending ? (
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </form>
              <p className="text-gray-600 text-[10px] mt-2 text-center">
                Messages are real-time · Mentors respond when available
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
