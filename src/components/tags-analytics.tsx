"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCost } from "@/lib/claude/costs"

// ---- Types ----

interface SessionAnnotation {
  tags: string[]
  note: string
}

interface SessionMeta {
  id: string
  estimatedCost: number
  duration: number
  startTime: string
}

interface TagStats {
  tag: string
  count: number
  avgCost: number
  avgDuration: number
  totalCost: number
}

interface MonthlyTagCount {
  month: string // "YYYY-MM"
  label: string // "Jan", "Feb", etc.
  count: number
}

// ---- Tag Colors ----

const TAG_TEXT_COLORS: Record<string, string> = {
  "bug-fix": "rgb(248, 113, 113)",    // red-400
  feature: "rgb(96, 165, 250)",       // blue-400
  refactor: "rgb(192, 132, 252)",     // purple-400
  exploration: "rgb(251, 191, 36)",   // amber-400
  review: "rgb(52, 211, 153)",        // emerald-400
}

const TAG_BADGE_CLASSES: Record<string, string> = {
  "bug-fix": "bg-red-950 text-red-400 border-red-800",
  feature: "bg-blue-950 text-blue-400 border-blue-800",
  refactor: "bg-purple-950 text-purple-400 border-purple-800",
  exploration: "bg-amber-950 text-amber-400 border-amber-800",
  review: "bg-emerald-950 text-emerald-400 border-emerald-800",
}

function getTagTextColor(tag: string): string {
  return TAG_TEXT_COLORS[tag] ?? "rgb(161, 161, 170)" // zinc-400
}

function getTagBadgeClasses(tag: string): string {
  return TAG_BADGE_CLASSES[tag] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"
}

// ---- Helpers ----

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`
}

// ---- Tag Cloud ----

function TagCloud({ tags }: { tags: TagStats[] }) {
  const minCount = Math.min(...tags.map((t) => t.count))
  const maxCount = Math.max(...tags.map((t) => t.count))
  const range = maxCount - minCount || 1

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {tags.map((t) => {
        const ratio = (t.count - minCount) / range
        const fontSize = 12 + ratio * 20 // 12px to 32px
        return (
          <span
            key={t.tag}
            className="cursor-default transition-opacity hover:opacity-80"
            style={{
              fontSize: `${fontSize}px`,
              color: getTagTextColor(t.tag),
              lineHeight: 1.3,
            }}
            title={`${t.count} session${t.count !== 1 ? "s" : ""}`}
          >
            {t.tag}
          </span>
        )
      })}
    </div>
  )
}

// ---- Tags Trend Chart ----

function TagsTrendChart({ data }: { data: MonthlyTagCount[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const maxCount = useMemo(
    () => Math.max(...data.map((d) => d.count), 1),
    [data]
  )

  const width = 400
  const height = 140
  const paddingLeft = 35
  const paddingRight = 16
  const paddingTop = 16
  const paddingBottom = 28
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const points = useMemo(() => {
    return data.map((d, i) => {
      const x =
        paddingLeft +
        (data.length === 1
          ? chartWidth / 2
          : (i / (data.length - 1)) * chartWidth)
      const y = paddingTop + chartHeight - (d.count / maxCount) * chartHeight
      return { x, y, ...d, index: i }
    })
  }, [data, maxCount, chartWidth, chartHeight])

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ")

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

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="tagsTrendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(251, 191, 36)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="rgb(251, 191, 36)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#tagsTrendGradient)" />}

        {/* Line */}
        {points.length > 1 && (
          <polyline
            points={polylineStr}
            fill="none"
            stroke="rgb(251, 191, 36)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Data points */}
        {points.map((p) => (
          <circle
            key={p.index}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === p.index ? 4 : 2.5}
            fill={
              hoveredIndex === p.index
                ? "rgb(251, 191, 36)"
                : "rgb(217, 119, 6)"
            }
            stroke="rgb(24, 24, 27)"
            strokeWidth="1.5"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIndex(p.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* X-axis labels */}
        {points.map((p) => (
          <text
            key={`x-${p.month}`}
            x={p.x}
            y={height - 4}
            textAnchor="middle"
            fill="rgb(113, 113, 122)"
            fontSize="9"
          >
            {p.label}
          </text>
        ))}

        {/* Y-axis label at top */}
        <text
          x={paddingLeft - 6}
          y={paddingTop + 3}
          textAnchor="end"
          fill="rgb(113, 113, 122)"
          fontSize="9"
        >
          {maxCount}
        </text>
        <text
          x={paddingLeft - 6}
          y={paddingTop + chartHeight + 3}
          textAnchor="end"
          fill="rgb(113, 113, 122)"
          fontSize="9"
        >
          0
        </text>
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
            {points[hoveredIndex].label}
          </p>
          <p className="text-amber-400">
            {points[hoveredIndex].count} tagged session
            {points[hoveredIndex].count !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  )
}

// ---- Main Component ----

export default function TagsAnalytics() {
  const [tagStats, setTagStats] = useState<TagStats[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyTagCount[]>([])
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    let active = true

    async function fetchData() {
      try {
        const [annotationsRes, sessionsRes] = await Promise.all([
          fetch("/api/annotations"),
          fetch("/api/sessions?limit=2000"),
        ])

        if (!annotationsRes.ok || !sessionsRes.ok) return

        const annotationsJson = await annotationsRes.json()
        const sessionsJson = await sessionsRes.json()

        if (!active) return

        const annotations: Record<string, SessionAnnotation> =
          annotationsJson.annotations ?? {}
        const sessions: SessionMeta[] = sessionsJson.sessions ?? []

        // Build a session lookup by id
        const sessionById = new Map<string, SessionMeta>()
        for (const s of sessions) {
          sessionById.set(s.id, s)
        }

        // Aggregate tag stats
        const tagMap = new Map<
          string,
          { count: number; totalCost: number; totalDuration: number; sessionMonths: string[] }
        >()

        for (const [sessionId, annotation] of Object.entries(annotations)) {
          if (!annotation.tags || annotation.tags.length === 0) continue
          const session = sessionById.get(sessionId)

          for (const tag of annotation.tags) {
            const existing = tagMap.get(tag) ?? {
              count: 0,
              totalCost: 0,
              totalDuration: 0,
              sessionMonths: [],
            }
            existing.count++
            if (session) {
              existing.totalCost += session.estimatedCost ?? 0
              existing.totalDuration += session.duration ?? 0
              if (session.startTime) {
                const date = new Date(session.startTime)
                const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
                existing.sessionMonths.push(month)
              }
            }
            tagMap.set(tag, existing)
          }
        }

        if (tagMap.size === 0) {
          setEmpty(true)
          setLoading(false)
          return
        }

        // Build tag stats
        const stats: TagStats[] = Array.from(tagMap.entries())
          .map(([tag, data]) => ({
            tag,
            count: data.count,
            avgCost: data.count > 0 ? data.totalCost / data.count : 0,
            avgDuration: data.count > 0 ? data.totalDuration / data.count : 0,
            totalCost: data.totalCost,
          }))
          .sort((a, b) => b.count - a.count)

        // Build monthly trend data (last 6 months)
        const allMonths = new Set<string>()
        for (const data of tagMap.values()) {
          for (const m of data.sessionMonths) {
            allMonths.add(m)
          }
        }

        const sortedMonths = Array.from(allMonths).sort()
        const recentMonths = sortedMonths.slice(-6)

        const monthNames = [
          "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ]

        const monthly: MonthlyTagCount[] = recentMonths.map((month) => {
          let count = 0
          for (const data of tagMap.values()) {
            count += data.sessionMonths.filter((m) => m === month).length
          }
          const monthIdx = parseInt(month.split("-")[1], 10) - 1
          return {
            month,
            label: monthNames[monthIdx],
            count,
          }
        })

        setTagStats(stats)
        setMonthlyData(monthly)
        setEmpty(false)
      } catch {
        // silently fail
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchData()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-lg bg-zinc-800/50" />
        <Skeleton className="h-[200px] w-full rounded-lg bg-zinc-800/50" />
      </div>
    )
  }

  if (empty || tagStats.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No tags found. Tag your sessions to see analytics here.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tag Cloud */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-6 py-5">
        <TagCloud tags={tagStats} />
      </div>

      {/* Tags Breakdown Table */}
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-400">Tag</TableHead>
            <TableHead className="text-right text-zinc-400">Count</TableHead>
            <TableHead className="text-right text-zinc-400">Avg Cost</TableHead>
            <TableHead className="text-right text-zinc-400">Avg Duration</TableHead>
            <TableHead className="text-right text-zinc-400">Total Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tagStats.map((t) => (
            <TableRow
              key={t.tag}
              className="border-zinc-800 hover:bg-zinc-800/50"
            >
              <TableCell>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getTagBadgeClasses(t.tag)}`}
                >
                  {t.tag}
                </span>
              </TableCell>
              <TableCell className="text-right text-zinc-300">
                {t.count}
              </TableCell>
              <TableCell className="text-right text-zinc-300">
                {formatCost(t.avgCost)}
              </TableCell>
              <TableCell className="text-right text-zinc-300">
                {formatDuration(t.avgDuration)}
              </TableCell>
              <TableCell className="text-right font-medium text-zinc-200">
                {formatCost(t.totalCost)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Tags Trend */}
      {monthlyData.length >= 2 && (
        <div>
          <p className="mb-3 text-xs font-medium text-zinc-400">
            Tagged Sessions per Month
          </p>
          <TagsTrendChart data={monthlyData} />
        </div>
      )}
    </div>
  )
}
