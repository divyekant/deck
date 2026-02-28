import { NextRequest, NextResponse } from "next/server"
import { listSessions } from "@/lib/claude/sessions"
import type { SessionMeta } from "@/lib/claude/types"

type ExportType = "sessions" | "costs" | "tokens" | "models"
type ExportFormat = "json" | "csv"

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function formatDurationSeconds(ms: number): number {
  return Math.round(ms / 1000)
}

function filterByDateRange(
  sessions: SessionMeta[],
  startDate?: string,
  endDate?: string
): SessionMeta[] {
  let filtered = sessions
  if (startDate) {
    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    filtered = filtered.filter(
      (s) => new Date(s.startTime).getTime() >= start.getTime()
    )
  }
  if (endDate) {
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    filtered = filtered.filter(
      (s) => new Date(s.startTime).getTime() <= end.getTime()
    )
  }
  return filtered
}

// ---- Export: Sessions ----

interface SessionRow {
  id: string
  project: string
  startTime: string
  duration: number
  messages: number
  cost: number
  model: string
  cacheReads: number
  cacheWrites: number
}

function buildSessionsData(sessions: SessionMeta[]): SessionRow[] {
  return sessions.map((s) => ({
    id: s.id,
    project: s.projectName,
    startTime: s.startTime,
    duration: formatDurationSeconds(s.duration),
    messages: s.messageCount,
    cost: Math.round(s.estimatedCost * 10000) / 10000,
    model: s.model,
    cacheReads: s.cacheReadTokens,
    cacheWrites: s.cacheCreationTokens,
  }))
}

function sessionsToCSV(rows: SessionRow[]): string {
  const header = [
    "ID",
    "Project",
    "Start Time",
    "Duration (s)",
    "Messages",
    "Cost (USD)",
    "Model",
    "Cache Reads",
    "Cache Writes",
  ].join(",")

  const lines = rows.map((r) =>
    [
      escapeCSV(r.id),
      escapeCSV(r.project),
      escapeCSV(r.startTime),
      r.duration,
      r.messages,
      r.cost,
      escapeCSV(r.model),
      r.cacheReads,
      r.cacheWrites,
    ].join(",")
  )

  return [header, ...lines].join("\n")
}

// ---- Export: Costs (daily breakdown) ----

interface CostRow {
  date: string
  sessions: number
  totalCost: number
  avgCostPerSession: number
}

function buildCostsData(sessions: SessionMeta[]): CostRow[] {
  const dailyMap = new Map<string, { sessions: number; cost: number }>()

  for (const s of sessions) {
    const dateKey = new Date(s.startTime).toISOString().slice(0, 10)
    const entry = dailyMap.get(dateKey) ?? { sessions: 0, cost: 0 }
    entry.sessions += 1
    entry.cost += s.estimatedCost
    dailyMap.set(dateKey, entry)
  }

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      sessions: data.sessions,
      totalCost: Math.round(data.cost * 10000) / 10000,
      avgCostPerSession:
        data.sessions > 0
          ? Math.round((data.cost / data.sessions) * 10000) / 10000
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function costsToCSV(rows: CostRow[]): string {
  const header = [
    "Date",
    "Sessions",
    "Total Cost (USD)",
    "Avg Cost/Session (USD)",
  ].join(",")

  const lines = rows.map((r) =>
    [r.date, r.sessions, r.totalCost, r.avgCostPerSession].join(",")
  )

  return [header, ...lines].join("\n")
}

// ---- Export: Tokens (per session) ----

interface TokenRow {
  id: string
  project: string
  model: string
  startTime: string
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
}

function buildTokensData(sessions: SessionMeta[]): TokenRow[] {
  return sessions.map((s) => ({
    id: s.id,
    project: s.projectName,
    model: s.model,
    startTime: s.startTime,
    inputTokens: s.totalInputTokens,
    outputTokens: s.totalOutputTokens,
    cacheCreationTokens: s.cacheCreationTokens,
    cacheReadTokens: s.cacheReadTokens,
    totalTokens:
      s.totalInputTokens +
      s.totalOutputTokens +
      s.cacheCreationTokens +
      s.cacheReadTokens,
  }))
}

function tokensToCSV(rows: TokenRow[]): string {
  const header = [
    "ID",
    "Project",
    "Model",
    "Start Time",
    "Input Tokens",
    "Output Tokens",
    "Cache Creation Tokens",
    "Cache Read Tokens",
    "Total Tokens",
  ].join(",")

  const lines = rows.map((r) =>
    [
      escapeCSV(r.id),
      escapeCSV(r.project),
      escapeCSV(r.model),
      escapeCSV(r.startTime),
      r.inputTokens,
      r.outputTokens,
      r.cacheCreationTokens,
      r.cacheReadTokens,
      r.totalTokens,
    ].join(",")
  )

  return [header, ...lines].join("\n")
}

// ---- Export: Models (summary) ----

interface ModelRow {
  model: string
  sessions: number
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  avgCostPerSession: number
}

function buildModelsData(sessions: SessionMeta[]): ModelRow[] {
  const modelMap = new Map<
    string,
    {
      sessions: number
      cost: number
      input: number
      output: number
      cacheCreate: number
      cacheRead: number
    }
  >()

  for (const s of sessions) {
    const entry = modelMap.get(s.model) ?? {
      sessions: 0,
      cost: 0,
      input: 0,
      output: 0,
      cacheCreate: 0,
      cacheRead: 0,
    }
    entry.sessions += 1
    entry.cost += s.estimatedCost
    entry.input += s.totalInputTokens
    entry.output += s.totalOutputTokens
    entry.cacheCreate += s.cacheCreationTokens
    entry.cacheRead += s.cacheReadTokens
    modelMap.set(s.model, entry)
  }

  return Array.from(modelMap.entries())
    .map(([model, data]) => ({
      model,
      sessions: data.sessions,
      totalCost: Math.round(data.cost * 10000) / 10000,
      totalInputTokens: data.input,
      totalOutputTokens: data.output,
      totalCacheCreationTokens: data.cacheCreate,
      totalCacheReadTokens: data.cacheRead,
      avgCostPerSession:
        data.sessions > 0
          ? Math.round((data.cost / data.sessions) * 10000) / 10000
          : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}

function modelsToCSV(rows: ModelRow[]): string {
  const header = [
    "Model",
    "Sessions",
    "Total Cost (USD)",
    "Total Input Tokens",
    "Total Output Tokens",
    "Total Cache Creation Tokens",
    "Total Cache Read Tokens",
    "Avg Cost/Session (USD)",
  ].join(",")

  const lines = rows.map((r) =>
    [
      escapeCSV(r.model),
      r.sessions,
      r.totalCost,
      r.totalInputTokens,
      r.totalOutputTokens,
      r.totalCacheCreationTokens,
      r.totalCacheReadTokens,
      r.avgCostPerSession,
    ].join(",")
  )

  return [header, ...lines].join("\n")
}

// ---- Route Handler ----

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get("type") as ExportType | null
    const format = searchParams.get("format") as ExportFormat | null
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined

    // Validate type
    const validTypes: ExportType[] = ["sessions", "costs", "tokens", "models"]
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'type must be one of: sessions, costs, tokens, models' },
        { status: 400 }
      )
    }

    // Validate format
    const validFormats: ExportFormat[] = ["json", "csv"]
    if (!format || !validFormats.includes(format)) {
      return NextResponse.json(
        { error: 'format must be one of: json, csv' },
        { status: 400 }
      )
    }

    // Load and filter sessions
    const allSessions = await listSessions()
    const filtered = filterByDateRange(allSessions, startDate, endDate)

    // Build data based on export type
    let data: unknown[]
    let csvContent: string
    let filename: string

    switch (type) {
      case "sessions": {
        const rows = buildSessionsData(filtered)
        data = rows
        csvContent = sessionsToCSV(rows)
        filename = "deck-sessions"
        break
      }
      case "costs": {
        const rows = buildCostsData(filtered)
        data = rows
        csvContent = costsToCSV(rows)
        filename = "deck-costs"
        break
      }
      case "tokens": {
        const rows = buildTokensData(filtered)
        data = rows
        csvContent = tokensToCSV(rows)
        filename = "deck-tokens"
        break
      }
      case "models": {
        const rows = buildModelsData(filtered)
        data = rows
        csvContent = modelsToCSV(rows)
        filename = "deck-models"
        break
      }
    }

    // Add date range to filename if specified
    if (startDate || endDate) {
      const parts: string[] = []
      if (startDate) parts.push(startDate)
      if (endDate) parts.push(endDate)
      filename += `-${parts.join("-to-")}`
    }

    if (format === "csv") {
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      })
    }

    // JSON format
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    })
  } catch (error) {
    console.error("Failed to export data:", error)
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    )
  }
}
