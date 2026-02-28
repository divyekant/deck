"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowUp, ArrowDown, Minus, Activity } from "lucide-react"
import { formatCost } from "@/lib/claude/costs"
import { getProjectColor } from "@/lib/project-colors"

// ---- Types ----

interface ProjectHealth {
  name: string
  healthScore: number
  trend: "improving" | "declining" | "stable"
  dimensions: {
    frequency: number
    costEfficiency: number
    cacheEfficiency: number
    sessionDepth: number
  }
  sessionCount: number
  totalCost: number
  recentSessions: number
}

// ---- Radar Chart ----

function RadarChart({
  dimensions,
  color,
}: {
  dimensions: ProjectHealth["dimensions"]
  color: string
}) {
  const size = 120
  const cx = size / 2
  const cy = size / 2
  const radius = 44

  // 4 axes: top, right, bottom, left
  const axes = [
    { label: "Freq", value: dimensions.frequency, angle: -Math.PI / 2 },
    { label: "Cost", value: dimensions.costEfficiency, angle: 0 },
    { label: "Depth", value: dimensions.sessionDepth, angle: Math.PI / 2 },
    { label: "Cache", value: dimensions.cacheEfficiency, angle: Math.PI },
  ]

  // Grid rings at 33%, 66%, 100%
  const rings = [0.33, 0.66, 1.0]

  // Axis endpoints
  const axisPoints = axes.map((a) => ({
    x: cx + radius * Math.cos(a.angle),
    y: cy + radius * Math.sin(a.angle),
  }))

  // Data polygon
  const dataPoints = axes.map((a) => {
    const r = (a.value / 25) * radius
    return {
      x: cx + r * Math.cos(a.angle),
      y: cy + r * Math.sin(a.angle),
    }
  })
  const polygonPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z"

  // Label positions (slightly outside axes)
  const labelOffset = 14
  const labelPoints = axes.map((a) => ({
    x: cx + (radius + labelOffset) * Math.cos(a.angle),
    y: cy + (radius + labelOffset) * Math.sin(a.angle),
    label: a.label,
    anchor: (
      Math.abs(Math.cos(a.angle)) < 0.01
        ? "middle"
        : Math.cos(a.angle) > 0
          ? "start"
          : "end"
    ) as "start" | "middle" | "end",
    baseline: (
      Math.abs(Math.sin(a.angle)) < 0.01
        ? "middle"
        : Math.sin(a.angle) > 0
          ? "hanging"
          : "auto"
    ) as "middle" | "hanging" | "auto",
  }))

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Grid rings */}
      {rings.map((scale) => {
        const ringPoints = axes
          .map((a) => {
            const r = scale * radius
            return `${cx + r * Math.cos(a.angle)},${cy + r * Math.sin(a.angle)}`
          })
          .join(" ")
        return (
          <polygon
            key={scale}
            points={ringPoints}
            fill="none"
            stroke="rgb(63 63 70)" // zinc-700
            strokeWidth="0.5"
          />
        )
      })}

      {/* Axis lines */}
      {axisPoints.map((p, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={p.x}
          y2={p.y}
          stroke="rgb(63 63 70)"
          strokeWidth="0.5"
        />
      ))}

      {/* Data polygon */}
      <path
        d={polygonPath}
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="1.5"
      />

      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} />
      ))}

      {/* Labels */}
      {labelPoints.map((lp) => (
        <text
          key={lp.label}
          x={lp.x}
          y={lp.y}
          textAnchor={lp.anchor}
          dominantBaseline={lp.baseline}
          className="fill-zinc-500 text-[9px]"
        >
          {lp.label}
        </text>
      ))}
    </svg>
  )
}

// ---- Health Ring ----

function HealthRing({ score, size = 56 }: { score: number; size?: number }) {
  const strokeWidth = 4
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const progress = (score / 100) * circumference
  const ringColor =
    score > 75
      ? "rgb(52 211 153)" // emerald-400
      : score >= 50
        ? "rgb(251 191 36)" // amber-400
        : "rgb(251 113 133)" // rose-400

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(39 39 42)" // zinc-800
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-bold"
        style={{ color: ringColor }}
      >
        {score}
      </span>
    </div>
  )
}

// ---- Trend Badge ----

function TrendBadge({ trend }: { trend: ProjectHealth["trend"] }) {
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <ArrowUp className="size-3" />
        Improving
      </span>
    )
  }
  if (trend === "declining") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-rose-400">
        <ArrowDown className="size-3" />
        Declining
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
      <Minus className="size-3" />
      Stable
    </span>
  )
}

// ---- Color map for radar (hex values from project colors) ----

const COLOR_HEX: Record<string, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
  lime: "#84cc16",
  indigo: "#6366f1",
}

// ---- Page ----

export default function HealthPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<ProjectHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState("health")

  useEffect(() => {
    async function fetchHealth() {
      try {
        setLoading(true)
        const res = await fetch(`/api/health?sort=${sort}`)
        if (!res.ok) throw new Error("Failed to fetch health data")
        const data = await res.json()
        setProjects(data.projects)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [sort])

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Project Health
          </h1>
          {!loading && (
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
              {projects.length}
            </Badge>
          )}
        </div>

        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[160px] border-zinc-700 bg-zinc-900 text-zinc-300">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="health">Healthiest</SelectItem>
            <SelectItem value="active">Most Active</SelectItem>
            <SelectItem value="cost">Most Expensive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl bg-zinc-800" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2">
          <Activity className="size-8 text-zinc-600" />
          <p className="text-sm text-muted-foreground">
            No projects found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const projectColor = getProjectColor(project.name)
            const radarHex = COLOR_HEX[projectColor.name] || "#10b981"

            // Compute cache rate for display
            const cacheDisplayRate =
              project.dimensions.cacheEfficiency >= 25
                ? ">60%"
                : project.dimensions.cacheEfficiency >= 20
                  ? ">40%"
                  : project.dimensions.cacheEfficiency >= 15
                    ? ">20%"
                    : project.dimensions.cacheEfficiency >= 10
                      ? ">10%"
                      : "<10%"

            return (
              <Card
                key={project.name}
                className="cursor-pointer border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
                onClick={() =>
                  router.push(
                    `/repos/${encodeURIComponent(project.name)}`
                  )
                }
              >
                <CardContent className="pt-0">
                  {/* Top row: name + score */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`mt-1 size-2.5 shrink-0 rounded-full ${projectColor.dot}`}
                      />
                      <div className="min-w-0">
                        <p
                          className={`text-lg font-semibold truncate ${projectColor.text}`}
                        >
                          {project.name}
                        </p>
                        <TrendBadge trend={project.trend} />
                      </div>
                    </div>
                    <HealthRing score={project.healthScore} />
                  </div>

                  {/* Radar chart */}
                  <div className="mt-3">
                    <RadarChart
                      dimensions={project.dimensions}
                      color={radarHex}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-muted-foreground">
                    <span>
                      <span className="font-medium text-zinc-300">
                        {project.sessionCount}
                      </span>{" "}
                      session{project.sessionCount !== 1 ? "s" : ""}
                    </span>
                    <span>
                      <span className="font-medium text-zinc-300">
                        {formatCost(project.totalCost)}
                      </span>{" "}
                      total
                    </span>
                    <span>
                      cache{" "}
                      <span className="font-medium text-zinc-300">
                        {cacheDisplayRate}
                      </span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
