"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Link2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { formatCost } from "@/lib/claude/costs"
import { getProjectColor } from "@/lib/project-colors"

// ---- Color maps (Tailwind can't do dynamic classes) ----

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

interface SessionMeta {
  id: string
  source: string
  projectPath: string
  projectName: string
  model: string
  firstPrompt: string
  messageCount: number
  totalInputTokens: number
  totalOutputTokens: number
  estimatedCost: number
  startTime: string
  endTime: string
  duration: number
}

interface EnrichedChain {
  id: string
  name: string
  sessionIds: string[]
  sessions: SessionMeta[]
  totalCost: number
  totalDuration: number
  sessionCount: number
  dateRange: { start: string; end: string } | null
  projects: string[]
  createdAt: string
  updatedAt: string
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

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatDateRange(range: { start: string; end: string }): string {
  const start = formatDateShort(range.start)
  const end = formatDateShort(range.end)
  if (start === end) return start
  return `${start} - ${end}`
}

// ---- Component ----

export default function ChainsPage() {
  const [chains, setChains] = useState<EnrichedChain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New chain modal state
  const [showNewModal, setShowNewModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [availableSessions, setAvailableSessions] = useState<SessionMeta[]>([])
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(
    new Set()
  )
  const [sessionSearch, setSessionSearch] = useState("")
  const [creating, setCreating] = useState(false)

  // Expanded chain cards
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Fetch chains
  const fetchChains = useCallback(async () => {
    try {
      const res = await fetch("/api/chains")
      if (!res.ok) throw new Error("Failed to fetch chains")
      const data = await res.json()
      setChains(data.chains)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchChains()
  }, [fetchChains])

  // Fetch available sessions when modal opens
  useEffect(() => {
    if (!showNewModal) return

    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions?limit=200")
        if (!res.ok) return
        const data = await res.json()
        setAvailableSessions(data.sessions ?? [])
      } catch {
        // fail silently
      }
    }
    fetchSessions()
  }, [showNewModal])

  // Filtered sessions for the selector
  const filteredSessions = useMemo(() => {
    if (!sessionSearch.trim()) return availableSessions.slice(0, 50)
    const q = sessionSearch.toLowerCase()
    return availableSessions
      .filter(
        (s) =>
          s.firstPrompt.toLowerCase().includes(q) ||
          s.projectName.toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [availableSessions, sessionSearch])

  // Toggle session selection
  const toggleSession = (id: string) => {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Create chain
  const handleCreate = async () => {
    if (!newName.trim() || selectedSessionIds.size === 0) return
    setCreating(true)
    try {
      const res = await fetch("/api/chains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          sessionIds: Array.from(selectedSessionIds),
        }),
      })
      if (!res.ok) throw new Error("Failed to create chain")
      setShowNewModal(false)
      setNewName("")
      setSelectedSessionIds(new Set())
      setSessionSearch("")
      await fetchChains()
    } catch {
      // fail silently
    } finally {
      setCreating(false)
    }
  }

  // Delete chain
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/chains?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete chain")
      setDeletingId(null)
      await fetchChains()
    } catch {
      // fail silently
    }
  }

  // Toggle expand
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Session Chains
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Link related sessions into named workflows
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Chain
        </button>
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
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="mb-3 h-5 w-32 rounded bg-zinc-800" />
              <div className="mb-2 h-4 w-48 rounded bg-zinc-800/60" />
              <div className="flex gap-2">
                <div className="h-5 w-16 rounded bg-zinc-800/50" />
                <div className="h-5 w-16 rounded bg-zinc-800/50" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && chains.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-16">
          <div className="mb-3 rounded-full bg-zinc-800 p-3">
            <Link2 className="h-6 w-6 text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-300">No chains yet</p>
          <p className="mt-1 text-xs text-zinc-500">
            Create one to track multi-session workflows.
          </p>
        </div>
      )}

      {/* Chain cards grid */}
      {!loading && chains.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {chains.map((chain) => {
            const isExpanded = expandedIds.has(chain.id)
            const isDeleting = deletingId === chain.id

            return (
              <div
                key={chain.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden"
              >
                <div className="p-5">
                  {/* Chain header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-zinc-500" />
                      <h3 className="text-sm font-bold text-zinc-100">
                        {chain.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Delete button */}
                      {isDeleting ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zinc-400">Delete?</span>
                          <button
                            onClick={() => handleDelete(chain.id)}
                            className="rounded px-2 py-0.5 text-xs font-medium text-red-400 hover:bg-red-950/50 transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="rounded px-2 py-0.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(chain.id)}
                          className="rounded p-1 text-zinc-600 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Badges row */}
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                      <Link2 className="h-3 w-3" />
                      {chain.sessionCount} session
                      {chain.sessionCount !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                      <DollarSign className="h-3 w-3" />
                      {formatCost(chain.totalCost)}
                    </span>
                    {chain.dateRange && (
                      <span className="inline-flex items-center gap-1 rounded bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
                        <Clock className="h-3 w-3" />
                        {formatDateRange(chain.dateRange)}
                      </span>
                    )}
                  </div>

                  {/* Project badges */}
                  {chain.projects.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {chain.projects.map((proj) => {
                        const color = getProjectColor(proj)
                        const badgeClasses =
                          COLOR_BADGE[color.name] ||
                          "bg-zinc-800 text-zinc-400"
                        return (
                          <span
                            key={proj}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClasses}`}
                          >
                            {proj}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Session prompts preview (first 3) */}
                  {chain.sessions.length > 0 && (
                    <ul className="mb-3 space-y-1">
                      {chain.sessions.slice(0, 3).map((s) => (
                        <li key={s.id} className="flex items-start gap-1.5">
                          <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-zinc-600" />
                          <Link
                            href={`/sessions/${s.id}`}
                            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors line-clamp-1"
                          >
                            {truncate(s.firstPrompt, 80)}
                          </Link>
                        </li>
                      ))}
                      {chain.sessions.length > 3 && !isExpanded && (
                        <li className="text-xs text-zinc-500 pl-3">
                          +{chain.sessions.length - 3} more
                        </li>
                      )}
                    </ul>
                  )}

                  {/* Expand toggle */}
                  {chain.sessions.length > 3 && (
                    <button
                      onClick={() => toggleExpand(chain.id)}
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          Collapse
                          <ChevronUp className="h-3 w-3" />
                        </>
                      ) : (
                        <>
                          Show all sessions
                          <ChevronDown className="h-3 w-3" />
                        </>
                      )}
                    </button>
                  )}

                  {/* Expanded: timeline view */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-zinc-800 pt-4">
                      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                        Session Timeline
                      </h4>
                      <div className="space-y-0">
                        {chain.sessions.map((s, idx) => {
                          const color = getProjectColor(s.projectName)
                          const hexColor =
                            COLOR_HEX[color.name] || "#71717a"

                          return (
                            <div key={s.id} className="relative flex gap-3">
                              {/* Timeline line + dot */}
                              <div className="flex flex-col items-center">
                                <div
                                  className="h-2.5 w-2.5 rounded-full border-2 border-zinc-700 flex-shrink-0"
                                  style={{ backgroundColor: hexColor }}
                                />
                                {idx < chain.sessions.length - 1 && (
                                  <div className="w-px flex-1 bg-zinc-800 min-h-[24px]" />
                                )}
                              </div>

                              {/* Session info */}
                              <div className="pb-4 min-w-0 flex-1">
                                <Link
                                  href={`/sessions/${s.id}`}
                                  className="group block"
                                >
                                  <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors line-clamp-1">
                                    {truncate(s.firstPrompt, 100)}
                                  </p>
                                </Link>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-zinc-500">
                                    {relativeTime(s.startTime)}
                                  </span>
                                  <span className="text-xs text-zinc-600">
                                    {formatCost(s.estimatedCost)}
                                  </span>
                                  {s.duration > 0 && (
                                    <span className="text-xs text-zinc-600">
                                      {formatDuration(s.duration)}
                                    </span>
                                  )}
                                  <span className="text-xs text-zinc-600">
                                    {s.projectName}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Chain Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setShowNewModal(false)
              setNewName("")
              setSelectedSessionIds(new Set())
              setSessionSearch("")
            }}
          />

          {/* Modal */}
          <div className="relative w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            {/* Close */}
            <button
              onClick={() => {
                setShowNewModal(false)
                setNewName("")
                setSelectedSessionIds(new Set())
                setSessionSearch("")
              }}
              className="absolute right-4 top-4 rounded p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="mb-1 text-lg font-semibold text-zinc-100">
              New Chain
            </h2>
            <p className="mb-4 text-sm text-zinc-400">
              Name your chain and select sessions to include.
            </p>

            {/* Name input */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Chain Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Auth system rebuild"
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                autoFocus
              />
            </div>

            {/* Session selector */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Sessions ({selectedSessionIds.size} selected)
              </label>

              {/* Session search */}
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Search sessions..."
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 py-1.5 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              {/* Session list */}
              <div className="max-h-56 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-800/50">
                {filteredSessions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-zinc-500">
                    No sessions found
                  </div>
                ) : (
                  filteredSessions.map((s) => {
                    const isSelected = selectedSessionIds.has(s.id)
                    const color = getProjectColor(s.projectName)
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleSession(s.id)}
                        className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-zinc-700/50 ${
                          isSelected ? "bg-zinc-700/30" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="mt-0.5 size-3.5 rounded border-zinc-600 bg-zinc-800 accent-emerald-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-zinc-300 line-clamp-1">
                            {truncate(s.firstPrompt, 70)}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${color.dot}`}
                            />
                            <span className="text-[10px] text-zinc-500">
                              {s.projectName}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {relativeTime(s.startTime)}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {formatCost(s.estimatedCost)}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowNewModal(false)
                  setNewName("")
                  setSelectedSessionIds(new Set())
                  setSessionSearch("")
                }}
                className="rounded-md px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  !newName.trim() || selectedSessionIds.size === 0 || creating
                }
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? "Creating..." : "Create Chain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
