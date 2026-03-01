"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"
import { formatTokens, formatCost } from "@/lib/claude/costs"

// ---- Types ----

interface CacheEfficiencyPoint {
  sessionIndex: number
  sessionId: string
  projectName: string
  cacheHitRate: number
  startTime: string
}

interface TokenDistribution {
  totalInput: number
  totalOutput: number
  totalCacheCreation: number
  totalCacheRead: number
}

interface TopConsumer {
  id: string
  projectName: string
  firstPrompt: string
  model: string
  totalTokens: number
  costPer1KTokens: number
  estimatedCost: number
}

interface ModelComparison {
  model: string
  avgTokensPerSession: number
  avgCostPerSession: number
  totalSessions: number
  totalCost: number
}

interface DailyTrendPoint {
  date: string
  totalTokens: number
}

interface TokensData {
  cacheEfficiency: CacheEfficiencyPoint[]
  tokenDistribution: TokenDistribution
  topConsumers: TopConsumer[]
  modelComparison: ModelComparison[]
  dailyTrend: DailyTrendPoint[]
}

// ---- Utilities ----

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + "..."
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function getModelBadgeClasses(model: string): string {
  const m = model.toLowerCase()
  if (m.includes("opus")) return "bg-orange-900/60 text-orange-300"
  if (m.includes("sonnet")) return "bg-blue-900/60 text-blue-300"
  if (m.includes("haiku")) return "bg-emerald-900/60 text-emerald-300"
  if (m.includes("gpt") || m.includes("o3") || m.includes("o4"))
    return "bg-violet-900/60 text-violet-300"
  if (m.includes("codex")) return "bg-cyan-900/60 text-cyan-300"
  return "bg-zinc-700 text-zinc-300"
}

function formatModelName(model: string): string {
  return model.replace("claude-", "").replace(/-\d{8}$/, "")
}

// ---- Donut Chart ----

const DONUT_SEGMENTS = [
  { key: "totalInput" as const, label: "Input", color: "rgb(59, 130, 246)" },
  { key: "totalOutput" as const, label: "Output", color: "rgb(139, 92, 246)" },
  {
    key: "totalCacheCreation" as const,
    label: "Cache Creation",
    color: "rgb(245, 158, 11)",
  },
  {
    key: "totalCacheRead" as const,
    label: "Cache Read",
    color: "rgb(16, 185, 129)",
  },
]

function DonutChart({ data }: { data: TokenDistribution }) {
  const total =
    data.totalInput +
    data.totalOutput +
    data.totalCacheCreation +
    data.totalCacheRead

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No token data available.
      </p>
    )
  }

  const cx = 120
  const cy = 120
  const outerR = 100
  const innerR = 65
  const size = 240

  const segments: {
    key: string
    label: string
    color: string
    value: number
    pct: number
    startAngle: number
    endAngle: number
  }[] = []

  let currentAngle = -90

  for (const seg of DONUT_SEGMENTS) {
    const value = data[seg.key]
    if (value === 0) continue
    const pct = (value / total) * 100
    const sweep = (value / total) * 360
    segments.push({
      key: seg.key,
      label: seg.label,
      color: seg.color,
      value,
      pct,
      startAngle: currentAngle,
      endAngle: currentAngle + sweep,
    })
    currentAngle += sweep
  }

  function describeArc(
    startAngle: number,
    endAngle: number,
    outerRadius: number,
    innerRadius: number
  ): string {
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const startOuter = {
      x: cx + outerRadius * Math.cos(toRad(startAngle)),
      y: cy + outerRadius * Math.sin(toRad(startAngle)),
    }
    const endOuter = {
      x: cx + outerRadius * Math.cos(toRad(endAngle)),
      y: cy + outerRadius * Math.sin(toRad(endAngle)),
    }
    const startInner = {
      x: cx + innerRadius * Math.cos(toRad(endAngle)),
      y: cy + innerRadius * Math.sin(toRad(endAngle)),
    }
    const endInner = {
      x: cx + innerRadius * Math.cos(toRad(startAngle)),
      y: cy + innerRadius * Math.sin(toRad(startAngle)),
    }
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
      "Z",
    ].join(" ")
  }

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          {segments.map((seg) => (
            <path
              key={seg.key}
              d={describeArc(seg.startAngle, seg.endAngle, outerR, innerR)}
              fill={seg.color}
              className="transition-opacity hover:opacity-80"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-zinc-100">
            {formatTokens(total)}
          </span>
          <span className="text-xs text-zinc-500">total tokens</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: seg.color }}
            />
            <div className="text-xs">
              <span className="text-zinc-300">{seg.label}</span>
              <span className="ml-1.5 tabular-nums text-zinc-500">
                {seg.pct.toFixed(1)}%
              </span>
              <span className="ml-1.5 tabular-nums text-zinc-500">
                ({formatTokens(seg.value)})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Cache Efficiency Line Chart ----

function CacheEfficiencyChart({ data }: { data: CacheEfficiencyPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const width = 700
  const height = 240
  const paddingLeft = 42
  const paddingRight = 16
  const paddingTop = 16
  const paddingBottom = 28
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const average = useMemo(() => {
    if (data.length === 0) return 0
    const sum = data.reduce((acc, d) => acc + d.cacheHitRate, 0)
    return sum / data.length
  }, [data])

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No session data for cache efficiency.
      </p>
    )
  }

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / Math.max(data.length - 1, 1)) * chartWidth
    const y = paddingTop + chartHeight - (d.cacheHitRate / 100) * chartHeight
    return { x, y, ...d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${paddingTop + chartHeight}` +
    ` L ${points[0].x} ${paddingTop + chartHeight} Z`

  const yTicks = [0, 25, 50, 75, 100].map((v) => ({
    value: v,
    y: paddingTop + chartHeight - (v / 100) * chartHeight,
  }))

  const avgY = paddingTop + chartHeight - (average / 100) * chartHeight

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
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

        {yTicks.map((tick) => (
          <text
            key={`label-${tick.value}`}
            x={paddingLeft - 8}
            y={tick.y + 3}
            textAnchor="end"
            fill="rgb(113, 113, 122)"
            fontSize="10"
          >
            {tick.value}%
          </text>
        ))}

        <line
          x1={paddingLeft}
          y1={avgY}
          x2={width - paddingRight}
          y2={avgY}
          stroke="rgb(16, 185, 129)"
          strokeWidth="1"
          strokeDasharray="6 4"
          opacity="0.5"
        />
        <text
          x={width - paddingRight}
          y={avgY - 6}
          textAnchor="end"
          fill="rgb(16, 185, 129)"
          fontSize="9"
          opacity="0.7"
        >
          avg {average.toFixed(1)}%
        </text>

        <path d={areaPath} fill="rgb(16, 185, 129)" opacity="0.08" />

        <path
          d={linePath}
          fill="none"
          stroke="rgb(16, 185, 129)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? 5 : 3}
            fill={hoveredIndex === i ? "rgb(52, 211, 153)" : "rgb(16, 185, 129)"}
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {points
          .filter((_, i) => i % 5 === 0 || i === points.length - 1)
          .map((p) => (
            <text
              key={`x-${p.sessionIndex}`}
              x={p.x}
              y={height - 4}
              textAnchor="middle"
              fill="rgb(113, 113, 122)"
              fontSize="9"
            >
              #{p.sessionIndex + 1}
            </text>
          ))}
      </svg>

      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${(points[hoveredIndex].x / width) * 100}%`,
            top: `${(points[hoveredIndex].y / height) * 100 - 14}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-medium text-zinc-200">
            {points[hoveredIndex].projectName}
          </p>
          <p className="text-emerald-400">
            {points[hoveredIndex].cacheHitRate.toFixed(1)}% cache hit rate
          </p>
        </div>
      )}
    </div>
  )
}

// ---- Daily Token Trend Bar Chart ----

function DailyTokenTrendChart({ data }: { data: DailyTrendPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const maxTokens = useMemo(() => {
    const max = Math.max(...data.map((d) => d.totalTokens), 0)
    if (max === 0) return 1
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / magnitude) * magnitude || max * 1.2
  }, [data])

  const width = 700
  const height = 220
  const paddingLeft = 56
  const paddingRight = 16
  const paddingTop = 16
  const paddingBottom = 28
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const barWidth = Math.max(1, (chartWidth / data.length) * 0.7)
  const gap = (chartWidth / data.length) * 0.3

  const yTicks = useMemo(() => {
    const ticks = []
    for (let i = 0; i <= 3; i++) {
      const value = (maxTokens / 3) * i
      const y = paddingTop + chartHeight - (value / maxTokens) * chartHeight
      ticks.push({ value, y })
    }
    return ticks
  }, [maxTokens, chartHeight])

  const xLabels = useMemo(() => {
    return data
      .map((d, i) => ({ ...d, index: i }))
      .filter((_, i) => i % 5 === 0 || i === data.length - 1)
  }, [data])

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No daily token data available.
      </p>
    )
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
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

        {yTicks.map((tick) => (
          <text
            key={`label-${tick.value}`}
            x={paddingLeft - 8}
            y={tick.y + 3}
            textAnchor="end"
            fill="rgb(113, 113, 122)"
            fontSize="10"
          >
            {formatTokens(tick.value)}
          </text>
        ))}

        {data.map((d, i) => {
          const barH =
            d.totalTokens > 0
              ? Math.max(1, (d.totalTokens / maxTokens) * chartHeight)
              : 0
          const x = paddingLeft + i * (barWidth + gap) + gap / 2
          const y = paddingTop + chartHeight - barH
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={1.5}
              fill={hoveredIndex === i ? "rgb(96, 165, 250)" : "rgb(59, 130, 246)"}
              opacity={hoveredIndex === i ? 1 : 0.8}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          )
        })}

        {xLabels.map((d) => {
          const x =
            paddingLeft + d.index * (barWidth + gap) + gap / 2 + barWidth / 2
          return (
            <text
              key={`x-${d.date}`}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fill="rgb(113, 113, 122)"
              fontSize="10"
            >
              {formatDateLabel(d.date)}
            </text>
          )
        })}
      </svg>

      {hoveredIndex !== null && data[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${((paddingLeft + hoveredIndex * (barWidth + gap) + gap / 2 + barWidth / 2) / width) * 100}%`,
            top: `${((paddingTop + chartHeight - Math.max(1, (data[hoveredIndex].totalTokens / maxTokens) * chartHeight)) / height) * 100 - 14}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-medium text-zinc-200">
            {formatDateLabel(data[hoveredIndex].date)}
          </p>
          <p className="text-blue-400">
            {formatTokens(data[hoveredIndex].totalTokens)} tokens
          </p>
        </div>
      )}
    </div>
  )
}

// ---- Loading Skeleton ----

function TokensTabSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <Skeleton className="mb-4 h-4 w-36" />
          <Skeleton className="mx-auto h-60 w-60 rounded-full" />
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <Skeleton className="mb-4 h-4 w-32" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <Skeleton className="mb-4 h-4 w-40" />
        <Skeleton className="h-52 w-full" />
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <Skeleton className="mb-4 h-4 w-44" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <Skeleton className="mb-4 h-4 w-44" />
        <Skeleton className="h-60 w-full" />
      </div>
    </div>
  )
}

// ---- Main Component ----

export default function TokensTab() {
  const [data, setData] = useState<TokensData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/tokens")
        if (!res.ok) return
        const json: TokensData = await res.json()
        setData(json)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <TokensTabSkeleton />

  if (!data) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        No session data available.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {/* Row 1: Donut + Cache Efficiency side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-300">
            Token Distribution
          </h2>
          <DonutChart data={data.tokenDistribution} />
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-300">
            Cache Efficiency
            <span className="ml-2 text-xs font-normal text-zinc-500">
              Last 30 sessions
            </span>
          </h2>
          <CacheEfficiencyChart data={data.cacheEfficiency} />
        </div>
      </div>

      {/* Row 2: Daily Token Trend */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">
          Daily Token Trend
          <span className="ml-2 text-xs font-normal text-zinc-500">
            Last 30 days
          </span>
        </h2>
        <DailyTokenTrendChart data={data.dailyTrend} />
      </div>

      {/* Row 3: Model Token Comparison Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">
          Model Token Comparison
        </h2>
        {data.modelComparison.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No model data available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4 text-right">Avg Tokens/Session</th>
                  <th className="pb-2 pr-4 text-right">Avg Cost/Session</th>
                  <th className="pb-2 pr-4 text-right">Total Sessions</th>
                  <th className="pb-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.modelComparison.map((m) => (
                  <tr
                    key={m.model}
                    className="border-b border-zinc-800/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getModelBadgeClasses(m.model)}`}
                      >
                        {formatModelName(m.model)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-300">
                      {formatTokens(m.avgTokensPerSession)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-300">
                      {formatCost(m.avgCostPerSession)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-400">
                      {m.totalSessions.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-300">
                      {formatCost(m.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 4: Top Token Consumers Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">
          Top Token Consumers
        </h2>
        {data.topConsumers.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            No session data available.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 pr-4">Project</th>
                  <th className="pb-2 pr-4">Prompt</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4 text-right">Total Tokens</th>
                  <th className="pb-2 pr-4 text-right">Cost/1K Tokens</th>
                  <th className="pb-2 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.topConsumers.map((s) => (
                  <tr
                    key={s.id}
                    className="group border-b border-zinc-800/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/sessions/${s.id}`}
                        className="text-zinc-300 hover:text-zinc-100 hover:underline underline-offset-2"
                      >
                        {s.projectName}
                      </Link>
                    </td>
                    <td className="max-w-xs py-2.5 pr-4">
                      <Link
                        href={`/sessions/${s.id}`}
                        className="text-zinc-400 hover:text-zinc-200"
                        title={s.firstPrompt}
                      >
                        {truncate(s.firstPrompt, 50)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getModelBadgeClasses(s.model)}`}
                      >
                        {formatModelName(s.model)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-300">
                      {formatTokens(s.totalTokens)}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-400">
                      ${s.costPer1KTokens.toFixed(4)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-zinc-300">
                      {formatCost(s.estimatedCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
