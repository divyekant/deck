"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { Radio } from "lucide-react"

interface RunningSession {
  id: string
  projectDir: string
  model: string
  prompt: string
  startedAt: string
  source?: "deck" | "heuristic"
}

function extractProjectName(projectDir: string): string {
  if (!projectDir) return "Unknown"
  const segments = projectDir.split("/").filter(Boolean)
  return segments[segments.length - 1] || projectDir
}

function formatElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime()
  if (isNaN(start)) return "Active"
  const elapsed = Date.now() - start
  if (elapsed < 0 || elapsed > 86_400_000) return "Active" // >24h = likely stale
  const seconds = Math.floor(elapsed / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function ModelBadge({ model }: { model: string }) {
  let color = "bg-zinc-700 text-zinc-300"
  const m = model.toLowerCase()
  if (m.includes("opus")) color = "bg-orange-900/60 text-orange-300"
  else if (m.includes("sonnet")) color = "bg-blue-900/60 text-blue-300"
  else if (m.includes("haiku")) color = "bg-emerald-900/60 text-emerald-300"
  else if (m.includes("gpt") || m.includes("o3") || m.includes("o4")) color = "bg-violet-900/60 text-violet-300"
  else if (m.includes("codex")) color = "bg-cyan-900/60 text-cyan-300"

  const label = model.replace("claude-", "").replace(/-\d{8}$/, "")

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
      {label}
    </span>
  )
}

function PulsingDot() {
  return (
    <span className="relative flex size-2">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
  )
}

export default function LivePage() {
  const [sessions, setSessions] = useState<RunningSession[]>([])
  const [loading, setLoading] = useState(true)
  const [, setTick] = useState(0)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions/running")
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data)) setSessions(data)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll for running sessions every 5 seconds
  useEffect(() => {
    fetchSessions()
    const interval = setInterval(fetchSessions, 5000)
    return () => clearInterval(interval)
  }, [fetchSessions])

  // Tick every second to update elapsed times
  useEffect(() => {
    if (sessions.length === 0) return
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [sessions.length])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Live Sessions
        </h1>
        {sessions.length > 0 && <PulsingDot />}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-500">
          Loading...
        </div>
      ) : sessions.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-20">
          <Radio className="mb-4 size-10 text-zinc-600" />
          <p className="text-sm text-zinc-400">
            No sessions running.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Start one from the{" "}
            <Link href="/sessions/new" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
              Sessions page
            </Link>
            .
          </p>
        </div>
      ) : (
        /* Running sessions grid */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="group block rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
            >
              {/* Top row: pulsing dot + Live/Active badge + elapsed */}
              <div className="mb-3 flex items-center gap-2">
                <PulsingDot />
                {session.source === "heuristic" ? (
                  <span className="rounded-full bg-blue-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                    Recently Active
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                    Live
                  </span>
                )}
                <span className="ml-auto text-xs tabular-nums text-zinc-500">
                  {formatElapsed(session.startedAt)}
                </span>
              </div>

              {/* Project name */}
              <p className="mb-1 text-sm font-medium text-zinc-200">
                {extractProjectName(session.projectDir)}
              </p>

              {/* Model badge */}
              <div className="mb-3">
                <ModelBadge model={session.model} />
              </div>

              {/* Prompt */}
              <p className="line-clamp-3 text-xs leading-relaxed text-zinc-400">
                {session.prompt || "No prompt"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
