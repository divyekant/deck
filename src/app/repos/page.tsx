"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { GitBranch, DollarSign, Clock, Cpu } from "lucide-react"
import { formatCost } from "@/lib/claude/costs"
import type { SessionMeta } from "@/lib/claude/types"

interface RepoSummary {
  projectName: string
  projectPath: string
  sessionCount: number
  totalCost: number
  lastActive: string
  mostUsedModel: string
}

function buildRepoSummaries(sessions: SessionMeta[]): RepoSummary[] {
  const map = new Map<
    string,
    {
      projectPath: string
      sessionCount: number
      totalCost: number
      lastActive: string
      modelCounts: Map<string, number>
    }
  >()

  for (const s of sessions) {
    const existing = map.get(s.projectName)
    if (existing) {
      existing.sessionCount++
      existing.totalCost += s.estimatedCost
      if (new Date(s.startTime) > new Date(existing.lastActive)) {
        existing.lastActive = s.startTime
      }
      existing.modelCounts.set(s.model, (existing.modelCounts.get(s.model) ?? 0) + 1)
    } else {
      const modelCounts = new Map<string, number>()
      modelCounts.set(s.model, 1)
      map.set(s.projectName, {
        projectPath: s.projectPath,
        sessionCount: 1,
        totalCost: s.estimatedCost,
        lastActive: s.startTime,
        modelCounts,
      })
    }
  }

  const summaries: RepoSummary[] = []
  for (const [projectName, data] of map.entries()) {
    let mostUsedModel = ""
    let maxCount = 0
    for (const [model, count] of data.modelCounts.entries()) {
      if (count > maxCount) {
        maxCount = count
        mostUsedModel = model
      }
    }

    summaries.push({
      projectName,
      projectPath: data.projectPath,
      sessionCount: data.sessionCount,
      totalCost: data.totalCost,
      lastActive: data.lastActive,
      mostUsedModel,
    })
  }

  summaries.sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime())
  return summaries
}

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

export default function ReposPage() {
  const router = useRouter()
  const [repos, setRepos] = useState<RepoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions?limit=200")
        if (!res.ok) throw new Error("Failed to fetch sessions")
        const data = await res.json()
        setRepos(buildRepoSummaries(data.sessions as SessionMeta[]))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Repos</h1>
        {!loading && (
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {repos.length}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl bg-zinc-800" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">No repos found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <Card
              key={repo.projectName}
              className="cursor-pointer border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80"
              onClick={() => router.push(`/sessions?project=${encodeURIComponent(repo.projectName)}`)}
            >
              <CardContent className="pt-0">
                <div className="flex items-start gap-2">
                  <GitBranch className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-zinc-100 truncate">
                      {repo.projectName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {repo.projectPath}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-zinc-300">{repo.sessionCount}</span>
                    session{repo.sessionCount !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="size-3" />
                    <span className="font-medium text-zinc-300">{formatCost(repo.totalCost)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Cpu className="size-3" />
                    <span className="truncate">{repo.mostUsedModel}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3" />
                    {relativeTime(repo.lastActive)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
