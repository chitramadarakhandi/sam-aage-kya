import { useState } from 'react'
import XaiTooltip from './XaiTooltip'

/**
 * LineChart — pure-SVG multi-series line chart (no external chart lib).
 * Used for salary timelines and demand/growth trend lines. Hovering any
 * point shows its exact value; the chart title carries the XAI badge.
 *
 * series: [{ name, color, points: [{x, y}] }]
 */
export default function LineChart({ title, explain, series, xLabel, yLabel, height = 220, valueFormatter = (v) => v }) {
  const [hover, setHover] = useState(null) // { seriesIdx, pointIdx }
  const width = 520
  const padding = { top: 16, right: 16, bottom: 32, left: 44 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const allPoints = series.flatMap((s) => s.points)
  const xs = allPoints.map((p) => p.x)
  const ys = allPoints.map((p) => p.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = 0, yMax = Math.max(...ys) * 1.15 || 1

  const px = (x) => padding.left + ((x - xMin) / (xMax - xMin || 1)) * innerW
  const py = (y) => padding.top + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMin + (yMax - yMin) * f))

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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
        {/* Gridlines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={py(t)} y2={py(t)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={padding.left - 8} y={py(t)} textAnchor="end" alignmentBaseline="middle" fontSize="9" fill="#6b7280">{valueFormatter(t)}</text>
          </g>
        ))}
        {/* X axis labels */}
        {series[0]?.points.map((p, i) => (
          <text key={i} x={px(p.x)} y={height - 10} textAnchor="middle" fontSize="9" fill="#6b7280">{p.x}{xLabel ? '' : ''}</text>
        ))}

        {/* Lines + points */}
        {series.map((s, si) => (
          <g key={s.name}>
            <polyline
              fill="none" stroke={s.color} strokeWidth="2.5"
              points={s.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
              className="drop-shadow"
            />
            {s.points.map((p, pi) => {
              const isHover = hover && hover.seriesIdx === si && hover.pointIdx === pi
              return (
                <circle
                  key={pi} cx={px(p.x)} cy={py(p.y)} r={isHover ? 5 : 3.5}
                  fill={s.color} stroke="#0A0F1E" strokeWidth="1.5"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHover({ seriesIdx: si, pointIdx: pi })}
                  onMouseLeave={() => setHover(null)}
                />
              )
            })}
          </g>
        ))}

        {/* Hover tooltip */}
        {hover && (() => {
          const s = series[hover.seriesIdx]
          const p = s.points[hover.pointIdx]
          const tx = Math.min(Math.max(px(p.x), padding.left + 40), width - padding.right - 40)
          return (
            <g>
              <rect x={tx - 42} y={py(p.y) - 38} width="84" height="26" rx="6" fill="#0D1117" stroke={s.color} strokeWidth="1" />
              <text x={tx} y={py(p.y) - 21} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="bold">
                {xLabel ? `${xLabel} ${p.x}: ` : ''}{valueFormatter(p.y)}
              </text>
            </g>
          )
        })()}
      </svg>
      {yLabel && <p className="text-gray-500 text-[10px] mt-1 text-center">{yLabel}</p>}
    </div>
  )
}
