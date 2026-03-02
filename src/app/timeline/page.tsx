"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { LayoutList, LayoutGrid, MessageSquare, Clock as ClockIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCost } from "@/lib/claude/costs"
import { getProjectColor } from "@/lib/project-colors"
import type { SessionMeta } from "@/lib/claude/types"

// ---- Helpers ----

function dateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date >= today) return "Today"
  if (date >= yesterday) return "Yesterday"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function dateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const hr = Math.floor(min / 60)
  const remainMin = min % 60
  return `${hr}h ${remainMin}m`
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + "..."
}

function shortModel(model: string): string {
  return model.replace("claude-", "").replace(/-\d{8}$/, "")
}

function getModelBadgeClasses(model: string): string {
  const m = model.toLowerCase()
  if (m.includes("opus")) return "bg-orange-900/60 text-orange-300 border-orange-800/50"
  if (m.includes("sonnet")) return "bg-blue-900/60 text-blue-300 border-blue-800/50"
  if (m.includes("haiku")) return "bg-emerald-900/60 text-emerald-300 border-emerald-800/50"
  if (m.includes("gpt") || m.includes("o3") || m.includes("o4"))
    return "bg-violet-900/60 text-violet-300 border-violet-800/50"
  if (m.includes("codex")) return "bg-cyan-900/60 text-cyan-300 border-cyan-800/50"
  return "bg-zinc-800 text-zinc-300 border-zinc-700"
}

function getSourceBadgeClasses(source: string): string {
  if (source === "codex") return "bg-violet-900/60 text-violet-300 border-violet-800/50"
  return "bg-zinc-800 text-zinc-400 border-zinc-700"
}

// ---- Types ----

interface DayGroup {
  key: string
  label: string
  sessions: SessionMeta[]
  totalCost: number
}

// ---- Component ----

export default function TimelinePage() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions?limit=200")
        if (!res.ok) return
        const json = await res.json()
        setSessions(json.sessions ?? [])
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, SessionMeta[]>()
    for (const s of sessions) {
      const k = dateKey(s.startTime)
      const arr = map.get(k)
      if (arr) arr.push(s)
      else map.set(k, [s])
    }
    // Sort days descending
    const sortedKeys = [...map.keys()].sort((a, b) => b.localeCompare(a))
    return sortedKeys.map((k) => {
      const group = map.get(k)!
      return {
        key: k,
        label: dateLabel(group[0].startTime),
        sessions: group,
        totalCost: group.reduce((sum, s) => sum + s.estimatedCost, 0),
      }
    })
  }, [sessions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Timeline
        </h1>
        <button
          onClick={() => setCompact((c) => !c)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          title={compact ? "Expanded view" : "Compact view"}
        >
          {compact ? (
            <LayoutGrid className="size-3.5" />
          ) : (
            <LayoutList className="size-3.5" />
          )}
          {compact ? "Expanded" : "Compact"}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="relative pl-8">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-800" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="relative mb-6 flex items-start gap-4">
              <Skeleton className="absolute left-[-24.5px] top-1.5 size-2.5 rounded-full" />
              <Skeleton className="h-4 w-16 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="py-16 text-center text-sm text-zinc-500">
          No sessions yet.
        </div>
      )}

      {/* Timeline */}
      {!loading && sessions.length > 0 && (
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-800" />

          {dayGroups.map((group) => (
            <div key={group.key} className="mb-8">
              {/* Day header */}
              <div className="relative mb-4 flex items-baseline gap-3">
                <div className="absolute left-[-22.5px] top-1 size-1.5 rounded-full bg-zinc-600" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  {group.label}
                </h2>
                <span className="text-xs text-zinc-500">
                  {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""} &middot;{" "}
                  {formatCost(group.totalCost)}
                </span>
              </div>

              {/* Session entries */}
              <div className="space-y-1">
                {group.sessions.map((session) => {
                  const color = getProjectColor(session.projectName)

                  if (compact) {
                    // Compact mode: single line per session
                    return (
                      <Link
                        key={session.id}
                        href={`/sessions/${session.id}`}
                        className="group relative flex items-center gap-3 rounded-md py-1.5 pl-1 pr-2 transition-colors hover:bg-zinc-800/60"
                      >
                        {/* Dot */}
                        <div
                          className={`absolute left-[-23.5px] top-1/2 size-2 -translate-y-1/2 rounded-full ${color.dot}`}
                        />
                        {/* Time */}
                        <span className="w-[72px] shrink-0 text-xs tabular-nums text-zinc-500">
                          {formatTime(session.startTime)}
                        </span>
                        {/* Project */}
                        <span className={`text-xs font-medium ${color.text}`}>
                          {session.projectName}
                        </span>
                        {/* Model */}
                        <span className="text-xs text-zinc-500">
                          {shortModel(session.model)}
                        </span>
                        {/* Cost */}
                        <span className="ml-auto text-xs tabular-nums text-zinc-500">
                          {formatCost(session.estimatedCost)}
                        </span>
                      </Link>
                    )
                  }

                  // Expanded mode: full card
                  return (
                    <Link
                      key={session.id}
                      href={`/sessions/${session.id}`}
                      className="group relative flex gap-3 rounded-lg py-2.5 pl-1 pr-3 transition-colors hover:bg-zinc-800/40"
                    >
                      {/* Dot */}
                      <div
                        className={`absolute left-[-24.5px] top-4 size-2.5 rounded-full ${color.dot}`}
                      />
                      {/* Time column */}
                      <span className="w-[72px] shrink-0 pt-0.5 text-xs tabular-nums text-zinc-500">
                        {formatTime(session.startTime)}
                      </span>
                      {/* Card content */}
                      <div className="min-w-0 flex-1">
                        {/* Top row: badges */}
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${color.bg} ${color.text} ${color.border}`}
                          >
                            {session.projectName}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${getModelBadgeClasses(session.model)}`}
                          >
                            {shortModel(session.model)}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${getSourceBadgeClasses(session.source)}`}
                          >
                            {session.source === "codex" ? "Codex" : "CC"}
                          </Badge>
                        </div>
                        {/* Prompt text */}
                        <p className="mb-1.5 text-sm leading-snug text-zinc-300 group-hover:text-zinc-100">
                          {truncate(session.firstPrompt || "Untitled session", 120)}
                        </p>
                        {/* Bottom row: stats */}
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="size-3" />
                            {session.messageCount} msgs
                          </span>
                          <span>{formatCost(session.estimatedCost)}</span>
                          <span className="flex items-center gap-1">
                            <ClockIcon className="size-3" />
                            {formatDuration(session.duration)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
