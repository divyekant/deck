"use client"

import { useEffect, useState } from "react"
import {
  Lightbulb,
  Calendar,
  Clock,
  Cpu,
  Flame,
  DollarSign,
  Zap,
  TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

// ---- Types ----

interface Insight {
  id: string
  title: string
  description: string
  value: string
  icon: string
  category: "productivity" | "usage" | "efficiency" | "cost"
}

// ---- Constants ----

const ICON_MAP: Record<string, LucideIcon> = {
  Calendar,
  Clock,
  Cpu,
  Flame,
  DollarSign,
  Zap,
  TrendingUp,
}

const CATEGORY_COLORS: Record<string, string> = {
  productivity: "border-l-emerald-500",
  usage: "border-l-blue-500",
  efficiency: "border-l-amber-500",
  cost: "border-l-rose-500",
}

const CATEGORY_ICON_COLORS: Record<string, string> = {
  productivity: "text-emerald-400",
  usage: "text-blue-400",
  efficiency: "text-amber-400",
  cost: "text-rose-400",
}

const CATEGORY_BG_COLORS: Record<string, string> = {
  productivity: "bg-emerald-500/10",
  usage: "bg-blue-500/10",
  efficiency: "bg-amber-500/10",
  cost: "bg-rose-500/10",
}

// ---- Components ----

function InsightCard({ insight }: { insight: Insight }) {
  const Icon = ICON_MAP[insight.icon] ?? Lightbulb
  const borderColor = CATEGORY_COLORS[insight.category] ?? "border-l-zinc-600"
  const iconColor = CATEGORY_ICON_COLORS[insight.category] ?? "text-zinc-400"
  const bgColor = CATEGORY_BG_COLORS[insight.category] ?? "bg-zinc-800"

  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900 p-5 border-l-4 ${borderColor} transition-colors hover:bg-zinc-900/80`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bgColor}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-400">{insight.title}</p>
          <p className="mt-1 truncate text-2xl font-bold tracking-tight text-zinc-100">
            {insight.value}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
            {insight.description}
          </p>
        </div>
      </div>
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40 bg-zinc-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-[120px] rounded-lg bg-zinc-800/50"
          />
        ))}
      </div>
    </div>
  )
}

// ---- Page ----

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchInsights() {
      try {
        const res = await fetch("/api/insights")
        if (!res.ok) throw new Error("Failed to fetch insights")
        const json = await res.json()
        if (active) {
          setInsights(json.insights ?? [])
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

    fetchInsights()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <InsightsSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex items-center gap-2.5">
          <Lightbulb className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Insights
          </h1>
        </div>
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-8">
          <p className="text-center text-sm text-zinc-500">
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="flex items-center gap-2.5">
          <Lightbulb className="h-6 w-6 text-amber-400" />
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Insights
          </h1>
        </div>
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-8">
          <p className="text-center text-sm text-zinc-500">
            No session data yet. Start a coding session to generate insights.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center gap-2.5">
        <Lightbulb className="h-6 w-6 text-amber-400" />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Insights
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  )
}
