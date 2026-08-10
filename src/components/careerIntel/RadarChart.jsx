import { useState } from 'react'
import XaiTooltip from './XaiTooltip'

/**
 * RadarChart — pure-SVG radar/spider chart. Used for the multi-axis
 * "career profile" view (Salary, Demand, Stability, Low AI Risk, ROI,
 * Work-Life, Global) and for side-by-side career comparison (up to 3
 * overlaid series with distinct colors).
 *
 * axes: [{ key, label }]
 * series: [{ name, color, values: { [axisKey]: 0-100 } }]
 */
export default function RadarChart({ title, explain, axes, series, size = 280 }) {
  const [hoverAxis, setHoverAxis] = useState(null)
  const center = size / 2
  const radius = size / 2 - 48
  const angleStep = (2 * Math.PI) / axes.length

  const pointFor = (axisIdx, value) => {
    const angle = angleStep * axisIdx - Math.PI / 2
    const r = (value / 100) * radius
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }
  }
  const labelPointFor = (axisIdx) => {
    const angle = angleStep * axisIdx - Math.PI / 2
    const r = radius + 28
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) }
  }

  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <div className="glass-card border-white/5 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <XaiTooltip explain={explain}>
          <h4 className="font-display text-sm font-bold text-white">{title}</h4>
        </XaiTooltip>
        <div className="flex items-center gap-3 flex-wrap">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div className="flex justify-center">
        <svg width={size} height={size}>
          {/* Concentric rings */}
          {rings.map((f, i) => (
            <polygon
              key={i}
              points={axes.map((_, ai) => {
                const p = pointFor(ai, f * 100)
                return `${p.x},${p.y}`
              }).join(' ')}
              fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
            />
          ))}
          {/* Axis spokes */}
          {axes.map((ax, ai) => {
            const p = pointFor(ai, 100)
            return <line key={ax.key} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          })}
          {/* Series polygons */}
          {series.map((s) => (
            <polygon
              key={s.name}
              points={axes.map((ax, ai) => {
                const p = pointFor(ai, s.values[ax.key] ?? 0)
                return `${p.x},${p.y}`
              }).join(' ')}
              fill={s.color} fillOpacity="0.18" stroke={s.color} strokeWidth="2"
            />
          ))}
          {/* Data points (hoverable, from first series primarily but show all) */}
          {series.map((s) => axes.map((ax, ai) => {
            const p = pointFor(ai, s.values[ax.key] ?? 0)
            return (
              <circle
                key={`${s.name}-${ax.key}`} cx={p.x} cy={p.y} r={hoverAxis === `${s.name}-${ax.key}` ? 5 : 3}
                fill={s.color} stroke="#0A0F1E" strokeWidth="1"
                className="cursor-pointer"
                onMouseEnter={() => setHoverAxis(`${s.name}-${ax.key}`)}
                onMouseLeave={() => setHoverAxis(null)}
              />
            )
          }))}
          {/* Hover value label */}
          {series.map((s) => axes.map((ax, ai) => {
            if (hoverAxis !== `${s.name}-${ax.key}`) return null
            const p = pointFor(ai, s.values[ax.key] ?? 0)
            return (
              <g key={`label-${s.name}-${ax.key}`}>
                <rect x={p.x - 20} y={p.y - 24} width="40" height="18" rx="5" fill="#0D1117" stroke={s.color} />
                <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">{s.values[ax.key]}</text>
              </g>
            )
          }))}
          {/* Axis labels */}
          {axes.map((ax, ai) => {
            const p = labelPointFor(ai)
            return (
              <text key={ax.key} x={p.x} y={p.y} textAnchor="middle" alignmentBaseline="middle" fontSize="9" fill="#9ca3af">
                {ax.label}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
