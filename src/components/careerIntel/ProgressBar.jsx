import XaiTooltip from './XaiTooltip'

/** ProgressBar — a labeled horizontal 0-100 bar with an XAI explanation. */
export default function ProgressBar({ label, score, explain, color = '#FF6B00', suffix = '/100' }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <XaiTooltip explain={explain}>
          <span className="text-gray-300 text-xs font-semibold">{label}</span>
        </XaiTooltip>
        <span className="text-white text-xs font-bold">{Math.round(score)}{suffix}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}
