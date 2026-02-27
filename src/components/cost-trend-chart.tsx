"use client"

import { useMemo, useState } from "react"
import { formatCost } from "@/lib/claude/costs"

interface CostTrendChartProps {
  data: { date: string; cost: number }[]
  days: number
}

const DAY_OPTIONS = [7, 30, 90] as const

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function CostTrendChart({ data, days: defaultDays }: CostTrendChartProps) {
  const [selectedDays, setSelectedDays] = useState(defaultDays)

  const filteredData = useMemo(() => {
    return data.slice(-selectedDays)
  }, [data, selectedDays])

  const maxCost = useMemo(() => {
    const max = Math.max(...filteredData.map((d) => d.cost), 0)
    // Round up to a nice number for y-axis
    if (max === 0) return 1
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / magnitude) * magnitude || max * 1.2
  }, [filteredData])

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // SVG dimensions
  const width = 600
  const height = 200
  const paddingLeft = 50
  const paddingRight = 16
  const paddingTop = 16
  const paddingBottom = 28
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Build polyline points
  const points = useMemo(() => {
    if (filteredData.length === 0) return []
    return filteredData.map((d, i) => {
      const x = paddingLeft + (filteredData.length === 1 ? chartWidth / 2 : (i / (filteredData.length - 1)) * chartWidth)
      const y = paddingTop + chartHeight - (d.cost / maxCost) * chartHeight
      return { x, y, date: d.date, cost: d.cost }
    })
  }, [filteredData, maxCost, chartWidth, chartHeight])

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ")

  // Gradient fill path (area under the line)
  const areaPath = useMemo(() => {
    if (points.length === 0) return ""
    const first = points[0]
    const last = points[points.length - 1]
    const bottom = paddingTop + chartHeight
    let d = `M ${first.x},${bottom}`
    for (const p of points) {
      d += ` L ${p.x},${p.y}`
    }
    d += ` L ${last.x},${bottom} Z`
    return d
  }, [points, chartHeight])

  // Y-axis labels (4 ticks)
  const yTicks = useMemo(() => {
    const ticks = []
    for (let i = 0; i <= 3; i++) {
      const value = (maxCost / 3) * i
      const y = paddingTop + chartHeight - (value / maxCost) * chartHeight
      ticks.push({ value, y })
    }
    return ticks
  }, [maxCost, chartHeight])

  // X-axis labels (show every Nth label to avoid crowding)
  const xLabels = useMemo(() => {
    if (points.length === 0) return []
    const maxLabels = selectedDays <= 7 ? 7 : selectedDays <= 30 ? 8 : 10
    const step = Math.max(1, Math.ceil(points.length / maxLabels))
    return points.filter((_, i) => i % step === 0 || i === points.length - 1)
  }, [points, selectedDays])

  return (
    <div>
      {/* Day toggle */}
      <div className="mb-4 flex items-center gap-1">
        {DAY_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDays(d)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              selectedDays === d
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {filteredData.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No cost data available.
        </p>
      ) : (
        <div className="relative w-full" style={{ height }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {yTicks.map((tick) => (
              <line
                key={tick.value}
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                stroke="rgb(63, 63, 70)"
                strokeWidth="0.5"
                strokeDasharray="4 4"
              />
            ))}

            {/* Y-axis labels */}
            {yTicks.map((tick) => (
              <text
                key={`label-${tick.value}`}
                x={paddingLeft - 8}
                y={tick.y + 3}
                textAnchor="end"
                fill="rgb(113, 113, 122)"
                fontSize="10"
              >
                ${tick.value.toFixed(tick.value >= 10 ? 0 : 2)}
              </text>
            ))}

            {/* Area fill */}
            {areaPath && (
              <path d={areaPath} fill="url(#costGradient)" />
            )}

            {/* Trend line */}
            {points.length > 1 && (
              <polyline
                points={polylineStr}
                fill="none"
                stroke="rgb(16, 185, 129)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* Data points */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? 4 : 2.5}
                fill={hoveredIndex === i ? "rgb(16, 185, 129)" : "rgb(9, 121, 83)"}
                stroke="rgb(24, 24, 27)"
                strokeWidth="1.5"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}

            {/* X-axis labels */}
            {xLabels.map((p) => (
              <text
                key={`x-${p.date}`}
                x={p.x}
                y={height - 4}
                textAnchor="middle"
                fill="rgb(113, 113, 122)"
                fontSize="10"
              >
                {formatDateLabel(p.date)}
              </text>
            ))}
          </svg>

          {/* Tooltip */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
              style={{
                left: `${(points[hoveredIndex].x / width) * 100}%`,
                top: `${(points[hoveredIndex].y / height) * 100 - 18}%`,
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-medium text-zinc-200">
                {formatDateLabel(points[hoveredIndex].date)}
              </p>
              <p className="text-emerald-400">
                {formatCost(points[hoveredIndex].cost)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
