import { useState } from 'react'
import XaiTooltip from './XaiTooltip'

/**
 * Heatmap — a simple grid heatmap (rows × cols, 0-100 intensity per cell)
 * rendered as colored divs (no SVG needed here — CSS grid is simplest and
 * most responsive for this shape). Used for "Category × Metric" overview
 * grids and skills-coverage matrices.
 *
 * rows: string[]; cols: string[]; values: number[][] (rows x cols, 0-100)
 */
export default function Heatmap({ title, explain, rows, cols, values, color = '255,107,0' }) {
  const [hoverCell, setHoverCell] = useState(null)

  return (
    <div className="glass-card border-white/5 p-4 sm:p-5">
      <div className="mb-3">
        <XaiTooltip explain={explain}>
          <h4 className="font-display text-sm font-bold text-white">{title}</h4>
        </XaiTooltip>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse min-w-[420px]">
          <thead>
            <tr>
              <th className="p-1"></th>
              {cols.map((c) => (
                <th key={c} className="p-1 text-gray-400 font-semibold text-center">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r}>
                <td className="p-1 text-gray-400 font-semibold whitespace-nowrap pr-2">{r}</td>
                {cols.map((c, ci) => {
                  const v = values[ri]?.[ci] ?? 0
                  const isHover = hoverCell === `${ri}-${ci}`
                  return (
                    <td key={c} className="p-1">
                      <div
                        className="rounded-md h-8 flex items-center justify-center cursor-pointer transition-transform relative"
                        style={{ background: `rgba(${color}, ${Math.max(0.08, v / 100)})`, transform: isHover ? 'scale(1.12)' : 'scale(1)' }}
                        onMouseEnter={() => setHoverCell(`${ri}-${ci}`)}
                        onMouseLeave={() => setHoverCell(null)}
                      >
                        {isHover && <span className="text-white text-[10px] font-bold">{v}</span>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
