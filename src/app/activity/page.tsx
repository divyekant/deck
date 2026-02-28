"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getProjectColor } from "@/lib/project-colors"

// ---- Types ----

interface ActivityEvent {
  type: "session_started" | "session_ended" | "high_cost" | "long_session"
  description: string
  project: string
  sessionId: string
  timestamp: string
  cost?: number
}

// ---- Icons (inline SVG) ----

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

function SquareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  )
}

function DollarSignIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

// ---- Helpers ----

const ALL_TYPES = "__all__"

type FilterType = typeof ALL_TYPES | "sessions" | "cost" | "duration"

function formatRelativeTime(dateStr: string): string {
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

function getEventIcon(type: ActivityEvent["type"]) {
  switch (type) {
    case "session_started":
      return <PlayIcon className="size-4 text-emerald-400" />
    case "session_ended":
      return <SquareIcon className="size-4 text-zinc-400" />
    case "high_cost":
      return <DollarSignIcon className="size-4 text-amber-400" />
    case "long_session":
      return <ClockIcon className="size-4 text-blue-400" />
  }
}

function getEventIconBg(type: ActivityEvent["type"]): string {
  switch (type) {
    case "session_started":
      return "bg-emerald-950 border-emerald-800"
    case "session_ended":
      return "bg-zinc-800 border-zinc-700"
    case "high_cost":
      return "bg-amber-950 border-amber-800"
    case "long_session":
      return "bg-blue-950 border-blue-800"
  }
}

function matchesFilter(type: ActivityEvent["type"], filter: FilterType): boolean {
  if (filter === ALL_TYPES) return true
  switch (filter) {
    case "sessions":
      return type === "session_started" || type === "session_ended"
    case "cost":
      return type === "high_cost"
    case "duration":
      return type === "long_session"
    default:
      return true
  }
}

// ---- Page Component ----

export default function ActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-zinc-800" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md bg-zinc-800" />
            ))}
          </div>
        </div>
      }
    >
      <ActivityContent />
    </Suspense>
  )
}

function ActivityContent() {
  const router = useRouter()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>(ALL_TYPES)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [updatedLabel, setUpdatedLabel] = useState("")

  // Fetch activity events
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity?limit=200")
      if (!res.ok) throw new Error("Failed to fetch activity")
      const data = await res.json()
      setEvents(data.events)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  // Auto-refresh: visibilitychange + 30s polling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    function startPolling() {
      if (interval) clearInterval(interval)
      interval = setInterval(fetchActivity, 30000)
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchActivity()
        startPolling()
      } else {
        stopPolling()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    if (document.visibilityState === "visible") startPolling()

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      stopPolling()
    }
  }, [fetchActivity])

  // Update "Updated X ago" label every 15 seconds
  useEffect(() => {
    function updateLabel() {
      if (!lastUpdated) {
        setUpdatedLabel("")
        return
      }
      const diffSec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
      if (diffSec < 10) setUpdatedLabel("Updated just now")
      else if (diffSec < 60) setUpdatedLabel(`Updated ${diffSec}s ago`)
      else setUpdatedLabel(`Updated ${Math.floor(diffSec / 60)}m ago`)
    }

    updateLabel()
    const tick = setInterval(updateLabel, 15000)
    return () => clearInterval(tick)
  }, [lastUpdated])

  // Filtered events
  const filtered = useMemo(() => {
    return events.filter((e) => matchesFilter(e.type, filter))
  }, [events, filter])

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ActivityIcon className="size-6 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Activity Feed
        </h1>
      </div>

      {/* Filters */}
      {!loading && events.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filter}
            onValueChange={(val) => setFilter(val as FilterType)}
          >
            <SelectTrigger className="w-[200px] border-zinc-800 bg-zinc-900 text-zinc-300">
              <SelectValue placeholder="All Events" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value={ALL_TYPES}>All Events</SelectItem>
              <SelectItem value="sessions">Sessions</SelectItem>
              <SelectItem value="cost">Cost Alerts</SelectItem>
              <SelectItem value="duration">Duration Alerts</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
            {updatedLabel && (
              <span className="text-zinc-600">&middot; {updatedLabel}</span>
            )}
          </span>
        </div>
      )}

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-16 w-full rounded-md bg-zinc-800"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <ActivityIcon className="size-10 text-zinc-700" />
          <p className="text-sm text-muted-foreground">
            {events.length === 0
              ? "No activity yet. Start a Claude Code session to see events here."
              : "No events match the selected filter."}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-zinc-800" />

          <div className="space-y-1">
            {filtered.map((event, idx) => {
              const color = getProjectColor(event.project)
              return (
                <button
                  key={`${event.sessionId}-${event.type}-${idx}`}
                  onClick={() => router.push(`/sessions/${event.sessionId}`)}
                  className="group relative flex w-full items-start gap-4 rounded-lg px-2 py-3 text-left transition-colors hover:bg-zinc-900"
                >
                  {/* Icon */}
                  <div
                    className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${getEventIconBg(event.type)}`}
                  >
                    {getEventIcon(event.type)}
                  </div>

                  {/* Content */}
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-zinc-100 group-hover:text-white">
                        {event.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {/* Project badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${color.bg} ${color.text} border ${color.border}`}
                        >
                          <span className={`size-1.5 rounded-full ${color.dot}`} />
                          {event.project}
                        </span>

                        {/* Cost badge for high_cost events */}
                        {event.type === "high_cost" && event.cost != null && (
                          <span className="inline-flex items-center rounded-full bg-amber-950 px-2 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-800">
                            ${event.cost.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <span className="shrink-0 text-xs text-zinc-500 group-hover:text-zinc-400">
                      {formatRelativeTime(event.timestamp)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
