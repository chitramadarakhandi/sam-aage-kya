import XaiTooltip from './XaiTooltip'

/**
 * ScoreGauge — a circular 0-100 gauge (pure SVG, no chart library) used
 * for headline scores like Career Fit, Job Security, ROI, etc. Every
 * gauge is wrapped in an XaiTooltip so clicking/hovering the (i) badge
 * reveals exactly how the number was computed.
 */
export default function ScoreGauge({ label, score, explain, color = '#FF6B00', size = 96, suffix = '/100' }) {
  const r = (size - 12) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - pct / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-white" style={{ fontSize: size * 0.24 }}>{Math.round(score)}</span>
          <span className="text-gray-500 text-[9px]">{suffix}</span>
        </div>
      </div>
      <XaiTooltip explain={explain}>
        <span className="text-gray-300 text-xs font-semibold text-center">{label}</span>
      </XaiTooltip>
    </div>
  )
}
