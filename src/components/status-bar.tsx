"use client"

import { useState, useEffect, useCallback } from "react"
import { MessageSquare, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"

interface RunningSessionInfo {
  id: string
  projectDir: string
  model: string
  prompt: string
  startedAt: string
}

interface SessionMeta {
  id: string
  startTime: string
  estimatedCost: number
}

interface StatusData {
  activeCount: number
  sessionsToday: number
  costToday: number
  lastUpdated: Date
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return "Updated just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Updated ${diffMin}m ago`
  const diffHrs = Math.floor(diffMin / 60)
  return `Updated ${diffHrs}h ago`
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

export default function StatusBar() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [, setTick] = useState(0) // force re-render for relative time

  const fetchStatus = useCallback(async () => {
    try {
      const [runningRes, sessionsRes] = await Promise.all([
        fetch("/api/sessions/running"),
        fetch("/api/sessions?limit=200"),
      ])

      let activeCount = 0
      if (runningRes.ok) {
        const running: RunningSessionInfo[] = await runningRes.json()
        activeCount = Array.isArray(running) ? running.length : 0
      }

      let sessionsToday = 0
      let costToday = 0
      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        const sessions: SessionMeta[] = data.sessions || []
        for (const s of sessions) {
          if (isToday(s.startTime)) {
            sessionsToday++
            costToday += s.estimatedCost || 0
          }
        }
      }

      setStatus({
        activeCount,
        sessionsToday,
        costToday,
        lastUpdated: new Date(),
      })
    } catch {
      // Silently fail — keep showing last known data
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Tick every 30s to update relative time display
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  if (!status) return null

  const activeLabel =
    status.activeCount > 0
      ? `${status.activeCount} active`
      : "No active sessions"

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-900",
        // On mobile, push above the mobile nav (h-16 + safe area)
        "pb-[env(safe-area-inset-bottom)] lg:pb-0",
        "mb-16 lg:mb-0"
      )}
    >
      {/* Collapsed mobile view — tap to expand */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex h-8 w-full items-center gap-2 px-3 text-xs text-zinc-400 lg:hidden"
        aria-label="Toggle status bar details"
      >
        <span
          className={cn(
            "inline-block size-1.5 rounded-full",
            status.activeCount > 0
              ? "bg-emerald-400 animate-pulse"
              : "bg-zinc-600"
          )}
        />
        <span
          className={cn(
            status.activeCount > 0 ? "text-zinc-300" : "text-zinc-500"
          )}
        >
          {activeLabel}
        </span>
      </button>

      {/* Expanded mobile details */}
      {expanded && (
        <div className="flex items-center gap-4 border-t border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 lg:hidden">
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {status.sessionsToday} today
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="size-3" />
            ${status.costToday.toFixed(2)}
          </span>
          <span className="ml-auto text-zinc-500">
            {formatRelativeTime(status.lastUpdated)}
          </span>
        </div>
      )}

      {/* Desktop view — always show full row */}
      <div className="hidden h-8 items-center gap-5 px-4 text-xs text-zinc-400 lg:flex">
        {/* Active sessions */}
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-block size-1.5 rounded-full",
              status.activeCount > 0
                ? "bg-emerald-400 animate-pulse"
                : "bg-zinc-600"
            )}
          />
          <span
            className={cn(
              status.activeCount > 0 ? "text-zinc-300" : "text-zinc-500"
            )}
          >
            {activeLabel}
          </span>
        </span>

        {/* Separator */}
        <span className="h-3 w-px bg-zinc-700" />

        {/* Sessions today */}
        <span className="flex items-center gap-1">
          <MessageSquare className="size-3" />
          {status.sessionsToday} today
        </span>

        {/* Separator */}
        <span className="h-3 w-px bg-zinc-700" />

        {/* Cost today */}
        <span className="flex items-center gap-1">
          <DollarSign className="size-3" />
          ${status.costToday.toFixed(2)}
        </span>

        {/* Last updated — pushed to the right */}
        <span className="ml-auto text-zinc-500">
          {formatRelativeTime(status.lastUpdated)}
        </span>
      </div>
    </div>
  )
}
