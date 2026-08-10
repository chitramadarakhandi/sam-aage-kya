import { useState, useRef, useEffect } from 'react'

/**
 * XaiTooltip — the core "Explainable AI" interaction primitive used across
 * every chart in the Career Intelligence Hub. Wrap any score/graph element
 * with this and pass an `explain` string; it renders an info affordance
 * that reveals the reasoning on hover (desktop) or tap (mobile), and can
 * also be pinned open via a click so the explanation persists while the
 * user reads a chart.
 *
 * This is intentionally a small, dependency-free component (no portal /
 * positioning library) — it renders inline so it never fights with the
 * existing app's global CSS or z-index stack.
 */
export default function XaiTooltip({ explain, label = 'Why this score?', children, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <span className="relative inline-flex items-center gap-1.5" ref={ref}>
      {children}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        onMouseEnter={() => setOpen(true)}
        aria-label={label}
        className="w-4 h-4 rounded-full bg-white/10 hover:bg-saffron/30 text-gray-400 hover:text-saffron text-[10px] font-bold flex items-center justify-center transition-colors flex-shrink-0"
      >
        i
      </button>
      {open && (
        <div
          className={`absolute z-40 top-full mt-2 w-64 sm:w-72 p-3.5 rounded-xl bg-[#0D1117] border border-saffron/25 shadow-elevated text-[11px] leading-relaxed text-gray-300 animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <p className="text-saffron text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
            🧠 Explainable AI
          </p>
          {explain}
        </div>
      )}
    </span>
  )
}
