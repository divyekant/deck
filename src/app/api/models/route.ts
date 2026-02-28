import { NextResponse } from "next/server"
import { listSessions } from "@/lib/claude/sessions"

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

interface ModelsResponse {
  models: ModelStats[]
  monthlyTrend: MonthlyTrend
}

export async function GET() {
  try {
    const allSessions = await listSessions()

    // Group sessions by model
    const modelMap = new Map<
      string,
      {
        sessions: number
        totalCost: number
        totalInputTokens: number
        totalOutputTokens: number
        totalDuration: number
        totalCacheRead: number
        totalCacheBase: number // totalInputTokens + cacheReadTokens for cache hit rate denominator
      }
    >()

    for (const s of allSessions) {
      const existing = modelMap.get(s.model) ?? {
        sessions: 0,
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalDuration: 0,
        totalCacheRead: 0,
        totalCacheBase: 0,
      }
      existing.sessions += 1
      existing.totalCost += s.estimatedCost
      existing.totalInputTokens += s.totalInputTokens
      existing.totalOutputTokens += s.totalOutputTokens
      existing.totalDuration += s.duration
      existing.totalCacheRead += s.cacheReadTokens
      existing.totalCacheBase += s.totalInputTokens + s.cacheReadTokens
      modelMap.set(s.model, existing)
    }

    // Compute per-model stats
    const models: ModelStats[] = Array.from(modelMap.entries())
      .map(([model, data]) => {
        const totalTokens = data.totalInputTokens + data.totalOutputTokens
        return {
          model,
          sessionCount: data.sessions,
          totalCost: data.totalCost,
          avgCost: data.sessions > 0 ? data.totalCost / data.sessions : 0,
          avgTokens: data.sessions > 0 ? totalTokens / data.sessions : 0,
          avgDuration: data.sessions > 0 ? data.totalDuration / data.sessions : 0,
          cacheHitRate: data.totalCacheBase > 0 ? data.totalCacheRead / data.totalCacheBase : 0,
          costPerToken: totalTokens > 0 ? data.totalCost / totalTokens : 0,
          totalInputTokens: data.totalInputTokens,
          totalOutputTokens: data.totalOutputTokens,
        }
      })
      .sort((a, b) => b.totalCost - a.totalCost)

    // Monthly trend: session count per month for last 6 months
    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(d.toISOString().slice(0, 7)) // YYYY-MM
    }

    // Build month -> model -> count map
    const monthModelMap = new Map<string, Map<string, number>>()
    for (const m of months) {
      monthModelMap.set(m, new Map())
    }

    for (const s of allSessions) {
      const monthKey = new Date(s.startTime).toISOString().slice(0, 7)
      const modelCounts = monthModelMap.get(monthKey)
      if (modelCounts) {
        modelCounts.set(s.model, (modelCounts.get(s.model) ?? 0) + 1)
      }
    }

    // Get all unique models that appear in the trend period
    const trendModels = new Set<string>()
    for (const modelCounts of monthModelMap.values()) {
      for (const model of modelCounts.keys()) {
        trendModels.add(model)
      }
    }

    const series = Array.from(trendModels).map((model) => ({
      model,
      counts: months.map((m) => monthModelMap.get(m)?.get(model) ?? 0),
    }))

    // Sort series by total count descending so most-used models stack on top
    series.sort(
      (a, b) =>
        b.counts.reduce((s, c) => s + c, 0) -
        a.counts.reduce((s, c) => s + c, 0)
    )

    // Format month labels
    const monthLabels = months.map((m) => {
      const d = new Date(m + "-01")
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
    })

    const response: ModelsResponse = {
      models,
      monthlyTrend: { months: monthLabels, series },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to compute model stats:", error)
    return NextResponse.json(
      { error: "Failed to compute model stats" },
      { status: 500 }
    )
  }
}
