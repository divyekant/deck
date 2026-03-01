"use client"

import { useEffect, useState, useCallback } from "react"
import { ShieldCheck, Check, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getProjectColor } from "@/lib/project-colors"

interface HygieneCheck {
  claudeMd: boolean
  settings: boolean
  memory: boolean
  agents: boolean
  recentSessions: boolean
}

interface ProjectHygiene {
  projectName: string
  projectDir: string
  score: number
  checks: HygieneCheck
}

const CHECK_LABELS: { key: keyof HygieneCheck; label: string }[] = [
  { key: "claudeMd", label: "CLAUDE.md" },
  { key: "settings", label: "settings.json" },
  { key: "memory", label: "MEMORY.md" },
  { key: "agents", label: "Agent definitions" },
  { key: "recentSessions", label: "Recent sessions" },
]

function scoreColor(score: number): string {
  if (score >= 80) return "bg-emerald-500"
  if (score >= 50) return "bg-amber-500"
  return "bg-red-500"
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return "bg-emerald-900/60 text-emerald-400"
  if (score >= 50) return "bg-amber-900/60 text-amber-400"
  return "bg-red-900/60 text-red-400"
}

function ProjectCard({ project }: { project: ProjectHygiene }) {
  const color = getProjectColor(project.projectName)

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-block size-2.5 rounded-full ${color.dot}`} />
            <CardTitle className="text-base text-zinc-100">
              {project.projectName}
            </CardTitle>
          </div>
          <span className={`text-2xl font-bold tabular-nums ${project.score >= 80 ? "text-emerald-400" : project.score >= 50 ? "text-amber-400" : "text-red-400"}`}>
            {project.score}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full transition-all ${scoreColor(project.score)}`}
            style={{ width: `${project.score}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {CHECK_LABELS.map(({ key, label }) => {
            const passed = project.checks[key]
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                {passed ? (
                  <Check className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <X className="size-4 shrink-0 text-red-500" />
                )}
                <span className={passed ? "text-zinc-300" : "text-zinc-500"}>
                  {label}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

export default function HygienePage() {
  const [data, setData] = useState<ProjectHygiene[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHygiene = useCallback(async () => {
    try {
      const res = await fetch("/api/hygiene")
      if (!res.ok) throw new Error("Failed to fetch hygiene data")
      const json: ProjectHygiene[] = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHygiene()
  }, [fetchHygiene])

  const averageScore =
    data.length > 0
      ? Math.round(data.reduce((sum, p) => sum + p.score, 0) / data.length)
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Hygiene
        </h1>
        {!loading && data.length > 0 && (
          <Badge variant="secondary" className={scoreBadgeClass(averageScore)}>
            avg {averageScore}/100
          </Badge>
        )}
      </div>

      <Separator className="bg-zinc-800" />

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldCheck className="mb-4 size-12 text-zinc-800" />
          <p className="text-sm text-zinc-500">No projects found.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Projects will appear once Claude Code creates session data in
            ~/.claude/projects/
          </p>
        </div>
      )}

      {/* Project cards */}
      {!loading && data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((project) => (
            <ProjectCard key={project.projectDir} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
