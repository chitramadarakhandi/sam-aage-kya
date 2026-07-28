import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CATEGORIES,
  TRACKS,
  platformsForAudience,
  resolvePlatforms,
} from '../data/onlineEducation'

const PRICING_BADGE = {
  free: { label: 'Free', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  freemium: { label: 'Free + Paid', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  paid: { label: 'Paid', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
}

function PlatformCard({ platform }) {
  const badge = PRICING_BADGE[platform.pricing] || PRICING_BADGE.paid
  return (
    <motion.a
      href={platform.url}
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      className="glass-card p-5 flex flex-col gap-3 border-white/10 hover:border-saffron/40 transition-all group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
            {platform.emoji}
          </div>
          <div>
            <h3 className="font-display font-bold text-white text-sm leading-tight group-hover:text-saffron transition-colors">
              {platform.name}
            </h3>
            <p className="text-gray-500 text-[11px] mt-0.5">{platform.category}</p>
          </div>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-bold border rounded-full px-2 py-1 ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      <p className="text-gray-300 text-xs leading-relaxed">{platform.focus}</p>
      <p className="text-gray-500 text-[11px] leading-relaxed">
        <span className="text-gray-400 font-semibold">Best for:</span> {platform.bestFor}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
        {platform.tags.map((t) => (
          <span key={t} className="text-[10px] bg-navy-800 border border-white/8 text-gray-400 px-2 py-0.5 rounded">
            {t}
          </span>
        ))}
      </div>

      <span className="inline-flex items-center gap-1 text-saffron text-xs font-semibold pt-1">
        Visit official site
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </span>
    </motion.a>
  )
}

function TrackCard({ track }) {
  const platforms = resolvePlatforms(track.platforms)
  return (
    <div className="glass-card p-6 border-saffron/20 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-saffron/10 border border-saffron/25 flex items-center justify-center text-2xl">
          {track.emoji}
        </div>
        <h3 className="font-display font-bold text-white text-base leading-tight">{track.title}</h3>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed">{track.desc}</p>

      <div className="flex flex-wrap gap-2">
        {platforms.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs bg-navy-800 border border-white/10 hover:border-saffron/40 text-gray-300 hover:text-saffron px-2.5 py-1.5 rounded-lg transition-all"
          >
            <span>{p.emoji}</span>
            {p.name}
          </a>
        ))}
      </div>

      <div className="flex items-start gap-2 bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3 mt-auto">
        <span className="text-emerald-400 text-sm flex-shrink-0">✅</span>
        <p className="text-emerald-200 text-xs leading-relaxed">
          <span className="font-semibold">First step:</span> {track.firstStep}
        </p>
      </div>
    </div>
  )
}

export default function OnlineEducation() {
  const [audience, setAudience] = useState('class12')
  const [category, setCategory] = useState('All')

  const platforms = useMemo(() => {
    const base = platformsForAudience(audience)
    return category === 'All' ? base : base.filter((p) => p.category === category)
  }, [audience, category])

  const tracks = TRACKS[audience] || []

  return (
    <main className="pt-24 pb-24 min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-saffron/10 border border-saffron/25 rounded-full px-4 py-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-saffron animate-pulse" />
            <span className="text-saffron text-sm font-semibold">Learn Online · After 10th & 12th</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-3">
            Online Education,{' '}
            <span className="gradient-text">made simple</span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto">
            Real platforms — from free government courses to top coaching apps — matched to where you are and where you want to go.
          </p>
        </div>

        {/* Audience toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-navy-800 border border-white/10 rounded-2xl p-1">
            {[
              ['class10', 'After Class 10'],
              ['class12', 'After Class 12'],
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setAudience(val)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  audience === val
                    ? 'bg-saffron text-white shadow-lg shadow-saffron/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Suggested tracks */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xl">🧭</span>
            <h2 className="font-display font-bold text-xl text-white">Where should I start?</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tracks.map((t) => (
              <TrackCard key={t.id} track={t} />
            ))}
          </div>
        </section>

        {/* Platforms */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🖥️</span>
              <h2 className="font-display font-bold text-xl text-white">Explore Platforms</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {['All', ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    category === cat
                      ? 'bg-saffron border-saffron text-white'
                      : 'bg-navy-800 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {platforms.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10">No platforms in this category for this level.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {platforms.map((p) => (
                <PlatformCard key={p.id} platform={p} />
              ))}
            </div>
          )}
        </section>

        {/* Honest note */}
        <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl px-5 py-4 mt-12 max-w-3xl mx-auto">
          <span className="text-xl flex-shrink-0">💡</span>
          <div>
            <p className="text-amber-300 text-sm font-semibold">Pick one, go deep, and prefer free first.</p>
            <p className="text-amber-200/70 text-xs mt-0.5 leading-relaxed">
              Don&apos;t buy three courses at once. Try the free content first, and always confirm current prices and course details on the official website — plans change often. We are not affiliated with these platforms.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-400 text-sm mb-4">Not sure which path these courses lead to?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/onboarding" className="btn-primary text-sm px-7 py-3 inline-block">
              Get Personalised Guidance →
            </Link>
            <Link to="/mentors" className="btn-outline text-sm px-7 py-3 inline-block">
              Talk to a Mentor
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
