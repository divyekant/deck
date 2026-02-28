"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { ArrowRight, RotateCcw, Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCost, formatTokens } from "@/lib/claude/costs"
import { getProjectColor } from "@/lib/project-colors"
import type { SessionMeta } from "@/lib/claude/types"

// ---- Helpers ----

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + "..."
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

// ---- Types ----

interface FileDiffEntry {
  path: string
  action: "created" | "edited" | "modified"
  count: number
}

interface SessionDiffs {
  sessionId: string
  files: FileDiffEntry[]
  totalChanges: number
}

// ---- Comparison bar component ----

function ComparisonRow({
  label,
  valueA,
  valueB,
  formatValue,
  lowerIsBetter = true,
}: {
  label: string
  valueA: number
  valueB: number
  formatValue: (n: number) => string
  lowerIsBetter?: boolean
}) {
  const maxVal = Math.max(valueA, valueB)
  const widthA = maxVal > 0 ? (valueA / maxVal) * 100 : 0
  const widthB = maxVal > 0 ? (valueB / maxVal) * 100 : 0

  const aIsWinner = lowerIsBetter ? valueA <= valueB : valueA >= valueB
  const bIsWinner = lowerIsBetter ? valueB <= valueA : valueB >= valueA
  const isDraw = valueA === valueB

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Left bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex justify-end">
            <div className="h-6 w-full rounded-sm bg-zinc-800 overflow-hidden relative flex items-center justify-end">
              <div
                className={`absolute right-0 top-0 h-full rounded-sm transition-all duration-500 ${
                  isDraw
                    ? "bg-zinc-600"
                    : aIsWinner
                      ? "bg-emerald-500/30"
                      : "bg-rose-500/30"
                }`}
                style={{ width: `${widthA}%` }}
              />
              <span className="relative z-10 px-2 text-xs font-mono text-zinc-200">
                {formatValue(valueA)}
              </span>
            </div>
          </div>
          {!isDraw && aIsWinner && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              {lowerIsBetter ? "Lower" : "Higher"}
            </span>
          )}
          {!isDraw && !aIsWinner && (
            <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400 border border-rose-500/20">
              {lowerIsBetter ? "Higher" : "Lower"}
            </span>
          )}
        </div>

        {/* Right bar */}
        <div className="flex items-center gap-2">
          {!isDraw && bIsWinner && (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
              {lowerIsBetter ? "Lower" : "Higher"}
            </span>
          )}
          {!isDraw && !bIsWinner && (
            <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400 border border-rose-500/20">
              {lowerIsBetter ? "Higher" : "Lower"}
            </span>
          )}
          <div className="flex-1">
            <div className="h-6 w-full rounded-sm bg-zinc-800 overflow-hidden relative flex items-center">
              <div
                className={`absolute left-0 top-0 h-full rounded-sm transition-all duration-500 ${
                  isDraw
                    ? "bg-zinc-600"
                    : bIsWinner
                      ? "bg-emerald-500/30"
                      : "bg-rose-500/30"
                }`}
                style={{ width: `${widthB}%` }}
              />
              <span className="relative z-10 px-2 text-xs font-mono text-zinc-200">
                {formatValue(valueB)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Main page ----

export default function ComparePage() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedA, setSelectedA] = useState<string>("")
  const [selectedB, setSelectedB] = useState<string>("")
  const [diffsA, setDiffsA] = useState<SessionDiffs | null>(null)
  const [diffsB, setDiffsB] = useState<SessionDiffs | null>(null)
  const [diffsLoading, setDiffsLoading] = useState(false)

  // Fetch sessions list
  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions?limit=50")
        if (!res.ok) throw new Error("Failed to fetch sessions")
        const data = await res.json()
        setSessions(data.sessions ?? [])
      } catch (err) {
        console.error("Failed to fetch sessions:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  // Fetch diffs when both sessions selected
  const fetchDiffs = useCallback(async (idA: string, idB: string) => {
    if (!idA || !idB) return
    setDiffsLoading(true)
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/sessions/${idA}/diffs`),
        fetch(`/api/sessions/${idB}/diffs`),
      ])
      if (resA.ok) setDiffsA(await resA.json())
      if (resB.ok) setDiffsB(await resB.json())
    } catch (err) {
      console.error("Failed to fetch diffs:", err)
    } finally {
      setDiffsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedA && selectedB) {
      fetchDiffs(selectedA, selectedB)
    } else {
      setDiffsA(null)
      setDiffsB(null)
    }
  }, [selectedA, selectedB, fetchDiffs])

  const sessionA = useMemo(
    () => sessions.find((s) => s.id === selectedA) ?? null,
    [sessions, selectedA]
  )
  const sessionB = useMemo(
    () => sessions.find((s) => s.id === selectedB) ?? null,
    [sessions, selectedB]
  )

  const handleClear = () => {
    setSelectedA("")
    setSelectedB("")
  }

  // Build session option label
  const sessionLabel = (s: SessionMeta) => {
    const date = new Date(s.startTime).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
    return `${truncate(s.firstPrompt, 40)} - ${s.projectName} (${date})`
  }

  // Calculate cache hit rate
  const cacheHitRate = (s: SessionMeta) => {
    const total = s.totalInputTokens + s.cacheReadTokens
    if (total === 0) return 0
    return (s.cacheReadTokens / total) * 100
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="size-5 text-zinc-400" />
          <h1 className="text-xl font-semibold text-zinc-100">
            Compare Sessions
          </h1>
        </div>
        {(selectedA || selectedB) && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
          >
            <RotateCcw className="size-3" />
            Clear
          </button>
        )}
      </div>

      {/* Session pickers */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full bg-zinc-800 rounded-md" />
          <Skeleton className="h-10 w-full bg-zinc-800 rounded-md" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              Session A
            </label>
            <select
              value={selectedA}
              onChange={(e) => setSelectedA(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              <option value="">Select a session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === selectedB}>
                  {sessionLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">
              Session B
            </label>
            <select
              value={selectedB}
              onChange={(e) => setSelectedB(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-600"
            >
              <option value="">Select a session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id} disabled={s.id === selectedA}>
                  {sessionLabel(s)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Empty states */}
      {!selectedA && !selectedB && !loading && (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-zinc-500">
            Select two sessions to compare
          </p>
        </div>
      )}
      {((selectedA && !selectedB) || (!selectedA && selectedB)) && (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-zinc-500">Select a second session</p>
        </div>
      )}

      {/* Comparison view */}
      {sessionA && sessionB && (
        <div className="space-y-6">
          {/* Column headers */}
          <div className="grid grid-cols-2 gap-4">
            <SessionHeader session={sessionA} />
            <SessionHeader session={sessionB} />
          </div>

          {/* Comparison metrics */}
          <div className="rounded-lg border border-zinc-800 p-5 space-y-5">
            <h2 className="text-sm font-medium text-zinc-300">Metrics</h2>

            <ComparisonRow
              label="Cost"
              valueA={sessionA.estimatedCost}
              valueB={sessionB.estimatedCost}
              formatValue={formatCost}
              lowerIsBetter
            />

            <ComparisonRow
              label="Duration"
              valueA={sessionA.duration}
              valueB={sessionB.duration}
              formatValue={formatDuration}
              lowerIsBetter
            />

            <ComparisonRow
              label="Messages"
              valueA={sessionA.messageCount}
              valueB={sessionB.messageCount}
              formatValue={(n) => n.toString()}
              lowerIsBetter={false}
            />

            <ComparisonRow
              label="Input Tokens"
              valueA={sessionA.totalInputTokens}
              valueB={sessionB.totalInputTokens}
              formatValue={formatTokens}
              lowerIsBetter
            />

            <ComparisonRow
              label="Output Tokens"
              valueA={sessionA.totalOutputTokens}
              valueB={sessionB.totalOutputTokens}
              formatValue={formatTokens}
              lowerIsBetter={false}
            />

            <ComparisonRow
              label="Cache Hit Rate"
              valueA={cacheHitRate(sessionA)}
              valueB={cacheHitRate(sessionB)}
              formatValue={(n) => `${n.toFixed(1)}%`}
              lowerIsBetter={false}
            />
          </div>

          {/* Efficiency metrics */}
          <div className="rounded-lg border border-zinc-800 p-5 space-y-5">
            <h2 className="text-sm font-medium text-zinc-300">Efficiency</h2>

            <ComparisonRow
              label="Cost per Message"
              valueA={
                sessionA.messageCount > 0
                  ? sessionA.estimatedCost / sessionA.messageCount
                  : 0
              }
              valueB={
                sessionB.messageCount > 0
                  ? sessionB.estimatedCost / sessionB.messageCount
                  : 0
              }
              formatValue={formatCost}
              lowerIsBetter
            />

            <ComparisonRow
              label="Tokens per Message"
              valueA={
                sessionA.messageCount > 0
                  ? (sessionA.totalInputTokens + sessionA.totalOutputTokens) /
                    sessionA.messageCount
                  : 0
              }
              valueB={
                sessionB.messageCount > 0
                  ? (sessionB.totalInputTokens + sessionB.totalOutputTokens) /
                    sessionB.messageCount
                  : 0
              }
              formatValue={(n) => formatTokens(Math.round(n))}
              lowerIsBetter
            />
          </div>

          {/* Files modified */}
          <div className="rounded-lg border border-zinc-800 p-5 space-y-4">
            <h2 className="text-sm font-medium text-zinc-300">
              Files Modified
            </h2>

            {diffsLoading ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full bg-zinc-800" />
                  ))}
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full bg-zinc-800" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FilesList diffs={diffsA} />
                <FilesList diffs={diffsB} />
              </div>
            )}
          </div>

          {/* Links to detail pages */}
          <div className="grid grid-cols-2 gap-4">
            <Link
              href={`/sessions/${sessionA.id}`}
              className="flex items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200 hover:bg-zinc-800"
            >
              View Session A <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href={`/sessions/${sessionB.id}`}
              className="flex items-center justify-center gap-2 rounded-md border border-zinc-800 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200 hover:bg-zinc-800"
            >
              View Session B <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Sub-components ----

function SessionHeader({ session }: { session: SessionMeta }) {
  const color = getProjectColor(session.projectName)
  return (
    <div className={`rounded-lg border ${color.border} ${color.bg} p-4 space-y-2`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${color.text} ${color.bg} border ${color.border}`}
        >
          <span className={`size-1.5 rounded-full ${color.dot}`} />
          {session.projectName}
        </span>
        <Badge
          variant="outline"
          className="border-zinc-700 text-[10px] text-zinc-500"
        >
          {session.model}
        </Badge>
      </div>
      <p className="text-sm text-zinc-300 line-clamp-2">
        {truncate(session.firstPrompt, 80)}
      </p>
      <p className="text-xs text-zinc-500">{formatDate(session.startTime)}</p>
    </div>
  )
}

const ACTION_COLORS: Record<string, string> = {
  created: "text-emerald-400",
  edited: "text-blue-400",
  modified: "text-zinc-400",
}

function FilesList({ diffs }: { diffs: SessionDiffs | null }) {
  if (!diffs || diffs.files.length === 0) {
    return (
      <p className="text-xs text-zinc-600 py-2">No files modified</p>
    )
  }

  return (
    <div className="space-y-1">
      {diffs.files.slice(0, 15).map((file) => {
        const segments = file.path.split("/")
        const display =
          segments.length > 3
            ? ".../" + segments.slice(-3).join("/")
            : file.path
        return (
          <div
            key={file.path}
            className="flex items-center gap-2 text-xs py-0.5"
          >
            <span
              className={`shrink-0 text-[10px] font-medium uppercase ${ACTION_COLORS[file.action] ?? "text-zinc-500"}`}
            >
              {file.action.slice(0, 3)}
            </span>
            <span
              className="truncate font-mono text-zinc-400"
              title={file.path}
            >
              {display}
            </span>
            {file.count > 1 && (
              <span className="shrink-0 text-zinc-600">x{file.count}</span>
            )}
          </div>
        )
      })}
      {diffs.files.length > 15 && (
        <p className="text-[10px] text-zinc-600 pt-1">
          +{diffs.files.length - 15} more files
        </p>
      )}
    </div>
  )
}
