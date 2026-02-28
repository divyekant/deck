"use client"

import { useState, useMemo } from "react"
import type { SessionMessage, AssistantMessage } from "@/lib/claude/types"
import { formatTokens } from "@/lib/claude/costs"

interface ContextWindowChartProps {
  messages: SessionMessage[]
  model?: string
}

interface DataPoint {
  messageIndex: number
  cumulativeInput: number
  cumulativeOutput: number
  cumulativeCache: number
  total: number
}

function getContextLimit(model?: string): number {
  if (!model) return 200_000
  const m = model.toLowerCase()
  if (m.includes("opus") || m.includes("sonnet") || m.includes("claude")) return 200_000
  if (m.includes("haiku")) return 200_000
  if (m.includes("codex") || m.includes("gpt") || m.includes("o3") || m.includes("o4")) return 128_000
  return 200_000
}

export function ContextWindowChart({ messages, model }: ContextWindowChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const contextLimit = getContextLimit(model)

  const dataPoints = useMemo(() => {
    const points: DataPoint[] = []
    let cumInput = 0
    let cumOutput = 0
    let cumCache = 0
    let msgIdx = 0

    for (const msg of messages) {
      if (msg.type !== "assistant") continue
      const assistantMsg = msg as AssistantMessage
      const usage = assistantMsg.message?.usage
      if (!usage) continue

      cumInput += usage.input_tokens || 0
      cumOutput += usage.output_tokens || 0
      cumCache += (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0)

      points.push({
        messageIndex: msgIdx,
        cumulativeInput: cumInput,
        cumulativeOutput: cumOutput,
        cumulativeCache: cumCache,
        total: cumInput + cumOutput + cumCache,
      })
      msgIdx++
    }

    return points
  }, [messages])

  if (dataPoints.length === 0) return null

  // Chart dimensions
  const chartWidth = 600
  const chartHeight = 140
  const padLeft = 44
  const padRight = 48
  const padTop = 8
  const padBottom = 24
  const plotW = chartWidth - padLeft - padRight
  const plotH = chartHeight - padTop - padBottom

  const maxTotal = Math.max(...dataPoints.map((d) => d.total))
  const yMax = Math.max(maxTotal * 1.15, contextLimit * 0.1) // at least show some scale
  const n = dataPoints.length

  // Scale helpers
  const xScale = (i: number) => padLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yScale = (val: number) => padTop + plotH - (val / yMax) * plotH

  // Build area paths for stacked layers
  // Bottom: input, Middle: input+output, Top: input+output+cache
  const buildAreaPath = (getTop: (d: DataPoint) => number, getBot: (d: DataPoint) => number) => {
    if (n === 0) return ""
    const topPoints = dataPoints.map((d, i) => `${xScale(i)},${yScale(getTop(d))}`)
    const botPoints = dataPoints.map((d, i) => `${xScale(i)},${yScale(getBot(d))}`).reverse()
    return `M${topPoints.join("L")}L${botPoints.join("L")}Z`
  }

  // Build line path
  const buildLinePath = (getValue: (d: DataPoint) => number) => {
    return dataPoints.map((d, i) => `${i === 0 ? "M" : "L"}${xScale(i)},${yScale(getValue(d))}`).join("")
  }

  const inputPath = buildAreaPath(
    (d) => d.cumulativeInput,
    () => 0
  )
  const outputPath = buildAreaPath(
    (d) => d.cumulativeInput + d.cumulativeOutput,
    (d) => d.cumulativeInput
  )
  const cachePath = buildAreaPath(
    (d) => d.total,
    (d) => d.cumulativeInput + d.cumulativeOutput
  )

  const inputLine = buildLinePath((d) => d.cumulativeInput)
  const outputLine = buildLinePath((d) => d.cumulativeInput + d.cumulativeOutput)
  const totalLine = buildLinePath((d) => d.total)

  // Context limit line
  const limitY = yScale(contextLimit)
  const showLimitLine = contextLimit <= yMax

  // Fill percentage
  const peakTotal = Math.max(...dataPoints.map((d) => d.total))
  const peakPct = ((peakTotal / contextLimit) * 100).toFixed(1)
  const finalPct = ((dataPoints[dataPoints.length - 1].total / contextLimit) * 100).toFixed(1)

  // Tooltip
  const hoveredPoint = hovered !== null && hovered >= 0 && hovered < dataPoints.length ? dataPoints[hovered] : null
  const hoveredX = hovered !== null ? xScale(hovered) : 0
  const hoveredY = hovered !== null && hoveredPoint ? yScale(hoveredPoint.total) : 0

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full"
          style={{ height: 160 }}
          preserveAspectRatio="none"
          onMouseLeave={() => setHovered(null)}
        >
          {/* Grid lines */}
          <line
            x1={padLeft} y1={padTop + plotH}
            x2={padLeft + plotW} y2={padTop + plotH}
            stroke="#3f3f46" strokeWidth="1"
          />
          <line
            x1={padLeft} y1={padTop}
            x2={padLeft + plotW} y2={padTop}
            stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="4,4"
          />

          {/* Context limit line */}
          {showLimitLine && (
            <>
              <line
                x1={padLeft} y1={limitY}
                x2={padLeft + plotW} y2={limitY}
                stroke="#52525b" strokeWidth="1" strokeDasharray="6,4"
              />
              <text
                x={padLeft + plotW + 4} y={limitY + 3}
                className="text-[9px]" fill="#71717a"
                style={{ fontSize: 9 }}
              >
                {formatTokens(contextLimit)}
              </text>
            </>
          )}

          {/* Stacked areas */}
          <path d={inputPath} fill="rgba(59,130,246,0.15)" />
          <path d={outputPath} fill="rgba(139,92,246,0.15)" />
          <path d={cachePath} fill="rgba(16,185,129,0.15)" />

          {/* Line strokes */}
          <path d={inputLine} fill="none" stroke="rgba(59,130,246,0.6)" strokeWidth="1.5" />
          <path d={outputLine} fill="none" stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" />
          <path d={totalLine} fill="none" stroke="rgba(16,185,129,0.6)" strokeWidth="1.5" />

          {/* Y-axis labels */}
          <text
            x={padLeft - 4} y={padTop + plotH + 1}
            textAnchor="end" fill="#71717a"
            style={{ fontSize: 9 }}
          >
            0
          </text>
          <text
            x={padLeft - 4} y={padTop + 4}
            textAnchor="end" fill="#71717a"
            style={{ fontSize: 9 }}
          >
            {formatTokens(Math.round(yMax))}
          </text>

          {/* X-axis labels */}
          <text
            x={padLeft} y={chartHeight - 4}
            textAnchor="start" fill="#71717a"
            style={{ fontSize: 9 }}
          >
            Start
          </text>
          <text
            x={padLeft + plotW} y={chartHeight - 4}
            textAnchor="end" fill="#71717a"
            style={{ fontSize: 9 }}
          >
            End
          </text>

          {/* Fill percentage at final point */}
          <text
            x={padLeft + plotW + 4}
            y={yScale(dataPoints[dataPoints.length - 1].total) + 3}
            fill="#a1a1aa"
            style={{ fontSize: 10, fontWeight: 500 }}
          >
            {finalPct}%
          </text>

          {/* Hover interaction areas */}
          {dataPoints.map((_, i) => {
            const bw = n === 1 ? plotW : plotW / (n - 1)
            const bx = n === 1 ? padLeft : xScale(i) - bw / 2
            return (
              <rect
                key={i}
                x={Math.max(bx, padLeft)}
                y={padTop}
                width={Math.min(bw, plotW)}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
              />
            )
          })}

          {/* Hover crosshair and dot */}
          {hoveredPoint && hovered !== null && (
            <>
              <line
                x1={hoveredX} y1={padTop}
                x2={hoveredX} y2={padTop + plotH}
                stroke="#52525b" strokeWidth="1" strokeDasharray="3,3"
              />
              <circle cx={hoveredX} cy={hoveredY} r="3" fill="#10b981" stroke="#18181b" strokeWidth="1.5" />
            </>
          )}
        </svg>

        {/* Tooltip overlay */}
        {hoveredPoint && hovered !== null && (
          <div
            className="absolute z-10 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-2 text-xs shadow-lg whitespace-nowrap pointer-events-none"
            style={{
              left: `${(hoveredX / chartWidth) * 100}%`,
              top: -8,
              transform: hoveredX > chartWidth * 0.7 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            <p className="font-medium text-zinc-200 mb-1">Message {hoveredPoint.messageIndex + 1}</p>
            <div className="space-y-0.5">
              <p className="text-blue-400">Input: {formatTokens(hoveredPoint.cumulativeInput)}</p>
              <p className="text-violet-400">Output: {formatTokens(hoveredPoint.cumulativeOutput)}</p>
              <p className="text-emerald-400">Cache: {formatTokens(hoveredPoint.cumulativeCache)}</p>
            </div>
            <p className="text-zinc-400 mt-1 pt-1 border-t border-zinc-700">
              {((hoveredPoint.total / contextLimit) * 100).toFixed(1)}% of context
            </p>
          </div>
        )}
      </div>

      {/* Legend and stats */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-blue-500" />
            Input
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-violet-500" />
            Output
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            Cache
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>Peak: {peakPct}%</span>
          <span>Total: {formatTokens(peakTotal)}</span>
        </div>
      </div>
    </div>
  )
}
