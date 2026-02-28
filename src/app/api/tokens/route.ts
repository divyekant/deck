import { NextResponse } from "next/server"
import { listSessions } from "@/lib/claude/sessions"
import type { SessionMeta } from "@/lib/claude/types"

// ---- Response Types ----

interface CacheEfficiencyPoint {
  sessionIndex: number
  sessionId: string
  projectName: string
  cacheHitRate: number // 0-100
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

interface TokensResponse {
  cacheEfficiency: CacheEfficiencyPoint[]
  tokenDistribution: TokenDistribution
  topConsumers: TopConsumer[]
  modelComparison: ModelComparison[]
  dailyTrend: DailyTrendPoint[]
}

// ---- Helpers ----

function totalTokensForSession(s: SessionMeta): number {
  return (
    s.totalInputTokens +
    s.totalOutputTokens +
    s.cacheCreationTokens +
    s.cacheReadTokens
  )
}

function fillDailyZeros(
  tokenMap: Map<string, number>,
  days: number
): DailyTrendPoint[] {
  const result: DailyTrendPoint[] = []
  const now = new Date()
  const cursor = new Date(now)
  cursor.setDate(cursor.getDate() - days + 1)
  cursor.setHours(0, 0, 0, 0)

  for (let i = 0; i < days; i++) {
    const dateKey = cursor.toISOString().slice(0, 10)
    result.push({ date: dateKey, totalTokens: tokenMap.get(dateKey) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

// ---- GET Handler ----

export async function GET() {
  try {
    const allSessions = await listSessions()

    // -- Cache Efficiency: last 30 sessions by date --
    const sortedByDate = [...allSessions].sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )
    const last30Sessions = sortedByDate.slice(0, 30).reverse() // oldest first for chart

    const cacheEfficiency: CacheEfficiencyPoint[] = last30Sessions.map(
      (s, i) => {
        const denominator = s.totalInputTokens + s.cacheReadTokens
        const cacheHitRate =
          denominator > 0 ? (s.cacheReadTokens / denominator) * 100 : 0
        return {
          sessionIndex: i,
          sessionId: s.id,
          projectName: s.projectName,
          cacheHitRate: Math.round(cacheHitRate * 100) / 100,
          startTime: s.startTime,
        }
      }
    )

    // -- Token Distribution: sum across all sessions --
    const tokenDistribution: TokenDistribution = {
      totalInput: 0,
      totalOutput: 0,
      totalCacheCreation: 0,
      totalCacheRead: 0,
    }

    for (const s of allSessions) {
      tokenDistribution.totalInput += s.totalInputTokens
      tokenDistribution.totalOutput += s.totalOutputTokens
      tokenDistribution.totalCacheCreation += s.cacheCreationTokens
      tokenDistribution.totalCacheRead += s.cacheReadTokens
    }

    // -- Top Consumers: top 20 by total tokens --
    const topConsumers: TopConsumer[] = [...allSessions]
      .sort((a, b) => totalTokensForSession(b) - totalTokensForSession(a))
      .slice(0, 20)
      .map((s) => {
        const total = totalTokensForSession(s)
        const costPer1K = total > 0 ? (s.estimatedCost / total) * 1000 : 0
        return {
          id: s.id,
          projectName: s.projectName,
          firstPrompt: s.firstPrompt,
          model: s.model,
          totalTokens: total,
          costPer1KTokens: Math.round(costPer1K * 10000) / 10000,
          estimatedCost: s.estimatedCost,
        }
      })

    // -- Model Comparison: group by model --
    const modelMap = new Map<
      string,
      { totalTokens: number; totalCost: number; sessions: number }
    >()

    for (const s of allSessions) {
      const entry = modelMap.get(s.model) ?? {
        totalTokens: 0,
        totalCost: 0,
        sessions: 0,
      }
      entry.totalTokens += totalTokensForSession(s)
      entry.totalCost += s.estimatedCost
      entry.sessions += 1
      modelMap.set(s.model, entry)
    }

    const modelComparison: ModelComparison[] = Array.from(modelMap.entries())
      .map(([model, data]) => ({
        model,
        avgTokensPerSession:
          data.sessions > 0 ? Math.round(data.totalTokens / data.sessions) : 0,
        avgCostPerSession:
          data.sessions > 0
            ? Math.round((data.totalCost / data.sessions) * 100) / 100
            : 0,
        totalSessions: data.sessions,
        totalCost: Math.round(data.totalCost * 100) / 100,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)

    // -- Daily Trend: last 30 days --
    const now = new Date()
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
    thirtyDaysAgo.setHours(0, 0, 0, 0)

    const dailyTokenMap = new Map<string, number>()
    for (const s of allSessions) {
      const sessionDate = new Date(s.startTime)
      if (sessionDate >= thirtyDaysAgo) {
        const dateKey = sessionDate.toISOString().slice(0, 10)
        dailyTokenMap.set(
          dateKey,
          (dailyTokenMap.get(dateKey) ?? 0) + totalTokensForSession(s)
        )
      }
    }

    const dailyTrend = fillDailyZeros(dailyTokenMap, 30)

    const response: TokensResponse = {
      cacheEfficiency,
      tokenDistribution,
      topConsumers,
      modelComparison,
      dailyTrend,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to compute token analytics:", error)
    return NextResponse.json(
      { error: "Failed to compute token analytics" },
      { status: 500 }
    )
  }
}
