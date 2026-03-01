"use client"

import { useEffect, useState, useCallback } from "react"
import {
  FileCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Settings2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getProjectColor } from "@/lib/project-colors"

interface LintIssue {
  severity: "error" | "warning" | "info"
  message: string
}

interface LintResult {
  projectName: string
  scope: "global" | "project"
  file: "CLAUDE.md" | "settings.json"
  path: string
  lineCount: number
  size: number
  issues: LintIssue[]
  content?: string
}

function severityIcon(severity: LintIssue["severity"]) {
  switch (severity) {
    case "error":
      return <AlertCircle className="size-3.5 shrink-0 text-red-400" />
    case "warning":
      return <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
    case "info":
      return <Info className="size-3.5 shrink-0 text-blue-400" />
  }
}

function severityBadgeClass(severity: LintIssue["severity"]): string {
  switch (severity) {
    case "error":
      return "bg-red-900/60 text-red-400 border-red-800"
    case "warning":
      return "bg-amber-900/60 text-amber-400 border-amber-800"
    case "info":
      return "bg-blue-900/60 text-blue-400 border-blue-800"
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function FileIcon({ file }: { file: string }) {
  if (file === "settings.json") {
    return <Settings2 className="size-4 shrink-0 text-zinc-500" />
  }
  return <FileText className="size-4 shrink-0 text-zinc-500" />
}

function FileCard({ result }: { result: LintResult }) {
  const [expanded, setExpanded] = useState(false)
  const hasIssues = result.issues.length > 0
  const hasContent = result.content && result.content.length > 0

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileIcon file={result.file} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-200">
                {result.file}
              </span>
              {!hasIssues && (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {result.lineCount > 0
                ? `${result.lineCount} lines, ${formatBytes(result.size)}`
                : "File not found"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {result.issues.map((issue, i) => (
            <Badge
              key={i}
              variant="outline"
              className={severityBadgeClass(issue.severity)}
            >
              {issue.severity}
            </Badge>
          ))}
        </div>
      </div>

      {/* Issues list */}
      {hasIssues && (
        <ul className="mt-2.5 space-y-1">
          {result.issues.map((issue, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              {severityIcon(issue.severity)}
              <span className="text-zinc-400">{issue.message}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Expandable content preview */}
      {hasContent && (
        <div className="mt-2.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            Preview
          </button>
          {expanded && (
            <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-400">
              {result.content}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

interface GroupedProject {
  projectName: string
  scope: "global" | "project"
  files: LintResult[]
}

function groupByProject(results: LintResult[]): GroupedProject[] {
  const map = new Map<string, GroupedProject>()
  for (const r of results) {
    const key = `${r.scope}:${r.projectName}`
    if (!map.has(key)) {
      map.set(key, {
        projectName: r.projectName,
        scope: r.scope,
        files: [],
      })
    }
    map.get(key)!.files.push(r)
  }
  // Global first, then project-scoped sorted alphabetically
  const groups = Array.from(map.values())
  groups.sort((a, b) => {
    if (a.scope !== b.scope) return a.scope === "global" ? -1 : 1
    return a.projectName.localeCompare(b.projectName)
  })
  return groups
}

function ProjectGroup({ group }: { group: GroupedProject }) {
  const color = getProjectColor(group.projectName)
  const totalIssues = group.files.reduce(
    (sum, f) => sum + f.issues.length,
    0
  )
  const errorCount = group.files.reduce(
    (sum, f) => sum + f.issues.filter((i) => i.severity === "error").length,
    0
  )
  const warningCount = group.files.reduce(
    (sum, f) => sum + f.issues.filter((i) => i.severity === "warning").length,
    0
  )

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block size-2.5 rounded-full ${color.dot}`}
            />
            <CardTitle className="text-base text-zinc-100">
              {group.projectName}
            </CardTitle>
            <Badge
              variant="outline"
              className="border-zinc-700 text-zinc-500"
            >
              {group.scope}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {totalIssues === 0 && (
              <Badge
                variant="secondary"
                className="bg-emerald-900/60 text-emerald-400"
              >
                clean
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-red-900/60 text-red-400"
              >
                {errorCount} {errorCount === 1 ? "error" : "errors"}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-amber-900/60 text-amber-400"
              >
                {warningCount} {warningCount === 1 ? "warning" : "warnings"}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {group.files.map((result, i) => (
            <FileCard key={i} result={result} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function LintPage() {
  const [data, setData] = useState<LintResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLint = useCallback(async () => {
    try {
      const res = await fetch("/api/lint")
      if (!res.ok) throw new Error("Failed to fetch lint results")
      const json: LintResult[] = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLint()
  }, [fetchLint])

  const totalFiles = data.length
  const errorCount = data.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "error").length,
    0
  )
  const warningCount = data.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "warning").length,
    0
  )
  const infoCount = data.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "info").length,
    0
  )

  const groups = groupByProject(data)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileCheck className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Config Lint
        </h1>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Summary stats */}
      {!loading && data.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-400"
          >
            {totalFiles} {totalFiles === 1 ? "file" : "files"} checked
          </Badge>
          {errorCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-red-900/60 text-red-400"
            >
              <AlertCircle className="size-3" />
              {errorCount} {errorCount === 1 ? "error" : "errors"}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-amber-900/60 text-amber-400"
            >
              <AlertTriangle className="size-3" />
              {warningCount} {warningCount === 1 ? "warning" : "warnings"}
            </Badge>
          )}
          {infoCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-blue-900/60 text-blue-400"
            >
              <Info className="size-3" />
              {infoCount} info
            </Badge>
          )}
          {errorCount === 0 && warningCount === 0 && infoCount === 0 && (
            <Badge
              variant="secondary"
              className="bg-emerald-900/60 text-emerald-400"
            >
              <CheckCircle2 className="size-3" />
              All clean
            </Badge>
          )}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileCheck className="mb-4 size-12 text-zinc-800" />
          <p className="text-sm text-zinc-500">
            No config files found to lint.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Config files will appear once Claude Code creates data in
            ~/.claude/
          </p>
        </div>
      )}

      {/* Grouped results */}
      {!loading && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((group) => (
            <ProjectGroup
              key={`${group.scope}:${group.projectName}`}
              group={group}
            />
          ))}
        </div>
      )}
    </div>
  )
}
