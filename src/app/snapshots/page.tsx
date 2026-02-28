"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  Search,
  ChevronDown,
  ChevronUp,
  FileCode,
  Terminal,
  Wrench,
  MessageSquare,
  DollarSign,
  Loader2,
} from "lucide-react"
import { formatCost } from "@/lib/claude/costs"
import { getProjectColor } from "@/lib/project-colors"

// ---- Color hex map for dynamic border-left (Tailwind can't do dynamic classes) ----

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

// ---- Project color bg/text for badges (Tailwind-safe static classes) ----

const COLOR_BADGE: Record<string, string> = {
  emerald: "bg-emerald-950 text-emerald-400",
  blue: "bg-blue-950 text-blue-400",
  violet: "bg-violet-950 text-violet-400",
  amber: "bg-amber-950 text-amber-400",
  rose: "bg-rose-950 text-rose-400",
  cyan: "bg-cyan-950 text-cyan-400",
  orange: "bg-orange-950 text-orange-400",
  pink: "bg-pink-950 text-pink-400",
  lime: "bg-lime-950 text-lime-400",
  indigo: "bg-indigo-950 text-indigo-400",
}

// ---- Types ----

interface Snapshot {
  id: string
  projectName: string
  model: string
  firstPrompt: string
  startTime: string
  duration: number
  estimatedCost: number
  messageCount: number
  filesModified: string[]
  filesCount: number
  commandsRun: string[]
  keyActions: string[]
  toolCallsCount: number
}

interface SnapshotsResponse {
  snapshots: Snapshot[]
  total: number
  projects: string[]
}

// ---- Helpers ----

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function fileName(path: string): string {
  const parts = path.split("/")
  return parts[parts.length - 1] || path
}

// ---- Component ----

const ALL_PROJECTS = "__all__"

type SortKey = "date" | "cost"

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [projects, setProjects] = useState<string[]>([])

  // Controls
  const [search, setSearch] = useState("")
  const [selectedProject, setSelectedProject] = useState(ALL_PROJECTS)
  const [sortBy, setSortBy] = useState<SortKey>("date")

  // Expanded cards
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Fetch snapshots
  const fetchSnapshots = useCallback(
    async (offset: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)

      try {
        const params = new URLSearchParams()
        params.set("limit", "30")
        params.set("offset", String(offset))
        if (selectedProject !== ALL_PROJECTS) {
          params.set("project", selectedProject)
        }

        const res = await fetch(`/api/snapshots?${params.toString()}`)
        if (!res.ok) throw new Error("Failed to fetch snapshots")
        const data: SnapshotsResponse = await res.json()

        if (append) {
          setSnapshots((prev) => [...prev, ...data.snapshots])
        } else {
          setSnapshots(data.snapshots)
        }
        setTotal(data.total)
        setProjects(data.projects)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [selectedProject]
  )

  // Initial fetch + refetch when project filter changes
  useEffect(() => {
    fetchSnapshots(0, false)
  }, [fetchSnapshots])

  // Client-side filtering and sorting
  const filtered = useMemo(() => {
    let result = snapshots

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.firstPrompt.toLowerCase().includes(q) ||
          s.keyActions.some((a) => a.toLowerCase().includes(q)) ||
          s.projectName.toLowerCase().includes(q)
      )
    }

    // Sort
    if (sortBy === "cost") {
      result = [...result].sort((a, b) => b.estimatedCost - a.estimatedCost)
    }
    // date sort is the default from API (already sorted by startTime desc)

    return result
  }, [snapshots, search, sortBy])

  const hasMore = snapshots.length < total

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Snapshots</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Auto-generated session digests with files, commands, and key actions
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search prompts and actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>

        {/* Project filter */}
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        >
          <option value={ALL_PROJECTS}>All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        {/* Sort toggle */}
        <button
          onClick={() => setSortBy(sortBy === "date" ? "cost" : "date")}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
        >
          {sortBy === "date" ? (
            <>
              <DollarSign className="h-3.5 w-3.5" />
              Sort by cost
            </>
          ) : (
            <>
              <MessageSquare className="h-3.5 w-3.5" />
              Sort by date
            </>
          )}
        </button>

        {/* Count */}
        <span className="text-xs text-zinc-500">
          {filtered.length} of {total} sessions
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="h-5 w-16 rounded-full bg-zinc-800" />
                <div className="h-5 w-20 rounded-full bg-zinc-800" />
                <div className="ml-auto h-4 w-12 rounded bg-zinc-800" />
              </div>
              <div className="mb-3 h-10 rounded bg-zinc-800" />
              <div className="space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-zinc-800/60" />
                <div className="h-3 w-1/2 rounded bg-zinc-800/60" />
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-5 w-14 rounded bg-zinc-800/50" />
                <div className="h-5 w-14 rounded bg-zinc-800/50" />
                <div className="h-5 w-14 rounded bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-16">
          <div className="mb-3 rounded-full bg-zinc-800 p-3">
            <MessageSquare className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-300">No snapshots found</p>
          <p className="mt-1 text-xs text-zinc-500">
            {search ? "Try a different search term" : "No sessions match the current filter"}
          </p>
        </div>
      )}

      {/* Snapshot cards grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {filtered.map((snap) => {
            const color = getProjectColor(snap.projectName)
            const hexColor = COLOR_HEX[color.name] || "#71717a"
            const badgeClasses = COLOR_BADGE[color.name] || "bg-zinc-800 text-zinc-400"
            const isExpanded = expandedIds.has(snap.id)

            return (
              <div
                key={snap.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900 border-l-4 overflow-hidden"
                style={{ borderLeftColor: hexColor }}
              >
                <div className="p-5">
                  {/* Header row */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses}`}
                    >
                      {snap.projectName}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
                      {shortModel(snap.model)}
                    </span>
                    <span className="ml-auto text-xs text-zinc-500">
                      {relativeTime(snap.startTime)}
                    </span>
                  </div>

                  {/* First prompt */}
                  <Link
                    href={`/sessions/${snap.id}`}
                    className="group block"
                  >
                    <p className="mb-2 line-clamp-2 text-sm leading-relaxed text-zinc-300 group-hover:text-zinc-100 transition-colors">
                      {snap.firstPrompt || "No prompt"}
                    </p>
                  </Link>

                  {/* Key actions */}
                  {snap.keyActions.length > 0 && (
                    <ul className="mb-3 space-y-0.5">
                      {snap.keyActions.slice(0, 2).map((action, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-xs text-zinc-400"
                        >
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-zinc-600" />
                          <span className="line-clamp-1">{action}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Stats row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {snap.filesCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                        <FileCode className="h-3 w-3" />
                        {snap.filesCount} file{snap.filesCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {snap.toolCallsCount > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                        <Wrench className="h-3 w-3" />
                        {snap.toolCallsCount} tool{snap.toolCallsCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                      <MessageSquare className="h-3 w-3" />
                      {snap.messageCount}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                      <DollarSign className="h-3 w-3" />
                      {formatCost(snap.estimatedCost)}
                    </span>
                    {snap.duration > 0 && (
                      <span className="text-xs text-zinc-500">
                        {formatDuration(snap.duration)}
                      </span>
                    )}

                    {/* Expand toggle */}
                    {(snap.filesModified.length > 0 ||
                      snap.commandsRun.length > 0 ||
                      snap.keyActions.length > 2) && (
                      <button
                        onClick={() => toggleExpand(snap.id)}
                        className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            Hide details
                            <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            Show details
                            <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
                      {/* Files */}
                      {snap.filesModified.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                            Files modified
                          </h4>
                          <ul className="space-y-1">
                            {snap.filesModified.map((f, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 text-xs text-zinc-400"
                              >
                                <FileCode className="h-3 w-3 flex-shrink-0 text-zinc-500" />
                                <span
                                  className="truncate"
                                  title={f}
                                >
                                  {fileName(f)}
                                </span>
                                <span className="ml-auto truncate text-zinc-600 max-w-[200px]" title={f}>
                                  {f}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Commands */}
                      {snap.commandsRun.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                            Commands run
                          </h4>
                          <ul className="space-y-1">
                            {snap.commandsRun.map((cmd, i) => (
                              <li
                                key={i}
                                className="font-mono text-xs text-zinc-500 truncate"
                                title={cmd}
                              >
                                <span className="text-zinc-600 mr-1">$</span>
                                {cmd}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Full key actions */}
                      {snap.keyActions.length > 2 && (
                        <div>
                          <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                            All actions
                          </h4>
                          <ul className="space-y-1">
                            {snap.keyActions.map((action, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-1.5 text-xs text-zinc-400"
                              >
                                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-zinc-600" />
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && (
        <div className="flex justify-center pt-2 pb-4">
          <button
            onClick={() => fetchSnapshots(snapshots.length, true)}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50 transition-colors"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>Load more ({total - snapshots.length} remaining)</>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
