"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { FileCode2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface SessionMeta {
  id: string
  startTime: string
  projectName: string
}

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

interface AggregatedFile {
  path: string
  totalEdits: number
  lastModified: string
  sessions: { id: string; action: "created" | "edited" | "modified" }[]
  primaryAction: "created" | "edited" | "modified"
}

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-950 text-emerald-400 border-emerald-800",
  edited: "bg-blue-950 text-blue-400 border-blue-800",
  modified: "bg-zinc-800 text-zinc-400 border-zinc-700",
}

function truncatePath(filePath: string): string {
  const segments = filePath.split("/")
  if (segments.length <= 3) return filePath
  return ".../" + segments.slice(-3).join("/")
}

/** Fetch diffs for a batch of session IDs in parallel */
async function fetchDiffsBatch(
  sessionIds: string[]
): Promise<Map<string, SessionDiffs>> {
  const results = new Map<string, SessionDiffs>()
  const responses = await Promise.allSettled(
    sessionIds.map(async (id) => {
      const res = await fetch(`/api/sessions/${id}/diffs`)
      if (!res.ok) return null
      const data: SessionDiffs = await res.json()
      return data
    })
  )
  for (const result of responses) {
    if (result.status === "fulfilled" && result.value) {
      results.set(result.value.sessionId, result.value)
    }
  }
  return results
}

export default function DiffsPage() {
  const [files, setFiles] = useState<AggregatedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState({ loaded: 0, total: 0 })

  const loadDiffs = useCallback(async () => {
    try {
      // 1. Fetch sessions
      const sessionsRes = await fetch("/api/sessions?limit=50")
      if (!sessionsRes.ok) throw new Error("Failed to fetch sessions")
      const sessionsData = await sessionsRes.json()
      const sessions: SessionMeta[] = Array.isArray(sessionsData)
        ? sessionsData
        : sessionsData.sessions ?? []

      setProgress({ loaded: 0, total: sessions.length })

      // 2. Fetch diffs in batches of 10
      const allDiffs = new Map<string, SessionDiffs>()
      const sessionDateMap = new Map<string, string>()
      for (const s of sessions) {
        sessionDateMap.set(s.id, s.startTime)
      }

      const BATCH_SIZE = 10
      for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
        const batch = sessions.slice(i, i + BATCH_SIZE)
        const batchIds = batch.map((s) => s.id)
        const batchResults = await fetchDiffsBatch(batchIds)
        for (const [id, diffs] of batchResults) {
          allDiffs.set(id, diffs)
        }
        setProgress({ loaded: Math.min(i + BATCH_SIZE, sessions.length), total: sessions.length })
      }

      // 3. Aggregate by file path
      const fileAgg = new Map<
        string,
        {
          totalEdits: number
          lastModified: string
          sessions: { id: string; action: "created" | "edited" | "modified" }[]
          primaryAction: "created" | "edited" | "modified"
        }
      >()

      for (const [sessionId, diffs] of allDiffs) {
        const sessionDate = sessionDateMap.get(sessionId) ?? ""
        for (const file of diffs.files) {
          const existing = fileAgg.get(file.path)
          if (existing) {
            existing.totalEdits += file.count
            if (sessionDate > existing.lastModified) {
              existing.lastModified = sessionDate
            }
            existing.sessions.push({ id: sessionId, action: file.action })
          } else {
            fileAgg.set(file.path, {
              totalEdits: file.count,
              lastModified: sessionDate,
              sessions: [{ id: sessionId, action: file.action }],
              primaryAction: file.action,
            })
          }
        }
      }

      // 4. Sort by total edits descending
      const aggregated: AggregatedFile[] = Array.from(fileAgg.entries())
        .map(([filePath, data]) => ({
          path: filePath,
          ...data,
        }))
        .sort((a, b) => b.totalEdits - a.totalEdits)

      setFiles(aggregated)
    } catch (err) {
      console.error("Failed to load diffs:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDiffs()
  }, [loadDiffs])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileCode2 className="size-5 text-zinc-400" />
        <h1 className="text-xl font-semibold text-zinc-100">Diffs</h1>
        {!loading && (
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {files.length} files
          </Badge>
        )}
      </div>

      <Separator className="bg-zinc-800" />

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">
            Loading session {progress.loaded} of {progress.total}...
          </p>
          <div className="h-1 w-full rounded-full bg-zinc-800">
            <div
              className="h-1 rounded-full bg-zinc-600 transition-all duration-300"
              style={{
                width: progress.total > 0 ? `${(progress.loaded / progress.total) * 100}%` : "0%",
              }}
            />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-zinc-800" />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && files.length === 0 && (
        <p className="py-12 text-center text-sm text-zinc-500">
          No file changes detected in recent sessions.
        </p>
      )}

      {!loading && files.length > 0 && (
        <div className="rounded-md border border-zinc-800">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_120px_100px] gap-4 border-b border-zinc-800 px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <span>File Path</span>
            <span className="text-right">Times Modified</span>
            <span className="text-right">Last Modified</span>
            <span className="text-right">Sessions</span>
          </div>

          {/* Table rows */}
          {files.map((file) => (
            <div
              key={file.path}
              className="grid grid-cols-[1fr_100px_120px_100px] gap-4 border-b border-zinc-800/50 px-4 py-2.5 text-sm last:border-0 hover:bg-zinc-900/50"
            >
              {/* File path + action badge */}
              <div className="flex items-center gap-2 min-w-0">
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[10px] ${ACTION_COLORS[file.primaryAction]}`}
                >
                  {file.primaryAction}
                </Badge>
                <span
                  className="truncate font-mono text-xs text-zinc-300"
                  title={file.path}
                >
                  {truncatePath(file.path)}
                </span>
              </div>

              {/* Times modified */}
              <span className="text-right font-mono text-xs text-zinc-400">
                {file.totalEdits}
              </span>

              {/* Last modified */}
              <span className="text-right text-xs text-zinc-500">
                {file.lastModified
                  ? new Date(file.lastModified).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </span>

              {/* Sessions count */}
              <span className="text-right">
                <Link
                  href="/sessions"
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {file.sessions.length}
                </Link>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
