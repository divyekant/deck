"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCost, formatTokens } from "@/lib/claude/costs"
import SessionHeatmap from "@/components/session-heatmap"

// ---- Types ----

interface WeeklyCost {
  week: string
  weekLabel: string
  cost: number
  sessions: number
}

interface ModelEfficiency {
  model: string
  totalSessions: number
  totalCost: number
  avgCostPerSession: number
  totalInputTokens: number
  totalOutputTokens: number
  avgTokensPerSession: number
}

interface ProjectRanking {
  projectName: string
  totalCost: number
  sessions: number
}

interface DurationTrend {
  week: string
  weekLabel: string
  avgDuration: number
}

interface HourlyHeatmap {
  hour: number
  count: number
}

interface AnalyticsData {
  weeklyCosts: WeeklyCost[]
  modelEfficiency: ModelEfficiency[]
  projectRanking: ProjectRanking[]
  durationTrend: DurationTrend[]
  hourlyHeatmap: HourlyHeatmap[]
}

// ---- Chart Components ----

function WeeklyCostChart({ data }: { data: WeeklyCost[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const maxCost = useMemo(() => {
    const max = Math.max(...data.map((d) => d.cost), 0)
    if (max === 0) return 1
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / magnitude) * magnitude || max * 1.2
  }, [data])

  const width = 700
  const height = 220
  const paddingLeft = 50
  const paddingRight = 16
  const paddingTop = 16
  const paddingBottom = 40
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const barWidth = Math.max(8, (chartWidth / data.length) * 0.6)
  const barGap = (chartWidth - barWidth * data.length) / (data.length + 1)

  const bars = useMemo(() => {
    return data.map((d, i) => {
      const x = paddingLeft + barGap * (i + 1) + barWidth * i
      const barH = maxCost > 0 ? (d.cost / maxCost) * chartHeight : 0
      const y = paddingTop + chartHeight - barH
      return { x, y, barH, ...d, index: i }
    })
  }, [data, maxCost, chartWidth, chartHeight, barWidth, barGap])

  // Trend line points (center of each bar top)
  const trendPoints = useMemo(() => {
    return bars
      .filter((b) => b.cost > 0)
      .map((b) => `${b.x + barWidth / 2},${b.y}`)
      .join(" ")
  }, [bars, barWidth])

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks = []
    for (let i = 0; i <= 3; i++) {
      const value = (maxCost / 3) * i
      const y = paddingTop + chartHeight - (value / maxCost) * chartHeight
      ticks.push({ value, y })
    }
    return ticks
  }, [maxCost, chartHeight])

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.4" />
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

        {/* Bars */}
        {bars.map((bar) => (
          <rect
            key={bar.week}
            x={bar.x}
            y={bar.y}
            width={barWidth}
            height={bar.barH}
            rx={2}
            fill={hoveredIndex === bar.index ? "rgb(16, 185, 129)" : "url(#barGradient)"}
            className="cursor-pointer transition-colors"
            onMouseEnter={() => setHoveredIndex(bar.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* Trend line */}
        {trendPoints.length > 0 && (
          <polyline
            points={trendPoints}
            fill="none"
            stroke="rgb(52, 211, 153)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="4 3"
            opacity="0.6"
          />
        )}

        {/* X-axis labels */}
        {bars.map((bar, i) => {
          // Show every other label if too many
          if (data.length > 8 && i % 2 !== 0) return null
          return (
            <text
              key={`x-${bar.week}`}
              x={bar.x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fill="rgb(113, 113, 122)"
              fontSize="9"
            >
              {bar.weekLabel.split("-")[0].trim()}
            </text>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredIndex !== null && bars[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${((bars[hoveredIndex].x + barWidth / 2) / width) * 100}%`,
            top: `${(bars[hoveredIndex].y / height) * 100 - 14}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-medium text-zinc-200">
            {bars[hoveredIndex].weekLabel}
          </p>
          <p className="text-emerald-400">{formatCost(bars[hoveredIndex].cost)}</p>
          <p className="text-zinc-400">{bars[hoveredIndex].sessions} sessions</p>
        </div>
      )}
    </div>
  )
}

function ProjectRankingChart({ data }: { data: ProjectRanking[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const maxCost = useMemo(() => {
    if (data.length === 0) return 1
    return Math.max(...data.map((d) => d.totalCost))
  }, [data])

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No project data available.
      </p>
    )
  }

  const barHeight = 28
  const gap = 6
  const paddingLeft = 120
  const paddingRight = 60
  const width = 400
  const totalHeight = data.length * (barHeight + gap) - gap + 16

  return (
    <div className="relative w-full" style={{ height: totalHeight }}>
      <svg
        viewBox={`0 0 ${width} ${totalHeight}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="projectBarGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {data.map((project, i) => {
          const y = i * (barHeight + gap)
          const barW =
            maxCost > 0
              ? (project.totalCost / maxCost) * (width - paddingLeft - paddingRight)
              : 0

          return (
            <g
              key={project.projectName}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="cursor-pointer"
            >
              {/* Project name */}
              <text
                x={paddingLeft - 8}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                fill={hoveredIndex === i ? "rgb(228, 228, 231)" : "rgb(161, 161, 170)"}
                fontSize="11"
                fontWeight={hoveredIndex === i ? "500" : "400"}
              >
                {project.projectName.length > 14
                  ? project.projectName.slice(0, 14) + "..."
                  : project.projectName}
              </text>

              {/* Bar */}
              <rect
                x={paddingLeft}
                y={y + 2}
                width={Math.max(barW, 2)}
                height={barHeight - 4}
                rx={3}
                fill={
                  hoveredIndex === i
                    ? "rgb(16, 185, 129)"
                    : "url(#projectBarGrad)"
                }
              />

              {/* Cost label */}
              <text
                x={paddingLeft + Math.max(barW, 2) + 6}
                y={y + barHeight / 2 + 4}
                fill="rgb(161, 161, 170)"
                fontSize="10"
              >
                {formatCost(project.totalCost)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function DurationTrendChart({ data }: { data: DurationTrend[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Convert ms to minutes for display
  const dataInMinutes = useMemo(
    () => data.map((d) => ({ ...d, avgMinutes: d.avgDuration / 60000 })),
    [data]
  )

  const maxMinutes = useMemo(() => {
    const max = Math.max(...dataInMinutes.map((d) => d.avgMinutes), 0)
    if (max === 0) return 10
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / magnitude) * magnitude || max * 1.2
  }, [dataInMinutes])

  const width = 400
  const height = 200
  const paddingLeft = 45
  const paddingRight = 16
  const paddingTop = 16
  const paddingBottom = 28
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const points = useMemo(() => {
    return dataInMinutes.map((d, i) => {
      const x =
        paddingLeft +
        (dataInMinutes.length === 1
          ? chartWidth / 2
          : (i / (dataInMinutes.length - 1)) * chartWidth)
      const y =
        paddingTop + chartHeight - (d.avgMinutes / maxMinutes) * chartHeight
      return { x, y, ...d, index: i }
    })
  }, [dataInMinutes, maxMinutes, chartWidth, chartHeight])

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

  const yTicks = useMemo(() => {
    const ticks = []
    for (let i = 0; i <= 3; i++) {
      const value = (maxMinutes / 3) * i
      const y = paddingTop + chartHeight - (value / maxMinutes) * chartHeight
      ticks.push({ value, y })
    }
    return ticks
  }, [maxMinutes, chartHeight])

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="durationGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
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
            x={paddingLeft - 6}
            y={tick.y + 3}
            textAnchor="end"
            fill="rgb(113, 113, 122)"
            fontSize="10"
          >
            {tick.value.toFixed(0)}m
          </text>
        ))}

        {/* Area fill */}
        {areaPath && <path d={areaPath} fill="url(#durationGradient)" />}

        {/* Line */}
        {points.length > 1 && (
          <polyline
            points={polylineStr}
            fill="none"
            stroke="rgb(99, 102, 241)"
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
                ? "rgb(99, 102, 241)"
                : "rgb(67, 56, 202)"
            }
            stroke="rgb(24, 24, 27)"
            strokeWidth="1.5"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIndex(p.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {/* X-axis labels */}
        {points.map((p, i) => {
          if (data.length > 8 && i % 2 !== 0) return null
          return (
            <text
              key={`x-${p.week}`}
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              fill="rgb(113, 113, 122)"
              fontSize="9"
            >
              {p.weekLabel.split("-")[0].trim()}
            </text>
          )
        })}
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
            {points[hoveredIndex].weekLabel}
          </p>
          <p className="text-indigo-400">
            {points[hoveredIndex].avgMinutes.toFixed(1)} min avg
          </p>
        </div>
      )}
    </div>
  )
}

function HourlyHeatmapChart({ data }: { data: HourlyHeatmap[] }) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null)

  const maxCount = useMemo(
    () => Math.max(...data.map((d) => d.count), 1),
    [data]
  )

  function hourLabel(hour: number): string {
    if (hour === 0) return "12a"
    if (hour < 12) return `${hour}a`
    if (hour === 12) return "12p"
    return `${hour - 12}p`
  }

  function intensityColor(count: number): string {
    if (count === 0) return "rgb(39, 39, 42)" // zinc-800
    const ratio = count / maxCount
    if (ratio < 0.25) return "rgba(16, 185, 129, 0.15)"
    if (ratio < 0.5) return "rgba(16, 185, 129, 0.35)"
    if (ratio < 0.75) return "rgba(16, 185, 129, 0.55)"
    return "rgba(16, 185, 129, 0.8)"
  }

  const cellSize = 36
  const gap = 3
  const cols = 12
  const rows = 2
  const labelWidth = 0
  const width = labelWidth + cols * (cellSize + gap)
  const height = rows * (cellSize + gap) + 20

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {data.map((d) => {
          const row = d.hour < 12 ? 0 : 1
          const col = d.hour < 12 ? d.hour : d.hour - 12
          const x = labelWidth + col * (cellSize + gap)
          const y = row * (cellSize + gap)

          return (
            <g
              key={d.hour}
              onMouseEnter={() => setHoveredHour(d.hour)}
              onMouseLeave={() => setHoveredHour(null)}
              className="cursor-pointer"
            >
              <rect
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={4}
                fill={intensityColor(d.count)}
                stroke={
                  hoveredHour === d.hour
                    ? "rgb(16, 185, 129)"
                    : "rgb(63, 63, 70)"
                }
                strokeWidth={hoveredHour === d.hour ? 1.5 : 0.5}
              />
              <text
                x={x + cellSize / 2}
                y={y + cellSize / 2 + 4}
                textAnchor="middle"
                fill={
                  hoveredHour === d.hour
                    ? "rgb(228, 228, 231)"
                    : "rgb(113, 113, 122)"
                }
                fontSize="9"
                fontWeight={hoveredHour === d.hour ? "600" : "400"}
              >
                {hourLabel(d.hour)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredHour !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${(((hoveredHour < 12 ? hoveredHour : hoveredHour - 12) * (cellSize + gap) + cellSize / 2) / width) * 100}%`,
            top: hoveredHour < 12 ? "-10px" : `${cellSize + gap - 10}px`,
            transform: "translateX(-50%) translateY(-100%)",
          }}
        >
          <p className="font-medium text-zinc-200">
            {hoveredHour === 0
              ? "12:00 AM"
              : hoveredHour < 12
                ? `${hoveredHour}:00 AM`
                : hoveredHour === 12
                  ? "12:00 PM"
                  : `${hoveredHour - 12}:00 PM`}
          </p>
          <p className="text-emerald-400">
            {data[hoveredHour].count} session{data[hoveredHour].count !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  )
}

// ---- Loading Skeleton ----

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32 bg-zinc-800" />
      <Skeleton className="h-[260px] w-full rounded-xl bg-zinc-800/50" />
      <Skeleton className="h-[200px] w-full rounded-xl bg-zinc-800/50" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-xl bg-zinc-800/50" />
        <Skeleton className="h-[300px] rounded-xl bg-zinc-800/50" />
      </div>
      <Skeleton className="h-[120px] w-full rounded-xl bg-zinc-800/50" />
    </div>
  )
}

// ---- Main Page ----

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [heatmapSessions, setHeatmapSessions] = useState<{ startTime: string }[]>([])

  useEffect(() => {
    let active = true

    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/analytics")
        if (!res.ok) throw new Error("Failed to fetch analytics")
        const json: AnalyticsData = await res.json()
        if (active) {
          setData(json)
          setError(null)
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unknown error")
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    async function fetchHeatmapSessions() {
      try {
        const res = await fetch("/api/sessions?limit=2000")
        if (!res.ok) return
        const json = await res.json()
        if (active) {
          setHeatmapSessions(
            json.sessions.map((s: Record<string, unknown>) => ({
              startTime: s.startTime as string,
            }))
          )
        }
      } catch {
        // ignore
      }
    }

    fetchAnalytics()
    fetchHeatmapSessions()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <AnalyticsSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-100">
          Analytics
        </h1>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent>
            <p className="py-8 text-center text-sm text-zinc-500">
              {error ?? "Failed to load analytics data."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Find most efficient model (lowest avg cost with at least 1 session)
  const mostEfficient = data.modelEfficiency.length > 0
    ? data.modelEfficiency.reduce((best, m) =>
        m.avgCostPerSession < best.avgCostPerSession ? m : best
      )
    : null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
        Analytics
      </h1>

      {/* Activity Heatmap */}
      {heatmapSessions.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-zinc-100">Activity Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionHeatmap sessions={heatmapSessions} />
          </CardContent>
        </Card>
      )}

      {/* Weekly Cost Chart */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Weekly Cost</CardTitle>
        </CardHeader>
        <CardContent>
          {data.weeklyCosts.length > 0 ? (
            <WeeklyCostChart data={data.weeklyCosts} />
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500">
              No cost data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Model Efficiency Table */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Model Efficiency</CardTitle>
        </CardHeader>
        <CardContent>
          {data.modelEfficiency.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Model</TableHead>
                  <TableHead className="text-right text-zinc-400">Sessions</TableHead>
                  <TableHead className="text-right text-zinc-400">Avg Cost</TableHead>
                  <TableHead className="text-right text-zinc-400">Avg Tokens</TableHead>
                  <TableHead className="text-right text-zinc-400">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.modelEfficiency.map((m) => {
                  const isEfficient = mostEfficient?.model === m.model
                  return (
                    <TableRow
                      key={m.model}
                      className="border-zinc-800 hover:bg-zinc-800/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-zinc-800 text-zinc-300 font-mono text-[11px]"
                          >
                            {m.model}
                          </Badge>
                          {isEfficient && (
                            <span className="text-[10px] font-medium text-emerald-400">
                              Most efficient
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-zinc-300">
                        {m.totalSessions.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-zinc-300">
                        {formatCost(m.avgCostPerSession)}
                      </TableCell>
                      <TableCell className="text-right text-zinc-300">
                        {formatTokens(m.avgTokensPerSession)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-zinc-200">
                        {formatCost(m.totalCost)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500">
              No model data available.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Two-column: Project Ranking + Duration Trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Project Ranking */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-zinc-100">Top Projects by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectRankingChart data={data.projectRanking} />
          </CardContent>
        </Card>

        {/* Duration Trend */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-zinc-100">Session Duration Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {data.durationTrend.length > 0 ? (
              <DurationTrendChart data={data.durationTrend} />
            ) : (
              <p className="py-8 text-center text-sm text-zinc-500">
                No duration data available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hourly Heatmap */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-zinc-100">Session Activity by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <HourlyHeatmapChart data={data.hourlyHeatmap} />
        </CardContent>
      </Card>
    </div>
  )
}
