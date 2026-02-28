import { NextRequest, NextResponse } from "next/server"
import { listSessions } from "@/lib/claude/sessions"
import type { SessionMeta } from "@/lib/claude/types"

type ReportType = "weekly" | "monthly" | "project"

interface DailyActivityEntry {
  date: string
  count: number
  cost: number
}

interface TopSession {
  id: string
  prompt: string
  cost: number
  project: string
  model: string
}

interface ModelBreakdownEntry {
  model: string
  cost: number
  sessions: number
}

interface ReportResponse {
  title: string
  dateRange: { start: string; end: string }
  summary: {
    sessions: number
    cost: number
    models: number
    projects: string[]
  }
  dailyActivity: DailyActivityEntry[]
  topSessions: TopSession[]
  modelBreakdown: ModelBreakdownEntry[]
  availableProjects: string[]
}

function getDateRange(type: ReportType): { start: Date; end: Date } {
  const now = new Date()
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)

  switch (type) {
    case "weekly": {
      const start = new Date(now)
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case "monthly": {
      const start = new Date(now)
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case "project": {
      // For project reports, include all time
      return { start: new Date(0), end }
    }
  }
}

function formatDateRange(start: Date, end: Date): { start: string; end: string } {
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

function fillDailyActivity(
  sessions: SessionMeta[],
  start: Date,
  end: Date
): DailyActivityEntry[] {
  const dailyMap = new Map<string, { count: number; cost: number }>()

  for (const s of sessions) {
    const dateKey = new Date(s.startTime).toISOString().slice(0, 10)
    const existing = dailyMap.get(dateKey) ?? { count: 0, cost: 0 }
    existing.count += 1
    existing.cost += s.estimatedCost
    dailyMap.set(dateKey, existing)
  }

  const result: DailyActivityEntry[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endDate = new Date(end)
  endDate.setHours(23, 59, 59, 999)

  while (cursor <= endDate) {
    const dateKey = cursor.toISOString().slice(0, 10)
    const entry = dailyMap.get(dateKey)
    result.push({
      date: dateKey,
      count: entry?.count ?? 0,
      cost: entry?.cost ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return result
}

function getTitle(type: ReportType, projectName?: string): string {
  switch (type) {
    case "weekly":
      return "Weekly Activity Report"
    case "monthly":
      return "Monthly Activity Report"
    case "project":
      return `Project Report: ${projectName ?? "Unknown"}`
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const typeParam = searchParams.get("type") || "weekly"
    const projectParam = searchParams.get("project") || undefined

    const type: ReportType = ["weekly", "monthly", "project"].includes(typeParam)
      ? (typeParam as ReportType)
      : "weekly"

    const allSessions = await listSessions()
    const availableProjects = [...new Set(allSessions.map((s) => s.projectName))].sort()

    const { start, end } = getDateRange(type)

    // Filter sessions by date range
    let filtered: SessionMeta[] = allSessions.filter((s) => {
      const t = new Date(s.startTime).getTime()
      return t >= start.getTime() && t <= end.getTime()
    })

    // For project reports, additionally filter by project name
    if (type === "project" && projectParam) {
      filtered = filtered.filter((s) => s.projectName === projectParam)
    }

    // Summary
    let totalCost = 0
    const modelSet = new Set<string>()
    const projectSet = new Set<string>()
    const modelMap = new Map<string, { cost: number; sessions: number }>()

    for (const s of filtered) {
      totalCost += s.estimatedCost
      modelSet.add(s.model)
      projectSet.add(s.projectName)

      const entry = modelMap.get(s.model) ?? { cost: 0, sessions: 0 }
      entry.cost += s.estimatedCost
      entry.sessions += 1
      modelMap.set(s.model, entry)
    }

    // Daily activity with zero-fill
    const dailyActivity = fillDailyActivity(filtered, start, end)

    // Top 10 most expensive sessions
    const topSessions: TopSession[] = [...filtered]
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
      .slice(0, 10)
      .map((s) => ({
        id: s.id,
        prompt: s.firstPrompt,
        cost: s.estimatedCost,
        project: s.projectName,
        model: s.model,
      }))

    // Model breakdown sorted by cost desc
    const modelBreakdown: ModelBreakdownEntry[] = Array.from(modelMap.entries())
      .map(([model, data]) => ({
        model,
        cost: data.cost,
        sessions: data.sessions,
      }))
      .sort((a, b) => b.cost - a.cost)

    const response: ReportResponse = {
      title: getTitle(type, projectParam),
      dateRange: formatDateRange(start, end),
      summary: {
        sessions: filtered.length,
        cost: totalCost,
        models: modelSet.size,
        projects: [...projectSet].sort(),
      },
      dailyActivity,
      topSessions,
      modelBreakdown,
      availableProjects,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Failed to generate report:", error)
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    )
  }
}
