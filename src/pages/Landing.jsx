import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'

// ── Data ──────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: '💥',
    title: 'Brutally Honest Options',
    desc: 'No sugar-coating. We tell you exactly which streams, colleges, and careers actually match your marks, budget, and reality.',
    tag: 'No fluff',
    tagColor: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(251,113,133,0.15)]',
  },
  {
    icon: '💰',
    title: 'Real College Costs',
    desc: 'Fees, hostel, books, living expenses — the full picture. Know exactly what you\'re signing up for before you sign anything.',
    tag: 'Transparent',
    tagColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(52,211,153,0.15)]',
  },
  {
    icon: '🤝',
    title: 'Talk to a Mentor Free',
    desc: 'Book a free call with someone who was in your exact shoes — same board results, same confusion. Ask them anything.',
    tag: 'No cost',
    tagColor: 'text-saffron bg-saffron/10 border-saffron/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(255,107,0,0.15)]',
  },
]

const stats = [
  { value: '40K+', label: 'Students Helped', icon: '👥' },
  { value: '₹0', label: 'Cost to Start', icon: '🎁' },
  { value: '300+', label: 'Verified Mentors', icon: '🌟' },
  { value: '12th', label: 'Pass? You Qualify', icon: '✅' },
]

const steps = [
  {
    step: '01',
    title: 'Tell us about yourself',
    desc: 'Stream, marks, family income, state — takes 3 minutes. No account needed.',
    icon: '📝',
  },
  {
    step: '02',
    title: 'Get your honest guide',
    desc: 'AI reads your real situation and gives 2–3 specific, honest career paths — not generic advice.',
    icon: '🧭',
  },
  {
    step: '03',
    title: 'Talk to a mentor',
    desc: 'Book a free call with someone who walked the same path. Real questions, real answers.',
    icon: '📞',
  },
]

const testimonials = [
  {
    quote: 'I had 72% in boards and had no idea what to do. Aage Kya showed me options I never knew existed.',
    name: 'Divya R.',
    location: 'Nagpur, Maharashtra · Now at VNIT',
    avatar: '👩‍🎓',
    color: 'from-purple-500/20 to-purple-600/5 border-purple-500/20',
  },
  {
    quote: 'My parents wanted CA. Aage Kya helped me figure out BBA Finance was actually a better fit for me.',
    name: 'Karan S.',
    location: 'Jaipur, Rajasthan · BBA at Christ University',
    avatar: '👨‍💼',
    color: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
  },
  {
    quote: 'First gen college student. Had zero guidance. This tool was like having a elder sibling who\'d been there.',
    name: 'Preethi M.',
    location: 'Coimbatore, Tamil Nadu · Now at PSG Tech',
    avatar: '👩‍💻',
    color: 'from-saffron/20 to-saffron/5 border-saffron/20',
  },
]

// ── Components ────────────────────────────────────────────────────────────────

function useCounter(target, duration = 1400, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    const numeric = parseInt(target.replace(/\D/g, ''), 10)
    if (!numeric) return
    let startTime = null
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCount(Math.floor(eased * numeric))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

function StatCard({ value, label, icon, index }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const numeric = parseInt(value.replace(/\D/g, ''), 10)
  const count = useCounter(value, 1400, visible)
  const prefix = value.startsWith('₹') ? '₹' : ''
  const suffix = value.endsWith('+') ? '+' : ''
  const displayValue = numeric ? `${prefix}${count.toLocaleString()}${suffix}` : value

  return (
    <div
      ref={ref}
      className={`text-center glass-card p-5 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-display text-2xl md:text-3xl font-bold gradient-text">{displayValue}</div>
      <div className="text-gray-400 text-xs mt-1 font-medium">{label}</div>
    </div>
  )
}

function FeatureCard({ feature, index }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.15 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`glass-card p-8 group cursor-default flex flex-col gap-5 transition-all duration-500 ${feature.glow} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Icon + tag */}
      <div className="flex items-start justify-between">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl group-hover:border-saffron/30 group-hover:scale-110 transition-all duration-300">
          {feature.icon}
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${feature.tagColor}`}>
          {feature.tag}
        </span>
      </div>

      {/* Text */}
      <div>
        <h3 className="font-display font-bold text-xl text-white mb-3 group-hover:text-saffron transition-colors duration-200">
          {feature.title}
        </h3>
        <p className="text-gray-400 leading-relaxed text-sm">
          {feature.desc}
        </p>
      </div>

      {/* CTA */}
      <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
        <Link
          to="/onboarding"
          className="text-saffron text-sm font-semibold hover:underline underline-offset-2 transition-all"
        >
          {index === 2 ? 'Find a Mentor →' : 'Get Started →'}
        </Link>
        <div className="w-7 h-7 rounded-full bg-saffron/10 group-hover:bg-saffron/25 flex items-center justify-center transition-colors">
          <svg className="w-3.5 h-3.5 text-saffron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Landing() {
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  // Auto-rotate testimonials
  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial(i => (i + 1) % testimonials.length), 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <main className="pt-16 overflow-x-hidden">

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">

        {/* Layered ambient background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Main mesh gradient */}
          <div className="absolute inset-0 bg-mesh opacity-80" />
          {/* Big saffron orb top-right */}
          <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-saffron/10 rounded-full blur-[140px] animate-float-slow" />
          {/* Subtle blue orb bottom-left */}
          <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />
          {/* Center glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-saffron/4 rounded-full blur-[100px]" />
        </div>

        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Top accent line */}
        <div className="absolute top-16 left-0 right-0 h-px bg-gradient-to-r from-transparent via-saffron/30 to-transparent" />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2.5 bg-saffron/10 border border-saffron/25 rounded-full px-5 py-2 mb-10 animate-fade-in">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-saffron opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-saffron" />
            </span>
            <span className="text-saffron text-sm font-semibold tracking-wide">
              Free for Class 10 &amp; 12 students &amp; graduates
            </span>
          </div>

          {/* Headline */}
          <h1
            className="font-display font-black leading-[1.08] mb-6 text-white text-balance"
            style={{ fontSize: 'clamp(2.6rem, 7.5vw, 5.5rem)', animationDelay: '50ms' }}
          >
            Board results are out.{' '}
            <span className="relative inline-block mt-1">
              <span className="gradient-text">Now what?</span>
              {/* Animated underline */}
              <svg
                className="absolute -bottom-2 left-0 w-full"
                height="6" viewBox="0 0 200 6" preserveAspectRatio="none"
                fill="none" xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0 3 Q25 0.5 50 3 Q75 5.5 100 3 Q125 0.5 150 3 Q175 5.5 200 3"
                  stroke="url(#underlineGrad)" strokeWidth="2.5" strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="underlineGrad" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FF6B00" />
                    <stop offset="100%" stopColor="#FF8C33" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className="text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', animationDelay: '120ms' }}
          >
            Honest, personalized guidance for students who have{' '}
            <span className="text-white font-semibold">no one to ask</span>.
            <br className="hidden sm:block" />
            No coaching class pitch. No sponsored rankings. Just the truth.
          </p>

          {/* CTA group */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-slide-up"
            style={{ animationDelay: '200ms' }}
          >
            <Link
              to="/class10/onboarding"
              id="hero-cta-10"
              className="btn-primary text-base px-8 py-4 animate-pulse-glow font-semibold tracking-wide flex items-center gap-2"
            >
              <span>10th Passer</span>
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded">Stream selection</span>
            </Link>
            <Link
              to="/class12/onboarding"
              id="hero-cta-12"
              className="btn-primary text-base px-8 py-4 animate-pulse-glow font-semibold tracking-wide flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-500/30 hover:from-purple-500 hover:to-indigo-500 shadow-purple-500/20"
            >
              <span>12th Passer</span>
              <span className="text-xs bg-black/20 px-2 py-0.5 rounded">College & Career</span>
            </Link>
            <Link to="/mentors" className="btn-outline text-base px-8 py-4 font-semibold">
              Talk to a Mentor Free
            </Link>
          </div>

          {/* Trust row */}
          <div
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-gray-500 text-xs mb-20 animate-fade-in"
            style={{ animationDelay: '300ms' }}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              No login required
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              100% free
            </span>
            <span className="w-px h-3 bg-white/10" />
            <span className="flex items-center gap-1.5">🇮🇳 Built for India</span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
            {stats.map((s, i) => (
              <StatCard key={s.label} value={s.value} label={s.label} icon={s.icon} index={i} />
            ))}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A0F1E] to-transparent pointer-events-none" />
      </section>

      {/* ── CONTEXT STRIP ── */}
      <section className="py-8 border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-gray-400 text-center">
          {[
            { icon: '🎓', text: 'PCM / PCB / Commerce / Arts — all streams' },
            { icon: '🏫', text: 'Government & private college options' },
            { icon: '💸', text: 'Scholarships you actually qualify for' },
            { icon: '🗺️', text: 'Tier 2 & Tier 3 city friendly' },
          ].map((item) => (
            <span key={item.text} className="flex items-center gap-2 font-medium hover:text-white transition-colors duration-200">
              <span>{item.icon}</span>
              {item.text}
            </span>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-30 pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">

          <div className="text-center mb-16">
            <div className="inline-block bg-saffron/10 border border-saffron/20 rounded-full px-4 py-1.5 text-saffron text-xs font-semibold tracking-widest uppercase mb-4">
              How it works
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
              3 steps to clarity
            </h2>
            <p className="text-gray-400 text-lg max-w-lg mx-auto">
              From confusion to a clear path — in under 5 minutes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connecting line (desktop) */}
            <div className="hidden md:block absolute top-10 left-1/6 right-1/6 h-px bg-gradient-to-r from-saffron/30 via-saffron/60 to-saffron/30 z-0" />

            {steps.map((step) => (
              <div
                key={step.step}
                className="relative glass-card p-8 text-center group hover:scale-[1.02] transition-all duration-300 z-10"
              >
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-saffron/15 border-2 border-saffron/30 text-saffron font-display font-bold text-lg mb-5 group-hover:bg-saffron/25 group-hover:border-saffron/50 transition-all duration-300">
                  {step.step}
                </div>
                <div className="text-3xl mb-4">{step.icon}</div>
                <h3 className="font-display font-bold text-lg text-white mb-3 group-hover:text-saffron transition-colors">
                  {step.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          {/* CTA below steps */}
          <div className="text-center mt-12">
            <Link to="/onboarding" className="btn-primary px-8 py-4 text-base font-semibold">
              Start Now — It's Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-16">
            <div className="inline-block bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-gray-400 text-xs font-semibold tracking-widest uppercase mb-4">
              What you get
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
              Guidance that actually helps
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Not vague advice. Not a newsletter. Real, actionable guidance.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FeatureCard key={feature.title} feature={feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── EXPLORE MODULES ── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-20 pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-14">
            <div className="inline-block bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-1.5 text-purple-300 text-xs font-semibold tracking-widest uppercase mb-4">
              Explore More
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
              Everything you need, <span className="gradient-text">one platform.</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Beyond career guidance — exams, scholarships, study abroad, and interactive roadmaps.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Career Pipeline */}
            <Link to="/career-pipeline" className="group glass-card-glow p-8 flex flex-col gap-4 hover:scale-[1.02] transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                🗺️
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-emerald-400 transition-colors">
                  Career Pipeline
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Interactive roadmaps from your current stage to your dream career. Explore 6+ career paths with skills, salaries, and milestones.
                </p>
              </div>
              <div className="mt-auto pt-3 border-t border-white/5">
                <span className="text-emerald-400 text-sm font-semibold group-hover:underline">Explore Careers →</span>
              </div>
            </Link>

            {/* Competitive Exams */}
            <Link to="/competitive-exams" className="group glass-card-glow p-8 flex flex-col gap-4 hover:scale-[1.02] transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                🎯
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-blue-400 transition-colors">
                  Exam Predictor
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Enter your KCET, JEE, NEET, or COMEDK rank and see which colleges and branches you can get. Interactive counselling simulator included.
                </p>
              </div>
              <div className="mt-auto pt-3 border-t border-white/5">
                <span className="text-blue-400 text-sm font-semibold group-hover:underline">Check Your Rank →</span>
              </div>
            </Link>

            {/* Study Abroad */}
            <Link to="/study-abroad" className="group glass-card-glow p-8 flex flex-col gap-4 hover:scale-[1.02] transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                ✈️
              </div>
              <div>
                <h3 className="font-display font-bold text-xl text-white mb-2 group-hover:text-purple-400 transition-colors">
                  Study Abroad
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Complete guides for 8 countries — universities, costs, visas, scholarships, work permits, and PR pathways.
                </p>
              </div>
              <div className="mt-auto pt-3 border-t border-white/5">
                <span className="text-purple-400 text-sm font-semibold group-hover:underline">Explore Countries →</span>
              </div>
            </Link>
          </div>

          {/* Bottom row: Scholarships + College Overview + Become a Mentor */}
          <div className="mt-5 grid sm:grid-cols-3 gap-4">
            <Link to="/scholarships" className="glass-card p-5 flex items-center gap-4 hover:border-amber-500/30 hover:scale-[1.01] transition-all group">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl flex-shrink-0">💰</div>
              <div>
                <p className="text-white font-bold text-sm">Scholarship Directory</p>
                <p className="text-gray-500 text-xs">18+ scholarships for every level</p>
              </div>
              <span className="ml-auto text-amber-400 text-xs font-semibold group-hover:underline">Browse →</span>
            </Link>

            <Link to="/college/rvce" className="glass-card p-5 flex items-center gap-4 hover:border-blue-500/30 hover:scale-[1.01] transition-all group">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xl flex-shrink-0">🏫</div>
              <div>
                <p className="text-white font-bold text-sm">College Overview</p>
                <p className="text-gray-500 text-xs">Fees, placements & reviews</p>
              </div>
              <span className="ml-auto text-blue-400 text-xs font-semibold group-hover:underline">View →</span>
            </Link>

            <Link to="/mentor-apply" className="glass-card p-5 flex items-center gap-4 hover:border-saffron/30 hover:scale-[1.01] transition-all group">
              <div className="w-11 h-11 rounded-xl bg-saffron/10 border border-saffron/20 flex items-center justify-center text-xl flex-shrink-0">🌟</div>
              <div>
                <p className="text-white font-bold text-sm">Become a Mentor</p>
                <p className="text-gray-500 text-xs">Guide the next generation</p>
              </div>
              <span className="ml-auto text-saffron text-xs font-semibold group-hover:underline">Apply →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-saffron/[0.03] to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              Real students. Real stories.
            </h2>
            <p className="text-gray-400">From confusion to confidence — one student at a time.</p>
          </div>

          {/* Testimonial carousel */}
          <div className="relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}
              >
                {testimonials.map((t, i) => (
                  <div key={i} className="w-full flex-shrink-0 px-2">
                    <div className={`glass-card p-10 text-center relative overflow-hidden border bg-gradient-to-br ${t.color}`}>
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                      <div className="text-5xl font-display text-white/20 mb-4 leading-none">"</div>
                      <blockquote className="text-gray-200 text-lg md:text-xl leading-relaxed mb-8 font-medium text-balance">
                        {t.quote}
                      </blockquote>

                      <div className="flex items-center justify-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xl">
                          {t.avatar}
                        </div>
                        <div className="text-left">
                          <div className="text-white font-semibold text-sm">{t.name}</div>
                          <div className="text-gray-500 text-xs">{t.location}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dots */}
            <div className="flex items-center justify-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeTestimonial
                      ? 'bg-saffron w-6'
                      : 'bg-white/20 w-1.5 hover:bg-white/40'
                  }`}
                  aria-label={`View testimonial ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative glass-card p-12 overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-saffron/10 via-transparent to-purple-900/10 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-saffron/50 to-transparent" />
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-saffron/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-block text-4xl mb-6">🧭</div>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
                Stop guessing.{' '}
                <span className="gradient-text">Start knowing.</span>
              </h2>
              <p className="text-gray-400 mb-8 text-base md:text-lg max-w-xl mx-auto">
                Takes 3 minutes. Completely free. No login needed.
                Get a guide that's actually written for <em>your</em> situation.
              </p>

              <Link
                to="/onboarding"
                id="footer-cta"
                className="btn-primary text-base px-10 py-4 inline-flex"
              >
                Get Your Honest Guide
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <p className="text-gray-600 text-xs mt-6">
                Already used by 40,000+ students across India
              </p>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}

// ─── Floating chatbot trigger ─────────────────────────────────────────────────
// Visible to users who haven't completed onboarding yet.

export function ChatFloatingButton() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Show only if user hasn't done onboarding yet
    const hasFormData = Boolean(localStorage.getItem('aageKyaFormData'))
    if (!hasFormData && !dismissed) setVisible(true)
  }, [dismissed])

  if (!visible || dismissed) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div className="relative">
        {/* Dismiss button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-navy-800 border border-white/20 text-gray-500 hover:text-white flex items-center justify-center text-xs transition-colors z-10"
          aria-label="Dismiss"
        >
          ✕
        </button>
        {/* Main button */}
        <Link
          to="/chat"
          className="flex items-center gap-3 bg-navy-900 border border-indigo-500/30 hover:border-indigo-500/60 rounded-2xl px-4 py-3 shadow-2xl shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 group"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform">
            🤖
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-tight">Have a quick question?</p>
            <p className="text-indigo-400 text-[10px] mt-0.5">Ask me anything about courses →</p>
          </div>
        </Link>
        {/* Pulse ring */}
        <div className="absolute -inset-1 rounded-2xl bg-indigo-500/10 animate-pulse -z-10" />
      </div>
    </div>
  )
}
