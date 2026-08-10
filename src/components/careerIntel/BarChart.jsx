import { useState } from 'react'
import XaiTooltip from './XaiTooltip'

/**
 * BarChart — pure-SVG vertical bar chart. Used for comparisons (salary by
 * career, demand by career) and single-series breakdowns. Hovering a bar
 * shows its exact value.
 *
 * bars: [{ label, value, color, explain? }]
 */
export default function BarChart({ title, explain, bars, height = 220, valueFormatter = (v) => v, unit = '' }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const width = Math.max(320, bars.length * 70)
  const padding = { top: 24, right: 16, bottom: 40, left: 40 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const maxVal = Math.max(...bars.map((b) => b.value), 1) * 1.15
  const barWidth = Math.min(48, innerW / bars.length - 16)
  const gap = innerW / bars.length

  const py = (v) => padding.top + innerH - (v / maxVal) * innerH

  return (
    <div className="glass-card border-white/5 p-4 sm:p-5">
      <div className="mb-3">
        <XaiTooltip explain={explain}>
          <h4 className="font-display text-sm font-bold text-white">{title}</h4>
        </XaiTooltip>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} style={{ maxHeight: height, minWidth: 320 }}>
          <line x1={padding.left} x2={width - padding.right} y1={padding.top + innerH} y2={padding.top + innerH} stroke="rgba(255,255,255,0.1)" />
          {bars.map((b, i) => {
            const x = padding.left + i * gap + (gap - barWidth) / 2
            const y = py(b.value)
            const h = padding.top + innerH - y
            const isHover = hoverIdx === i
            return (
              <g key={b.label}>
                <rect
                  x={x} y={y} width={barWidth} height={h} rx="6"
                  fill={b.color || '#FF6B00'} opacity={isHover ? 1 : 0.85}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
                {isHover && (
                  <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="bold">
                    {valueFormatter(b.value)}{unit}
                  </text>
                )}
                <text x={x + barWidth / 2} y={padding.top + innerH + 16} textAnchor="middle" fontSize="9" fill="#9ca3af">
                  {b.label.length > 10 ? b.label.slice(0, 9) + '…' : b.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
