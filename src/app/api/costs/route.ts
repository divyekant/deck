import { NextRequest, NextResponse } from "next/server"
import { listSessions } from "@/lib/claude/sessions"
import type { SessionMeta } from "@/lib/claude/types"

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

interface CostsResponse {
  totalCost: number
  sessionCount: number
  dailyCosts: DailyCost[]
  modelCosts: ModelCost[]
  projectCosts: ProjectCost[]
  expensiveSessions: ExpensiveSession[]
  range: Range
}

function getDateRange(range: Range): { start: Date; end: Date } {
  const now = new Date()
  switch (range) {
    case "thisMonth": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      start.setHours(0, 0, 0, 0)
      return { start, end: now }
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
      return { start, end }
    }
    case "90d": {
      const start = new Date(now)
      start.setDate(start.getDate() - 89)
      start.setHours(0, 0, 0, 0)
      return { start, end: now }
    }
    case "all": {
      return { start: new Date(0), end: now }
    }
  }
}

function fillDailyZeros(
  costMap: Map<string, number>,
  start: Date,
  end: Date
): DailyCost[] {
  const result: DailyCost[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(23, 59, 59, 999)

  while (cursor <= endDate) {
    const dateKey = cursor.toISOString().slice(0, 10)
    result.push({ date: dateKey, cost: costMap.get(dateKey) ?? 0 })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const rangeParam = searchParams.get("range") || "thisMonth"
    const range: Range = ["thisMonth", "lastMonth", "90d", "all"].includes(rangeParam)
      ? (rangeParam as Range)
      : "thisMonth"

    const allSessions = await listSessions()
    const { start, end } = getDateRange(range)

    // Filter sessions by date range
    const filtered: SessionMeta[] = allSessions.filter((s) => {
      const t = new Date(s.startTime).getTime()
      return t >= start.getTime() && t <= end.getTime()
    })

    // Aggregate totals
    let totalCost = 0
    const dailyMap = new Map<string, number>()
    const modelMap = new Map<string, { cost: number; sessions: number }>()
    const projectMap = new Map<string, { cost: number; sessions: number }>()

    for (const s of filtered) {
      totalCost += s.estimatedCost

      // Daily
      const dateKey = new Date(s.startTime).toISOString().slice(0, 10)
      dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + s.estimatedCost)

      // Model
      const modelEntry = modelMap.get(s.model) ?? { cost: 0, sessions: 0 }
      modelEntry.cost += s.estimatedCost
      modelEntry.sessions += 1
      modelMap.set(s.model, modelEntry)

      // Project
      const projEntry = projectMap.get(s.projectName) ?? { cost: 0, sessions: 0 }
      projEntry.cost += s.estimatedCost
      projEntry.sessions += 1
      projectMap.set(s.projectName, projEntry)
    }

    // Daily costs with zero-fill
    const dailyCosts = fillDailyZeros(dailyMap, start, end)

    // Model costs sorted by cost desc
    const modelCosts: ModelCost[] = Array.from(modelMap.entries())
      .map(([model, data]) => ({ model, cost: data.cost, sessions: data.sessions }))
      .sort((a, b) => b.cost - a.cost)

    // Project costs top 10 by cost desc
    const projectCosts: ProjectCost[] = Array.from(projectMap.entries())
      .map(([projectName, data]) => ({
        projectName,
        cost: data.cost,
        sessions: data.sessions,
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)

    // Top 20 most expensive sessions
    const expensiveSessions: ExpensiveSession[] = filtered
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
      .slice(0, 20)
      .map((s) => ({
        id: s.id,
        projectName: s.projectName,
        model: s.model,
        firstPrompt: s.firstPrompt,
        estimatedCost: s.estimatedCost,
        startTime: s.startTime,
      }))

    const response: CostsResponse = {
      totalCost,
      sessionCount: filtered.length,
      dailyCosts,
      modelCosts,
      projectCosts,
      expensiveSessions,
      range,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to compute costs:", error)
    return NextResponse.json(
      { error: "Failed to compute costs" },
      { status: 500 }
    )
  }
}
