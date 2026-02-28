"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { formatCost } from "@/lib/claude/costs"
import CostTips from "@/components/cost-tips"
import CostForecast from "@/components/cost-forecast"
import { truncate } from "@/lib/format"

type Range = "thisMonth" | "lastMonth" | "90d" | "all"

interface DailyCost {
  date: string
  cost: number
}

interface ModelCost {
  model: string
  cost: number
  sessions: number
}

interface ProjectCost {
  projectName: string
  cost: number
  sessions: number
}

interface ExpensiveSession {
  id: string
  projectName: string
  model: string
  firstPrompt: string
  estimatedCost: number
  startTime: string
}

interface CostsData {
  totalCost: number
  sessionCount: number
  dailyCosts: DailyCost[]
  modelCosts: ModelCost[]
  projectCosts: ProjectCost[]
  expensiveSessions: ExpensiveSession[]
  range: Range
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
]

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getModelColor(model: string): string {
  const m = model.toLowerCase()
  if (m.includes("opus")) return "rgb(249, 115, 22)" // orange
  if (m.includes("sonnet")) return "rgb(59, 130, 246)" // blue
  if (m.includes("haiku")) return "rgb(16, 185, 129)" // emerald
  if (m.includes("gpt") || m.includes("o3") || m.includes("o4")) return "rgb(139, 92, 246)" // violet
  if (m.includes("codex")) return "rgb(6, 182, 212)" // cyan
  return "rgb(161, 161, 170)" // zinc
}

const PROJECT_COLORS = [
  "rgb(59, 130, 246)",  // blue
  "rgb(16, 185, 129)",  // emerald
  "rgb(249, 115, 22)",  // orange
  "rgb(139, 92, 246)",  // violet
  "rgb(6, 182, 212)",   // cyan
  "rgb(236, 72, 153)",  // pink
  "rgb(234, 179, 8)",   // yellow
  "rgb(244, 63, 94)",   // rose
  "rgb(168, 85, 247)",  // purple
  "rgb(34, 197, 94)",   // green
]

function getModelBadgeClasses(model: string): string {
  const m = model.toLowerCase()
  if (m.includes("opus")) return "bg-orange-900/60 text-orange-300"
  if (m.includes("sonnet")) return "bg-blue-900/60 text-blue-300"
  if (m.includes("haiku")) return "bg-emerald-900/60 text-emerald-300"
  if (m.includes("gpt") || m.includes("o3") || m.includes("o4")) return "bg-violet-900/60 text-violet-300"
  if (m.includes("codex")) return "bg-cyan-900/60 text-cyan-300"
  return "bg-zinc-700 text-zinc-300"
}

// ---- Daily Cost Bar Chart ----

function DailyCostChart({ data }: { data: DailyCost[] }) {
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
  const paddingBottom = 28
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const barWidth = Math.max(1, (chartWidth / data.length) * 0.7)
  const gap = (chartWidth / data.length) * 0.3

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

  // X-axis labels
  const xLabels = useMemo(() => {
    if (data.length === 0) return []
    const maxLabels = data.length <= 7 ? 7 : data.length <= 31 ? 8 : 10
    const step = Math.max(1, Math.ceil(data.length / maxLabels))
    return data
      .map((d, i) => ({ ...d, index: i }))
      .filter((_, i) => i % step === 0 || i === data.length - 1)
  }, [data])

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No cost data available.
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
        {data.map((d, i) => {
          const barH = d.cost > 0 ? Math.max(1, (d.cost / maxCost) * chartHeight) : 0
          const x = paddingLeft + i * ((barWidth + gap)) + gap / 2
          const y = paddingTop + chartHeight - barH
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={1.5}
              fill={hoveredIndex === i ? "rgb(52, 211, 153)" : "rgb(16, 185, 129)"}
              opacity={hoveredIndex === i ? 1 : 0.8}
              className="cursor-pointer transition-opacity"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          )
        })}

        {/* X-axis labels */}
        {xLabels.map((d) => {
          const x = paddingLeft + d.index * (barWidth + gap) + gap / 2 + barWidth / 2
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

      {/* Tooltip */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap"
          style={{
            left: `${((paddingLeft + hoveredIndex * (barWidth + gap) + gap / 2 + barWidth / 2) / width) * 100}%`,
            top: `${((paddingTop + chartHeight - Math.max(1, (data[hoveredIndex].cost / maxCost) * chartHeight)) / height) * 100 - 14}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-medium text-zinc-200">
            {formatDateLabel(data[hoveredIndex].date)}
          </p>
          <p className="text-emerald-400">{formatCost(data[hoveredIndex].cost)}</p>
        </div>
      )}
    </div>
  )
}

// ---- Horizontal Bar Chart ----

function HorizontalBarChart({
  items,
  maxValue,
  getColor,
}: {
  items: { label: string; value: number; sublabel?: string }[]
  maxValue: number
  getColor: (label: string, index: number) => string
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No data available.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const widthPct = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate text-zinc-300" title={item.label}>
                {item.label}
                {item.sublabel && (
                  <span className="ml-1.5 text-zinc-500">{item.sublabel}</span>
                )}
              </span>
              <span className="ml-2 shrink-0 tabular-nums text-zinc-400">
                {formatCost(item.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(widthPct, 0.5)}%`,
                  backgroundColor: getColor(item.label, i),
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Main Page ----

interface TipSession {
  model: string
  messageCount: number
  estimatedCost: number
  startTime: string
  projectName: string
  cacheReadTokens: number
  totalInputTokens: number
}

export default function CostsPage() {
  const [range, setRange] = useState<Range>("thisMonth")
  const [data, setData] = useState<CostsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tipSessions, setTipSessions] = useState<TipSession[]>([])

  const fetchCosts = useCallback(async (r: Range) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/costs?range=${r}`)
      if (!res.ok) return
      const json: CostsData = await res.json()
      setData(json)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCosts(range)
  }, [range, fetchCosts])

  // Fetch session data for cost tips
  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions?limit=500")
        if (!res.ok) return
        const json = await res.json()
        setTipSessions(
          json.sessions.map((s: Record<string, unknown>) => ({
            model: s.model as string,
            messageCount: s.messageCount as number,
            estimatedCost: s.estimatedCost as number,
            startTime: s.startTime as string,
            projectName: s.projectName as string,
            cacheReadTokens: s.cacheReadTokens as number,
            totalInputTokens: s.totalInputTokens as number,
          }))
        )
      } catch {
        // ignore
      }
    }
    fetchSessions()
  }, [])

  return (
    <div className="space-y-8">
      {/* Header + range selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Costs
        </h1>
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                range === opt.value
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="py-16 text-center text-sm text-zinc-500">Loading...</div>
      ) : data ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Total Cost
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-50">
                {formatCost(data.totalCost)}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Sessions
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-zinc-50">
                {data.sessionCount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Daily cost chart */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-medium text-zinc-300">
              Daily Costs
            </h2>
            <DailyCostChart data={data.dailyCosts} />
          </div>

          {/* Cost Forecast */}
          <CostForecast dailyCosts={data.dailyCosts} monthlyBudget={200} />

          {/* Two-column grid: Model + Project breakdowns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Cost by Model */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-4 text-sm font-medium text-zinc-300">
                Cost by Model
              </h2>
              <HorizontalBarChart
                items={data.modelCosts.map((m) => ({
                  label: m.model.replace("claude-", "").replace(/-\d{8}$/, ""),
                  value: m.cost,
                  sublabel: `${m.sessions} sessions`,
                }))}
                maxValue={data.modelCosts[0]?.cost ?? 0}
                getColor={(label) => {
                  // Reconstruct enough of the model name for color matching
                  return getModelColor(label)
                }}
              />
            </div>

            {/* Cost by Project */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="mb-4 text-sm font-medium text-zinc-300">
                Cost by Project
              </h2>
              <HorizontalBarChart
                items={data.projectCosts.map((p) => ({
                  label: p.projectName,
                  value: p.cost,
                  sublabel: `${p.sessions} sessions`,
                }))}
                maxValue={data.projectCosts[0]?.cost ?? 0}
                getColor={(_, index) => PROJECT_COLORS[index % PROJECT_COLORS.length]}
              />
            </div>
          </div>

          {/* Most Expensive Sessions */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-4 text-sm font-medium text-zinc-300">
              Most Expensive Sessions
            </h2>
            {data.expensiveSessions.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">
                No sessions in this period.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      <th className="pb-2 pr-4">Project</th>
                      <th className="pb-2 pr-4">Model</th>
                      <th className="pb-2 pr-4">Prompt</th>
                      <th className="pb-2 pr-4 text-right">Cost</th>
                      <th className="pb-2 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expensiveSessions.map((s) => (
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
                        <td className="py-2.5 pr-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${getModelBadgeClasses(s.model)}`}
                          >
                            {s.model.replace("claude-", "").replace(/-\d{8}$/, "")}
                          </span>
                        </td>
                        <td className="max-w-xs py-2.5 pr-4">
                          <Link
                            href={`/sessions/${s.id}`}
                            className="text-zinc-400 hover:text-zinc-200"
                            title={s.firstPrompt}
                          >
                            {truncate(s.firstPrompt, 60)}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-zinc-300">
                          {formatCost(s.estimatedCost)}
                        </td>
                        <td className="py-2.5 text-right text-zinc-500">
                          {formatDateShort(s.startTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Optimization Insights */}
          {tipSessions.length > 0 && <CostTips sessions={tipSessions} />}
        </>
      ) : (
        <div className="py-16 text-center text-sm text-zinc-500">
          Failed to load cost data.
        </div>
      )}
    </div>
  )
}
