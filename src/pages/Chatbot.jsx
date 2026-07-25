import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { postChat } from '../api'

// ─── Quick question chips ─────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  'What is PCM and what can I do with it?',
  'What is CUET and how do I prepare for it?',
  'What is the difference between JEE Main and JEE Advanced?',
  'What careers can I get after Commerce stream?',
  'Is NEET required for all medical courses?',
  'What are my options if I don\'t clear NEET?',
  'What is the reality of Arts stream in India?',
  'What is a Polytechnic Diploma and is it worth it?',
]

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
        isUser
          ? 'bg-saffron text-white font-bold'
          : 'bg-indigo-500/20 border border-indigo-500/30 text-lg'
      }`}>
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-saffron text-white rounded-tr-md'
            : 'bg-white/6 border border-white/10 text-gray-200 rounded-tl-md'
        }`}>
          {msg.content}
        </div>

        {/* Handoff CTA */}
        {!isUser && msg.handoff && (
          <div className="bg-saffron/10 border border-saffron/25 rounded-xl p-4 mt-1 w-full max-w-sm animate-fade-in">
            <p className="text-saffron text-xs font-bold uppercase tracking-wider mb-1">
              ✨ For this, you need personalised guidance
            </p>
            <p className="text-gray-300 text-xs mb-3 leading-relaxed">
              {msg.handoff_reason || 'This question needs your marks, state, income, and interests to answer properly.'}
            </p>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-saffron text-white px-4 py-2 rounded-lg hover:bg-saffron-light transition-colors"
            >
              Get Personalised Guidance →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-lg flex-shrink-0">
        🤖
      </div>
      <div className="bg-white/6 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Chatbot page ────────────────────────────────────────────────────────

export default function Chatbot() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm here to answer your questions about courses, streams, entrance exams, and career paths in India. 🇮🇳\n\nAsk me anything — "What is PCM?", "Is NEET required for MBBS?", or any general question. If your question needs personalised guidance (based on your marks, income, or state), I'll help you get there.\n\nWhat's on your mind?`,
      handoff: false,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [quickQuestions, setQuickQuestions] = useState(QUICK_QUESTIONS)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Dynamically update quickQuestions based on student profile
  useEffect(() => {
    if (profile) {
      const q = []
      if (profile.class_level === 'class10') {
        q.push(`I am in Class 10. Recommend streams & courses based on my profile.`)
        q.push(`What streams are best if I got ${profile.marks || 'good'} marks?`)
        if (profile.state) {
          q.push(`What are the best colleges in ${profile.state} after Class 10?`)
        }
        q.push(`Tell me about scholarships for 10th students.`)
      } else if (profile.class_level === 'class12') {
        const streamStr = profile.stream ? ` (${profile.stream})` : ''
        q.push(`What are the best career paths after Class 12${streamStr}?`)
        if (profile.stream) {
          q.push(`Which entrance exams should I write for 12th ${profile.stream}?`)
        } else {
          q.push(`What is the difference between JEE and NEET?`)
        }
        if (profile.state) {
          q.push(`Recommend colleges in ${profile.state} for Class 12 students.`)
        }
        q.push(`What scholarships can a 12th student apply for?`)
      } else {
        q.push('What is the best way to prepare for competitive exams?')
        q.push('How can I apply to study abroad?')
        q.push('How can I get matched with a mentor?')
      }
      setQuickQuestions(q)
    }
  }, [profile])

  const sendMessage = async (text) => {
    const userText = (text || input).trim()
    if (!userText || loading) return

    setInput('')
    setError('')

    const newUserMsg = { role: 'user', content: userText }
    const updatedMessages = [...messages, newUserMsg]
    setMessages(updatedMessages)
    setLoading(true)

    try {
      // Send last 6 messages as context (stateless server, context held client-side)
      const contextWindow = updatedMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await postChat(contextWindow, profile)

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        handoff: data.handoff || false,
        handoff_reason: data.handoff_reason || '',
      }])
    } catch (err) {
      setError(err.message || 'Could not connect to the server. Please try again.')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Sorry, I couldn\'t process that right now. Please try again in a moment.',
        handoff: false,
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasOnlyIntro = messages.length === 1

  return (
    <main className="pt-20 pb-0 min-h-screen flex flex-col">
      {/* Page header */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 border-b border-white/8 flex-shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <h1 className="text-white font-display font-bold text-lg leading-tight">Ask Anything</h1>
                <p className="text-gray-500 text-xs mt-0.5">General career & course queries · No sign-in needed</p>
              </div>
            </div>
            <Link
              to="/onboarding"
              className="flex-shrink-0 text-xs font-bold bg-saffron/15 border border-saffron/30 text-saffron hover:bg-saffron/25 px-3 py-2 rounded-lg transition-all"
            >
              Full Guidance →
            </Link>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-2xl mx-auto space-y-5">

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {loading && <TypingIndicator />}

          {/* Quick question chips — only show at start */}
          {hasOnlyIntro && !loading && (
            <div className="pt-2 animate-fade-in">
              <p className="text-gray-600 text-xs mb-3 text-center">Or try a quick question:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="text-xs bg-white/4 border border-white/10 text-gray-300 hover:border-saffron/40 hover:text-white hover:bg-saffron/8 px-3 py-2 rounded-xl transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 border-t border-white/8 bg-navy/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-2xl mx-auto">
          {error && (
            <p className="text-rose-400 text-xs mb-2 text-center">{error}</p>
          )}
          <div className="flex items-end gap-3">
            <div className="flex-1 bg-navy-800 border border-white/12 rounded-2xl px-4 py-3 focus-within:border-saffron/40 transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  // Auto-resize
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything — 'What is NEET?', 'Best path after Commerce?'..."
                className="w-full bg-transparent text-white placeholder-gray-600 text-sm resize-none outline-none leading-relaxed"
                style={{ minHeight: '24px', maxHeight: '120px' }}
                disabled={loading}
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-xl bg-saffron hover:bg-saffron-light disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all shadow-lg shadow-saffron/20"
              aria-label="Send message"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-gray-700 text-[10px] text-center mt-2">
            For personalised guidance based on your marks and situation →{' '}
            <Link to="/onboarding" className="text-saffron hover:underline">Start the full form</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
