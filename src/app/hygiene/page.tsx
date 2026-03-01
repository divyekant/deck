"use client"

import { useEffect, useState, useCallback } from "react"
import { ShieldCheck, Check, X, Stethoscope, Copy, CheckCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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

function generateDiagnostic(project: ProjectHygiene): string {
  const lines: string[] = []
  lines.push(`Diagnostic Report: ${project.projectName}`)
  lines.push(`Score: ${project.score}/100`)
  lines.push(`${"─".repeat(40)}`)

  const { checks } = project
  const failingChecks: string[] = []

  if (!checks.claudeMd) {
    failingChecks.push(
      `[FAIL] CLAUDE.md is missing\n  → Run \`claude\` in this project to auto-generate a CLAUDE.md file.\n    This file tells Claude Code about your project conventions, structure, and preferences.`
    )
  }

  if (!checks.recentSessions) {
    failingChecks.push(
      `[FAIL] No recent sessions\n  → This project has no Claude Code session history.\n    Start a session with \`claude\` in the project directory.`
    )
  }

  if (!checks.memory) {
    failingChecks.push(
      `[FAIL] MEMORY.md is missing\n  → Memory files are created automatically as Claude Code learns about your project.\n    Use Claude Code in this project and it will begin remembering context over time.`
    )
  }

  if (!checks.agents) {
    failingChecks.push(
      `[FAIL] No agent definitions\n  → Create agent files in \`.claude/agents/\` to define reusable AI workflows.\n    Agents let you encode repeatable tasks like code review, testing, or deployment.`
    )
  }

  if (!checks.settings) {
    failingChecks.push(
      `[FAIL] settings.json is missing\n  → Run Claude Code in this project to generate a settings.json with hooks and preferences.\n    This file lives at \`.claude/settings.json\` and configures project-level behavior.`
    )
  }

  if (failingChecks.length === 0) {
    lines.push("")
    lines.push("All checks passed. This project is in great shape.")
  } else {
    lines.push("")
    lines.push(`${failingChecks.length} issue${failingChecks.length > 1 ? "s" : ""} found:`)
    lines.push("")
    lines.push(failingChecks.join("\n\n"))
  }

  return lines.join("\n")
}

function ProjectCard({ project }: { project: ProjectHygiene }) {
  const color = getProjectColor(project.projectName)
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [copied, setCopied] = useState(false)

  const diagnostic = generateDiagnostic(project)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diagnostic)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for environments where clipboard API is unavailable
    }
  }

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
      <CardContent className="space-y-3">
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

        <Button
          variant="outline"
          size="sm"
          className="border-zinc-700"
          onClick={() => setShowDiagnostic(!showDiagnostic)}
        >
          <Stethoscope className="size-4" />
          {showDiagnostic ? "Hide Diagnostic" : "Diagnose"}
        </Button>

        {showDiagnostic && (
          <div className="relative rounded-md border border-zinc-800 bg-zinc-950 p-3">
            <div className="absolute right-2 top-2">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCopy}
                title="Copy diagnostic to clipboard"
              >
                {copied ? (
                  <CheckCheck className="size-3 text-emerald-400" />
                ) : (
                  <Copy className="size-3 text-zinc-400" />
                )}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400 pr-8">
              {diagnostic}
            </pre>
          </div>
        )}
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
