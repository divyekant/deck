"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Bell, BellOff, CheckCheck, Info, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface Notification {
  id: string
  type: "budget" | "long-session" | "cost-spike"
  title: string
  message: string
  severity: "info" | "warning" | "critical"
  timestamp: string
  sessionId?: string
}

type Filter = "all" | "warning" | "critical"

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

const SEVERITY_STYLES = {
  info: {
    border: "border-blue-800/50",
    bg: "bg-blue-950/30",
    icon: "text-blue-400",
    title: "text-blue-300",
  },
  warning: {
    border: "border-amber-800/50",
    bg: "bg-amber-950/30",
    icon: "text-amber-400",
    title: "text-amber-300",
  },
  critical: {
    border: "border-rose-800/50",
    bg: "bg-rose-950/30",
    icon: "text-rose-400",
    title: "text-rose-300",
  },
} as const

function SeverityIcon({ severity, className }: { severity: "info" | "warning" | "critical"; className?: string }) {
  if (severity === "info") return <Info className={className} />
  return <AlertTriangle className={className} />
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [dismissing, setDismissing] = useState<Set<string>>(new Set())

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      if (!res.ok) throw new Error("Failed to fetch notifications")
      const data = await res.json()
      setNotifications(data.notifications)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleDismiss = useCallback(async (id: string) => {
    setDismissing((prev) => new Set(prev).add(id))
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id))
      }
    } catch {
      // Fail silently
    } finally {
      setDismissing((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const handleDismissAll = useCallback(async () => {
    const ids = notifications.map((n) => n.id)
    setDismissing(new Set(ids))
    try {
      await Promise.all(
        ids.map((id) =>
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          })
        )
      )
      setNotifications([])
    } catch {
      // Fail silently
    } finally {
      setDismissing(new Set())
    }
  }, [notifications])

  const filtered = useMemo(() => {
    if (filter === "all") return notifications
    return notifications.filter((n) => {
      if (filter === "warning") return n.severity === "warning" || n.severity === "critical"
      return n.severity === "critical"
    })
  }, [notifications, filter])

  const counts = useMemo(() => ({
    all: notifications.length,
    warning: notifications.filter((n) => n.severity === "warning" || n.severity === "critical").length,
    critical: notifications.filter((n) => n.severity === "critical").length,
  }), [notifications])

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Notifications
          </h1>
          {!loading && notifications.length > 0 && (
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
              {notifications.length}
            </Badge>
          )}
        </div>

        {!loading && notifications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismissAll}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <CheckCheck className="size-4" />
            Dismiss All
          </Button>
        )}
      </div>

      {/* Filters */}
      {!loading && notifications.length > 0 && (
        <div className="flex items-center gap-1">
          {(
            [
              { key: "all", label: "All" },
              { key: "warning", label: "Warnings" },
              { key: "critical", label: "Critical" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className="ml-1.5 text-zinc-500">
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Notification list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <BellOff className="size-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">All clear -- no notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notification) => {
            const styles = SEVERITY_STYLES[notification.severity]
            const isDismissing = dismissing.has(notification.id)

            return (
              <div
                key={notification.id}
                className={`rounded-lg border ${styles.border} ${styles.bg} p-4 transition-opacity ${
                  isDismissing ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <SeverityIcon
                    severity={notification.severity}
                    className={`size-5 mt-0.5 shrink-0 ${styles.icon}`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-medium ${styles.title}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-zinc-600">
                        {formatRelativeTime(notification.timestamp)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-zinc-400">
                      {notification.message}
                    </p>

                    {notification.sessionId && (
                      <Link
                        href={`/sessions/${notification.sessionId}`}
                        className="mt-2 inline-flex items-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        View Session &rarr;
                      </Link>
                    )}
                  </div>

                  <button
                    onClick={() => handleDismiss(notification.id)}
                    disabled={isDismissing}
                    className="shrink-0 rounded-md p-1 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    title="Dismiss"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
