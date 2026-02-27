"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface WorkHoursChartProps {
  data: { hour: number; count: number }[]
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am"
  if (hour < 12) return `${hour}am`
  if (hour === 12) return "12pm"
  return `${hour - 12}pm`
}

// Reorder hours: 6am to 5am (wrapping around)
function reorderHours(data: { hour: number; count: number }[]): { hour: number; count: number }[] {
  const lookup = new Map(data.map((d) => [d.hour, d.count]))
  const reordered: { hour: number; count: number }[] = []
  for (let i = 0; i < 24; i++) {
    const hour = (i + 6) % 24
    reordered.push({ hour, count: lookup.get(hour) ?? 0 })
  }
  return reordered
}

function getIntensityClass(count: number, max: number): string {
  if (count === 0) return "bg-zinc-800"
  const ratio = count / max
  if (ratio <= 0.25) return "bg-emerald-900"
  if (ratio <= 0.55) return "bg-emerald-700"
  return "bg-emerald-500"
}

export function WorkHoursChart({ data }: WorkHoursChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const ordered = reorderHours(data)
  const maxCount = Math.max(...ordered.map((d) => d.count), 1)

  // Show labels every 3 hours
  const labelIndices = new Set([0, 3, 6, 9, 12, 15, 18, 21])

  return (
    <div className="flex flex-col gap-[2px]">
      {ordered.map((item, idx) => {
        const showLabel = labelIndices.has(idx)
        const isHovered = hoveredIdx === idx

        return (
          <div
            key={item.hour}
            className="group relative flex items-center gap-2"
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Hour label */}
            <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">
              {showLabel ? formatHour(item.hour) : ""}
            </span>

            {/* Bar */}
            <div className="relative flex-1 h-3">
              <div
                className={cn(
                  "h-full rounded-sm transition-all",
                  getIntensityClass(item.count, maxCount),
                  isHovered && item.count > 0 && "ring-1 ring-emerald-400/50"
                )}
                style={{
                  width: item.count === 0 ? "2px" : `${Math.max((item.count / maxCount) * 100, 4)}%`,
                }}
              />

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute left-0 -top-8 z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs shadow-lg whitespace-nowrap">
                  <span className="font-medium text-zinc-200">{formatHour(item.hour)}</span>
                  <span className="text-muted-foreground"> — {item.count} session{item.count !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
