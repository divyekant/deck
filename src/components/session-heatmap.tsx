"use client"

import { useMemo, useState } from "react"

interface Props {
  sessions: { startTime: string }[]
}

const CELL_SIZE = 11
const CELL_GAP = 2
const CELL_STEP = CELL_SIZE + CELL_GAP

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""]
const DAY_LABEL_WIDTH = 28

function intensityColor(count: number): string {
  if (count === 0) return "rgb(39, 39, 42)" // zinc-800
  if (count === 1) return "rgb(6, 78, 59)" // emerald-950
  if (count <= 3) return "rgb(6, 95, 70)" // emerald-800
  if (count <= 5) return "rgb(5, 150, 105)" // emerald-600
  return "rgb(52, 211, 153)" // emerald-400
}

export default function SessionHeatmap({ sessions }: Props) {
  const [hovered, setHovered] = useState<{
    date: string
    count: number
    x: number
    y: number
  } | null>(null)

  const { grid, weeks, monthLabels } = useMemo(() => {
    // Build date -> count map
    const countMap = new Map<string, number>()
    for (const s of sessions) {
      const dateKey = new Date(s.startTime).toLocaleDateString("en-CA") // YYYY-MM-DD
      countMap.set(dateKey, (countMap.get(dateKey) ?? 0) + 1)
    }

    // Build 365-day grid ending today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find the start: go back 364 days, then back to the nearest Sunday
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364)
    // Go to previous Sunday
    const dayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - dayOfWeek)

    const cells: {
      date: string
      count: number
      week: number
      day: number
    }[] = []

    const cursor = new Date(startDate)
    let weekIndex = 0
    const months: { label: string; week: number }[] = []
    let lastMonth = -1

    while (cursor <= today) {
      const dateKey = cursor.toLocaleDateString("en-CA")
      const day = cursor.getDay()

      if (day === 0 && cursor > startDate) {
        weekIndex++
      }

      const month = cursor.getMonth()
      if (month !== lastMonth) {
        const monthName = cursor.toLocaleDateString("en-US", {
          month: "short",
        })
        months.push({ label: monthName, week: weekIndex })
        lastMonth = month
      }

      cells.push({
        date: dateKey,
        count: countMap.get(dateKey) ?? 0,
        week: weekIndex,
        day,
      })

      cursor.setDate(cursor.getDate() + 1)
    }

    return {
      grid: cells,
      weeks: weekIndex + 1,
      monthLabels: months,
    }
  }, [sessions])

  const svgWidth = DAY_LABEL_WIDTH + weeks * CELL_STEP
  const svgHeight = 16 + 7 * CELL_STEP + 24 // month labels + grid + legend space

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ minWidth: 700, maxHeight: 140 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text
            key={`${m.label}-${i}`}
            x={DAY_LABEL_WIDTH + m.week * CELL_STEP}
            y={10}
            fill="rgb(113, 113, 122)"
            fontSize="9"
          >
            {m.label}
          </text>
        ))}

        {/* Day labels */}
        {DAY_LABELS.map((label, i) => {
          if (!label) return null
          return (
            <text
              key={label}
              x={DAY_LABEL_WIDTH - 4}
              y={16 + i * CELL_STEP + CELL_SIZE / 2 + 3}
              textAnchor="end"
              fill="rgb(113, 113, 122)"
              fontSize="9"
            >
              {label}
            </text>
          )
        })}

        {/* Grid cells */}
        {grid.map((cell) => {
          const x = DAY_LABEL_WIDTH + cell.week * CELL_STEP
          const y = 16 + cell.day * CELL_STEP

          return (
            <rect
              key={cell.date}
              x={x}
              y={y}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={2}
              fill={intensityColor(cell.count)}
              className="cursor-pointer"
              onMouseEnter={() =>
                setHovered({ date: cell.date, count: cell.count, x, y })
              }
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}

        {/* Legend */}
        {(() => {
          const legendX = svgWidth - 120
          const legendY = svgHeight - 14
          const legendCells = [0, 1, 2, 4, 6]
          return (
            <g>
              <text
                x={legendX - 28}
                y={legendY + 9}
                fill="rgb(113, 113, 122)"
                fontSize="9"
              >
                Less
              </text>
              {legendCells.map((count, i) => (
                <rect
                  key={i}
                  x={legendX + i * (CELL_SIZE + 2)}
                  y={legendY}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  fill={intensityColor(count)}
                />
              ))}
              <text
                x={legendX + legendCells.length * (CELL_SIZE + 2) + 4}
                y={legendY + 9}
                fill="rgb(113, 113, 122)"
                fontSize="9"
              >
                More
              </text>
            </g>
          )
        })()}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${((hovered.x + CELL_SIZE / 2) / svgWidth) * 100}%`,
            top: `${((hovered.y) / svgHeight) * 100 - 12}%`,
            transform: "translateX(-50%) translateY(-100%)",
          }}
        >
          <p className="font-medium text-zinc-200">
            {new Date(hovered.date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <p className="text-emerald-400">
            {hovered.count} session{hovered.count !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  )
}
