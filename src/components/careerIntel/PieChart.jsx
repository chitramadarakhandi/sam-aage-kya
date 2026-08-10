import { useState } from 'react'
import XaiTooltip from './XaiTooltip'

/**
 * PieChart — pure-SVG donut/pie chart. Used for category distribution
 * (e.g. Top 100 rankings breakdown by category) and skill/time allocation
 * style visuals. Hovering a slice highlights it and shows its value.
 *
 * slices: [{ label, value, color }]
 */
export default function PieChart({ title, explain, slices, size = 200, donut = true }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const center = size / 2
  const radius = size / 2 - 8
  const innerRadius = donut ? radius * 0.55 : 0

  let cumulative = 0
  const arcs = slices.map((s) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    cumulative += s.value
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    return { ...s, startAngle, endAngle, pct: Math.round((s.value / total) * 100) }
  })

  function arcPath(startAngle, endAngle, r, ir) {
    const x1 = center + r * Math.cos(startAngle), y1 = center + r * Math.sin(startAngle)
    const x2 = center + r * Math.cos(endAngle), y2 = center + r * Math.sin(endAngle)
    const ix1 = center + ir * Math.cos(endAngle), iy1 = center + ir * Math.sin(endAngle)
    const ix2 = center + ir * Math.cos(startAngle), iy2 = center + ir * Math.sin(startAngle)
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${largeArc} 0 ${ix2} ${iy2} Z`
  }

  return (
    <div className="glass-card border-white/5 p-4 sm:p-5">
      <div className="mb-3">
        <XaiTooltip explain={explain}>
          <h4 className="font-display text-sm font-bold text-white">{title}</h4>
        </XaiTooltip>
      </div>
      <div className="flex items-center gap-5 flex-wrap justify-center">
        <svg width={size} height={size}>
          {arcs.map((a, i) => (
            <path
              key={a.label}
              d={arcPath(a.startAngle, a.endAngle, hoverIdx === i ? radius + 4 : radius, innerRadius)}
              fill={a.color}
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.45}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
          {donut && hoverIdx !== null && (
            <text x={center} y={center} textAnchor="middle" alignmentBaseline="middle" fontSize="16" fill="#fff" fontWeight="bold">
              {arcs[hoverIdx].pct}%
            </text>
          )}
        </svg>
        <div className="space-y-1.5">
          {arcs.map((a, i) => (
            <button
              key={a.label}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className={`flex items-center gap-2 text-[11px] transition-opacity ${hoverIdx === null || hoverIdx === i ? 'text-gray-300' : 'text-gray-600'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: a.color }} />
              {a.label} <span className="text-gray-500">({a.pct}%)</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
