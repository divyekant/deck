"use client"

import { useEffect, useState, useMemo } from "react"
import { formatCost, formatTokens } from "@/lib/claude/costs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

// ---- Types ----

interface ModelStats {
  model: string
  sessionCount: number
  totalCost: number
  avgCost: number
  avgTokens: number
  avgDuration: number
  cacheHitRate: number
  costPerToken: number
  totalInputTokens: number
  totalOutputTokens: number
}

interface MonthlyTrend {
  months: string[]
  series: { model: string; counts: number[] }[]
}

interface ModelsData {
  models: ModelStats[]
  monthlyTrend: MonthlyTrend
}

// ---- Color Map ----

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6": "#3b82f6",
  "claude-sonnet-4-6": "#60a5fa",
  "claude-haiku-4-5": "#93c5fd",
  "gpt-4.1": "#22c55e",
  "gpt-4.1-mini": "#4ade80",
  "gpt-4.1-nano": "#86efac",
  "gpt-5.2-codex": "#10b981",
  "codex-mini-latest": "#34d399",
  "o3": "#a3e635",
  "o4-mini": "#bef264",
}

function getModelColor(model: string): string {
  if (MODEL_COLORS[model]) return MODEL_COLORS[model]
  const m = model.toLowerCase()
  if (m.includes("opus")) return "#3b82f6"
  if (m.includes("sonnet")) return "#60a5fa"
  if (m.includes("haiku")) return "#93c5fd"
  if (m.includes("codex")) return "#34d399"
  if (m.includes("gpt") || m.includes("o3") || m.includes("o4")) return "#22c55e"
  let hash = 0
  for (let i = 0; i < model.length; i++) {
    hash = model.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 55%)`
}

function getModelBadgeClasses(model: string): string {
  const m = model.toLowerCase()
  if (m.includes("opus")) return "bg-blue-900/60 text-blue-300"
  if (m.includes("sonnet")) return "bg-blue-900/40 text-blue-400"
  if (m.includes("haiku")) return "bg-blue-900/30 text-blue-300"
  if (m.includes("codex")) return "bg-emerald-900/60 text-emerald-300"
  if (m.includes("gpt") || m.includes("o3") || m.includes("o4")) return "bg-green-900/60 text-green-300"
  return "bg-zinc-700 text-zinc-300"
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function shortModelName(model: string): string {
  return model.replace("claude-", "").replace(/-\d{8}$/, "")
}

// ---- Model Overview Cards ----

function ModelOverviewCards({ models }: { models: ModelStats[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((m) => (
        <div
          key={m.model}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: getModelColor(m.model) }}
            />
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getModelBadgeClasses(m.model)}`}
            >
              {shortModelName(m.model)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Sessions
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">
                {m.sessionCount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Total Cost
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">
                {formatCost(m.totalCost)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Avg Cost/Session
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
                {formatCost(m.avgCost)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Avg Tokens/Session
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
                {formatTokens(Math.round(m.avgTokens))}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Cache Hit Rate
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
                {formatPercent(m.cacheHitRate)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Avg Duration
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-zinc-300">
                {formatDuration(m.avgDuration)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---- Head-to-Head Comparison ----

interface ComparisonMetric {
  label: string
  valueA: string
  valueB: string
  rawA: number
  rawB: number
  lowerIsBetter: boolean
}

function HeadToHead({ models }: { models: ModelStats[] }) {
  const [modelA, setModelA] = useState<string>("")
  const [modelB, setModelB] = useState<string>("")

  const statsA = models.find((m) => m.model === modelA)
  const statsB = models.find((m) => m.model === modelB)

  const metrics: ComparisonMetric[] = useMemo(() => {
    if (!statsA || !statsB) return []
    return [
      {
        label: "Avg Cost",
        valueA: formatCost(statsA.avgCost),
        valueB: formatCost(statsB.avgCost),
        rawA: statsA.avgCost,
        rawB: statsB.avgCost,
        lowerIsBetter: true,
      },
      {
        label: "Avg Tokens",
        valueA: formatTokens(Math.round(statsA.avgTokens)),
        valueB: formatTokens(Math.round(statsB.avgTokens)),
        rawA: statsA.avgTokens,
        rawB: statsB.avgTokens,
        lowerIsBetter: true,
      },
      {
        label: "Avg Duration",
        valueA: formatDuration(statsA.avgDuration),
        valueB: formatDuration(statsB.avgDuration),
        rawA: statsA.avgDuration,
        rawB: statsB.avgDuration,
        lowerIsBetter: true,
      },
      {
        label: "Cache Hit Rate",
        valueA: formatPercent(statsA.cacheHitRate),
        valueB: formatPercent(statsB.cacheHitRate),
        rawA: statsA.cacheHitRate,
        rawB: statsB.cacheHitRate,
        lowerIsBetter: false,
      },
      {
        label: "Cost Per 1K Tokens",
        valueA: `$${(statsA.costPerToken * 1000).toFixed(4)}`,
        valueB: `$${(statsB.costPerToken * 1000).toFixed(4)}`,
        rawA: statsA.costPerToken,
        rawB: statsB.costPerToken,
        lowerIsBetter: true,
      },
      {
        label: "Total Sessions",
        valueA: statsA.sessionCount.toLocaleString(),
        valueB: statsB.sessionCount.toLocaleString(),
        rawA: statsA.sessionCount,
        rawB: statsB.sessionCount,
        lowerIsBetter: false,
      },
    ]
  }, [statsA, statsB])

  function isWinner(metric: ComparisonMetric, side: "A" | "B"): boolean {
    if (metric.rawA === metric.rawB) return false
    const aIsBetter = metric.lowerIsBetter
      ? metric.rawA < metric.rawB
      : metric.rawA > metric.rawB
    return side === "A" ? aIsBetter : !aIsBetter
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Head-to-Head Comparison
      </h2>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Select value={modelA} onValueChange={setModelA}>
          <SelectTrigger className="w-[220px] border-zinc-700 bg-zinc-800 text-zinc-200">
            <SelectValue placeholder="Select model A" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-800">
            {models.map((m) => (
              <SelectItem
                key={m.model}
                value={m.model}
                disabled={m.model === modelB}
                className="text-zinc-200"
              >
                {shortModelName(m.model)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs font-medium text-zinc-500">vs</span>
        <Select value={modelB} onValueChange={setModelB}>
          <SelectTrigger className="w-[220px] border-zinc-700 bg-zinc-800 text-zinc-200">
            <SelectValue placeholder="Select model B" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-800">
            {models.map((m) => (
              <SelectItem
                key={m.model}
                value={m.model}
                disabled={m.model === modelA}
                className="text-zinc-200"
              >
                {shortModelName(m.model)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {statsA && statsB ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                <th className="pb-2 pr-4">Metric</th>
                <th className="pb-2 pr-4 text-right">{shortModelName(modelA)}</th>
                <th className="pb-2 text-right">{shortModelName(modelB)}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr
                  key={metric.label}
                  className="border-b border-zinc-800/50 last:border-0"
                >
                  <td className="py-2.5 pr-4 text-zinc-400">{metric.label}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    <span
                      className={
                        isWinner(metric, "A")
                          ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-2 py-0.5 text-emerald-400"
                          : "text-zinc-300"
                      }
                    >
                      {metric.valueA}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    <span
                      className={
                        isWinner(metric, "B")
                          ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-900/40 px-2 py-0.5 text-emerald-400"
                          : "text-zinc-300"
                      }
                    >
                      {metric.valueB}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-zinc-500">
          Select two models above to compare their metrics side by side.
        </p>
      )}
    </div>
  )
}

// ---- Stacked Area Chart ----

function ModelUsageTrend({ trend }: { trend: MonthlyTrend }) {
  const { months, series } = trend

  if (months.length === 0 || series.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No trend data available.
      </p>
    )
  }

  const width = 700
  const height = 280
  const paddingLeft = 44
  const paddingRight = 16
  const paddingTop = 16
  const paddingBottom = 40
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const stacked = useMemo(() => {
    const layers: { model: string; values: number[]; cumValues: number[] }[] = []
    const cumulative = new Array(months.length).fill(0)

    for (const s of series) {
      const prev = [...cumulative]
      const vals = s.counts.map((c, i) => {
        cumulative[i] += c
        return c
      })
      layers.push({
        model: s.model,
        values: vals,
        cumValues: cumulative.map((v, i) => ({ bottom: prev[i], top: v })) as unknown as number[],
      })
    }
    return { layers, maxValue: Math.max(...cumulative, 1) }
  }, [months, series])

  const { layers, maxValue } = stacked

  const yMax = useMemo(() => {
    if (maxValue <= 5) return maxValue + 1
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)))
    return Math.ceil(maxValue / magnitude) * magnitude || maxValue * 1.2
  }, [maxValue])

  const yTicks = useMemo(() => {
    const ticks = []
    const step = yMax / 4
    for (let i = 0; i <= 4; i++) {
      const value = step * i
      const y = paddingTop + chartHeight - (value / yMax) * chartHeight
      ticks.push({ value: Math.round(value), y })
    }
    return ticks
  }, [yMax, chartHeight])

  const xPositions = months.map(
    (_, i) => paddingLeft + (i / (months.length - 1)) * chartWidth
  )

  const areaPaths = useMemo(() => {
    return layers.map((layer) => {
      const cum = layer.cumValues as unknown as { bottom: number; top: number }[]
      const topPoints = cum.map(
        (v, i) =>
          `${xPositions[i]},${paddingTop + chartHeight - (v.top / yMax) * chartHeight}`
      )
      const bottomPoints = [...cum]
        .reverse()
        .map(
          (v, i) =>
            `${xPositions[cum.length - 1 - i]},${paddingTop + chartHeight - (v.bottom / yMax) * chartHeight}`
        )
      return {
        model: layer.model,
        path: `M${topPoints.join("L")}L${bottomPoints.join("L")}Z`,
      }
    })
  }, [layers, xPositions, chartHeight, yMax])

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Model Usage Trend
      </h2>
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
              key={`y-${tick.value}`}
              x={paddingLeft - 8}
              y={tick.y + 3}
              textAnchor="end"
              fill="rgb(113, 113, 122)"
              fontSize="10"
            >
              {tick.value}
            </text>
          ))}

          {areaPaths.map((area) => (
            <path
              key={area.model}
              d={area.path}
              fill={getModelColor(area.model)}
              opacity={0.6}
            />
          ))}

          {months.map((m, i) => (
            <text
              key={`x-${m}`}
              x={xPositions[i]}
              y={height - 8}
              textAnchor="middle"
              fill="rgb(113, 113, 122)"
              fontSize="10"
            >
              {m}
            </text>
          ))}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <div key={s.model} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: getModelColor(s.model), opacity: 0.8 }}
            />
            {shortModelName(s.model)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Efficiency Scatter Plot ----

function EfficiencyScatter({ models }: { models: ModelStats[] }) {
  const filtered = models.filter((m) => m.sessionCount > 0)

  if (filtered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No model data available.
      </p>
    )
  }

  const width = 700
  const height = 320
  const paddingLeft = 60
  const paddingRight = 30
  const paddingTop = 20
  const paddingBottom = 50
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const maxCost = Math.max(...filtered.map((m) => m.avgCost)) * 1.15
  const maxDuration = Math.max(...filtered.map((m) => m.avgDuration / 1000)) * 1.15
  const maxSessions = Math.max(...filtered.map((m) => m.sessionCount))

  const xTicks = useMemo(() => {
    const ticks = []
    const step = maxCost / 4
    for (let i = 0; i <= 4; i++) {
      const value = step * i
      ticks.push({
        value,
        x: paddingLeft + (value / maxCost) * chartWidth,
      })
    }
    return ticks
  }, [maxCost, chartWidth])

  const yTicks = useMemo(() => {
    const ticks = []
    const step = maxDuration / 4
    for (let i = 0; i <= 4; i++) {
      const value = step * i
      ticks.push({
        value,
        y: paddingTop + chartHeight - (value / maxDuration) * chartHeight,
      })
    }
    return ticks
  }, [maxDuration, chartHeight])

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Efficiency Scatter: Cost vs Duration
      </h2>
      <div className="relative w-full" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {xTicks.map((tick) => (
            <line
              key={`xg-${tick.value}`}
              x1={tick.x}
              y1={paddingTop}
              x2={tick.x}
              y2={paddingTop + chartHeight}
              stroke="rgb(63, 63, 70)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))}
          {yTicks.map((tick) => (
            <line
              key={`yg-${tick.value}`}
              x1={paddingLeft}
              y1={tick.y}
              x2={paddingLeft + chartWidth}
              y2={tick.y}
              stroke="rgb(63, 63, 70)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))}

          {xTicks.map((tick) => (
            <text
              key={`xl-${tick.value}`}
              x={tick.x}
              y={paddingTop + chartHeight + 20}
              textAnchor="middle"
              fill="rgb(113, 113, 122)"
              fontSize="10"
            >
              {formatCost(tick.value)}
            </text>
          ))}
          {yTicks.map((tick) => (
            <text
              key={`yl-${tick.value}`}
              x={paddingLeft - 8}
              y={tick.y + 3}
              textAnchor="end"
              fill="rgb(113, 113, 122)"
              fontSize="10"
            >
              {Math.round(tick.value)}s
            </text>
          ))}

          <text
            x={paddingLeft + chartWidth / 2}
            y={height - 4}
            textAnchor="middle"
            fill="rgb(161, 161, 170)"
            fontSize="11"
          >
            Avg Cost / Session
          </text>
          <text
            x={12}
            y={paddingTop + chartHeight / 2}
            textAnchor="middle"
            fill="rgb(161, 161, 170)"
            fontSize="11"
            transform={`rotate(-90, 12, ${paddingTop + chartHeight / 2})`}
          >
            Avg Duration (s)
          </text>

          {filtered.map((m) => {
            const cx = paddingLeft + (m.avgCost / maxCost) * chartWidth
            const cy =
              paddingTop +
              chartHeight -
              (m.avgDuration / 1000 / maxDuration) * chartHeight
            const minR = 8
            const maxR = 32
            const r =
              maxSessions > 0
                ? minR + (m.sessionCount / maxSessions) * (maxR - minR)
                : minR
            return (
              <g key={m.model}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={getModelColor(m.model)}
                  opacity={0.5}
                  stroke={getModelColor(m.model)}
                  strokeWidth={1.5}
                />
                <text
                  x={cx}
                  y={cy - r - 4}
                  textAnchor="middle"
                  fill="rgb(212, 212, 216)"
                  fontSize="9"
                >
                  {shortModelName(m.model)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ---- Recommendation Card ----

function Recommendation({ models }: { models: ModelStats[] }) {
  const insight = useMemo(() => {
    const qualified = models.filter((m) => m.sessionCount > 10)
    if (qualified.length < 2) return null

    const cheapest = [...qualified].sort((a, b) => a.avgCost - b.avgCost)[0]
    const mostExpensive = [...qualified].sort((a, b) => b.avgCost - a.avgCost)[0]

    if (cheapest.model === mostExpensive.model) return null

    const shiftPercent = 0.3
    const potentialSavings =
      mostExpensive.sessionCount *
      shiftPercent *
      (mostExpensive.avgCost - cheapest.avgCost)

    if (potentialSavings <= 0) return null

    return {
      cheapestModel: cheapest.model,
      expensiveModel: mostExpensive.model,
      savingsPercent: Math.round(shiftPercent * 100),
      potentialSavings,
      cheapestAvgCost: cheapest.avgCost,
      expensiveAvgCost: mostExpensive.avgCost,
    }
  }, [models])

  if (!insight) return null

  return (
    <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-5">
      <div className="mb-2 flex items-center gap-2">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgb(251, 191, 36)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
        <h3 className="text-sm font-medium text-amber-300">Cost Optimization Insight</h3>
      </div>
      <p className="text-sm leading-relaxed text-zinc-300">
        <span className="font-medium text-zinc-100">
          {shortModelName(insight.cheapestModel)}
        </span>{" "}
        averages{" "}
        <span className="tabular-nums text-emerald-400">
          {formatCost(insight.cheapestAvgCost)}
        </span>
        /session vs{" "}
        <span className="font-medium text-zinc-100">
          {shortModelName(insight.expensiveModel)}
        </span>{" "}
        at{" "}
        <span className="tabular-nums text-zinc-100">
          {formatCost(insight.expensiveAvgCost)}
        </span>
        . If{" "}
        <span className="tabular-nums">{insight.savingsPercent}%</span> of{" "}
        {shortModelName(insight.expensiveModel)} sessions used{" "}
        {shortModelName(insight.cheapestModel)} instead, you could save approximately{" "}
        <span className="font-semibold tabular-nums text-emerald-400">
          {formatCost(insight.potentialSavings)}
        </span>
        .
      </p>
    </div>
  )
}

// ---- Loading Skeleton ----

function ModelsTabSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-5"
          >
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <Skeleton className="mb-4 h-5 w-48" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="h-[280px] w-full" />
      </div>
    </div>
  )
}

// ---- Main Component ----

export default function ModelsTab() {
  const [data, setData] = useState<ModelsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/models")
        if (!res.ok) throw new Error("Failed to fetch")
        const json: ModelsData = await res.json()
        setData(json)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <ModelsTabSkeleton />

  if (error || !data) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        Failed to load model data.
      </p>
    )
  }

  if (data.models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgb(113, 113, 122)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-4"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
        <p className="text-sm text-zinc-500">
          No model data available. Start some sessions to see model comparisons.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <ModelOverviewCards models={data.models} />
      <HeadToHead models={data.models} />
      <ModelUsageTrend trend={data.monthlyTrend} />
      <EfficiencyScatter models={data.models} />
      <Recommendation models={data.models} />
    </div>
  )
}
