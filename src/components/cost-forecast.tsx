"use client"

import { useMemo } from "react"
import { formatCost } from "@/lib/claude/costs"

interface DailyCost {
  date: string
  cost: number
}

interface CostForecastProps {
  dailyCosts: DailyCost[]
  monthlyBudget?: number
}

interface ForecastPoint {
  date: string
  cost: number
  forecastMin: number
  forecastMax: number
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function computeForecast(dailyCosts: DailyCost[]) {
  // Need at least 3 days of data for a meaningful forecast
  if (dailyCosts.length < 3) {
    return { avg: 0, stddev: 0, forecastPoints7: [], forecastPoints30: [] }
  }

  // Use up to last 14 days for rolling average
  const window = dailyCosts.slice(-14)
  const costs = window.map((d) => d.cost)
  const avg = costs.reduce((a, b) => a + b, 0) / costs.length
  const variance =
    costs.reduce((sum, c) => sum + (c - avg) ** 2, 0) / costs.length
  const stddev = Math.sqrt(variance)

  const lastDate = dailyCosts[dailyCosts.length - 1].date

  const forecastPoints7: ForecastPoint[] = []
  for (let i = 1; i <= 7; i++) {
    forecastPoints7.push({
      date: addDays(lastDate, i),
      cost: avg,
      forecastMin: Math.max(0, avg - stddev),
      forecastMax: avg + stddev,
    })
  }

  const forecastPoints30: ForecastPoint[] = []
  for (let i = 1; i <= 30; i++) {
    forecastPoints30.push({
      date: addDays(lastDate, i),
      cost: avg,
      forecastMin: Math.max(0, avg - stddev),
      forecastMax: avg + stddev,
    })
  }

  return { avg, stddev, forecastPoints7, forecastPoints30 }
}

export default function CostForecast({
  dailyCosts,
  monthlyBudget,
}: CostForecastProps) {
  const forecast = useMemo(() => computeForecast(dailyCosts), [dailyCosts])

  // Use last 30 days of actual data + 30 days of forecast for the chart
  const actualSlice = useMemo(
    () => dailyCosts.slice(-30),
    [dailyCosts]
  )

  const forecast7Total = forecast.avg * 7
  const forecast7Min = Math.max(0, forecast.avg - forecast.stddev) * 7
  const forecast7Max = (forecast.avg + forecast.stddev) * 7
  const forecast30Total = forecast.avg * 30

  // Chart dimensions
  const width = 600
  const height = 200
  const pl = 50 // padding left
  const pr = 16 // padding right
  const pt = 16 // padding top
  const pb = 28 // padding bottom
  const chartW = width - pl - pr
  const chartH = height - pt - pb

  // Combine actual + forecast for chart layout (use 30-day forecast for the full view)
  const allPoints = useMemo(() => {
    const actual = actualSlice.map((d) => ({
      date: d.date,
      cost: d.cost,
      type: "actual" as const,
      forecastMin: 0,
      forecastMax: 0,
    }))
    const fc = forecast.forecastPoints30.map((d) => ({
      date: d.date,
      cost: d.cost,
      type: "forecast" as const,
      forecastMin: d.forecastMin,
      forecastMax: d.forecastMax,
    }))
    return [...actual, ...fc]
  }, [actualSlice, forecast.forecastPoints30])

  const maxCost = useMemo(() => {
    if (allPoints.length === 0) return 1
    const vals = allPoints.map((p) =>
      p.type === "forecast" ? p.forecastMax : p.cost
    )
    const max = Math.max(...vals, 0)
    if (max === 0) return 1
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
    return Math.ceil(max / magnitude) * magnitude || max * 1.2
  }, [allPoints])

  // Map points to SVG coordinates
  const toX = (i: number) =>
    pl + (i / Math.max(allPoints.length - 1, 1)) * chartW
  const toY = (v: number) => pt + chartH - (v / maxCost) * chartH

  // Build path strings
  const actualPoints = allPoints.filter((p) => p.type === "actual")
  const forecastStartIndex = actualSlice.length - 1 // overlap at last actual point
  const forecastSlice = allPoints.slice(forecastStartIndex)

  const actualPath = actualPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.cost).toFixed(1)}`)
    .join(" ")

  const forecastPath = forecastSlice
    .map((p, i) => {
      const xi = forecastStartIndex + i
      return `${i === 0 ? "M" : "L"} ${toX(xi).toFixed(1)} ${toY(p.cost).toFixed(1)}`
    })
    .join(" ")

  // Confidence band polygon: top edge (forecastMax) forward, bottom edge (forecastMin) backward
  // Only for forecast points (not the overlap actual point)
  const bandPoints = allPoints.slice(actualSlice.length)
  const bandTopPath = bandPoints
    .map((p, i) => {
      const xi = actualSlice.length + i
      return `${toX(xi).toFixed(1)},${toY(p.forecastMax).toFixed(1)}`
    })
    .join(" ")
  const bandBottomPath = bandPoints
    .map((p, i) => {
      const xi = actualSlice.length + i
      return `${toX(xi).toFixed(1)},${toY(p.forecastMin).toFixed(1)}`
    })
    .reverse()
    .join(" ")
  const bandPolygon = bandTopPath + " " + bandBottomPath

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks = []
    for (let i = 0; i <= 3; i++) {
      const value = (maxCost / 3) * i
      const y = toY(value)
      ticks.push({ value, y })
    }
    return ticks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxCost])

  // X-axis labels — pick ~6-8 evenly spaced labels
  const xLabels = useMemo(() => {
    if (allPoints.length === 0) return []
    const maxLabels = 8
    const step = Math.max(1, Math.ceil(allPoints.length / maxLabels))
    return allPoints
      .map((p, i) => ({ ...p, index: i }))
      .filter((_, i) => i % step === 0 || i === allPoints.length - 1)
  }, [allPoints])

  // Separator line between actual and forecast
  const separatorX = toX(actualSlice.length - 1)

  if (dailyCosts.length < 3) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-2 text-sm font-medium text-zinc-300">
          Cost Forecast
        </h2>
        <p className="py-6 text-center text-sm text-zinc-500">
          Need at least 3 days of data to generate a forecast.
        </p>
      </div>
    )
  }

  const budgetExceeded =
    monthlyBudget != null && forecast30Total > monthlyBudget

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-sm font-medium text-zinc-300">Cost Forecast</h2>
        {budgetExceeded && (
          <span className="rounded-full bg-amber-900/60 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            Over Budget
          </span>
        )}
      </div>

      {/* Chart */}
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
              x1={pl}
              y1={tick.y}
              x2={width - pr}
              y2={tick.y}
              stroke="rgb(63, 63, 70)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text
              key={`y-${tick.value}`}
              x={pl - 8}
              y={tick.y + 3}
              textAnchor="end"
              fill="rgb(113, 113, 122)"
              fontSize="10"
            >
              ${tick.value.toFixed(tick.value >= 10 ? 0 : 2)}
            </text>
          ))}

          {/* Separator line between actual and forecast */}
          <line
            x1={separatorX}
            y1={pt}
            x2={separatorX}
            y2={pt + chartH}
            stroke="rgb(63, 63, 70)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x={separatorX + 4}
            y={pt + 10}
            fill="rgb(113, 113, 122)"
            fontSize="9"
          >
            forecast
          </text>

          {/* Confidence band */}
          {bandPolygon && (
            <polygon
              points={bandPolygon}
              fill="rgba(52, 211, 153, 0.2)"
            />
          )}

          {/* Actual cost line */}
          {actualPath && (
            <path
              d={actualPath}
              fill="none"
              stroke="rgb(161, 161, 170)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Forecast line (dashed) */}
          {forecastPath && (
            <path
              d={forecastPath}
              fill="none"
              stroke="rgb(52, 211, 153)"
              strokeWidth="2"
              strokeDasharray="6 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* X-axis labels */}
          {xLabels.map((d) => (
            <text
              key={`x-${d.date}`}
              x={toX(d.index)}
              y={height - 4}
              textAnchor="middle"
              fill="rgb(113, 113, 122)"
              fontSize="10"
            >
              {formatDateLabel(d.date)}
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-5 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-zinc-400" />
          Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded bg-emerald-400"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, rgb(52,211,153) 0 6px, transparent 6px 10px)" }}
          />
          Forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded bg-emerald-400/20" />
          Confidence
        </span>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-zinc-800/60 px-3.5 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            7-Day Forecast
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">
            {formatCost(forecast7Total)}
          </p>
          <p className="text-[11px] tabular-nums text-zinc-500">
            Range: {formatCost(forecast7Min)} &ndash; {formatCost(forecast7Max)}
          </p>
        </div>
        <div className="rounded-md bg-zinc-800/60 px-3.5 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            30-Day Forecast
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">
            {formatCost(forecast30Total)}
          </p>
          {monthlyBudget != null && (
            <p
              className={`text-[11px] tabular-nums ${
                budgetExceeded ? "text-amber-400" : "text-zinc-500"
              }`}
            >
              Budget: {formatCost(monthlyBudget)}
              {budgetExceeded && " — projected overage"}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
