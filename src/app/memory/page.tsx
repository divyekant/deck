"use client"

import { useEffect, useState, useCallback } from "react"
import { Brain, ChevronDown, ChevronRight, FileText, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getProjectColor } from "@/lib/project-colors"

interface MemoryEntry {
  projectDir: string
  projectName: string
  fileName: string
  content: string
  lineCount: number
  size: number
  path: string
  lastModified: string
}

interface ProjectGroup {
  projectName: string
  entries: MemoryEntry[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function groupByProject(entries: MemoryEntry[]): ProjectGroup[] {
  const map = new Map<string, MemoryEntry[]>()
  for (const entry of entries) {
    const existing = map.get(entry.projectName) ?? []
    existing.push(entry)
    map.set(entry.projectName, existing)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([projectName, entries]) => ({ projectName, entries }))
}

function MemoryFileCard({ entry }: { entry: MemoryEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="size-4 shrink-0 text-zinc-500" />
          <span className="truncate font-mono text-sm text-zinc-200">
            {entry.fileName}
          </span>
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
            {entry.lineCount} lines
          </span>
          <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
            {formatBytes(entry.size)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden items-center gap-1 text-[11px] text-zinc-600 sm:flex">
            <Clock className="size-3" />
            {formatDate(entry.lastModified)}
          </span>
          {expanded ? (
            <ChevronDown className="size-4 text-zinc-500" />
          ) : (
            <ChevronRight className="size-4 text-zinc-500" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="mb-2 font-mono text-[11px] text-zinc-600">
            {entry.path}
          </p>
          <div className="max-h-[500px] overflow-y-auto rounded-md bg-zinc-950 p-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-zinc-300">
              {entry.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ group }: { group: ProjectGroup }) {
  const color = getProjectColor(group.projectName)

  return (
    <Card className={`border-zinc-800 bg-zinc-900 border-l-2 ${color.borderLeft}`}>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className={`inline-block size-2.5 rounded-full ${color.dot}`} />
          <CardTitle className="text-base text-zinc-100">
            {group.projectName}
          </CardTitle>
          <Badge variant="secondary" className={`${color.bg} ${color.text}`}>
            {group.entries.length} file{group.entries.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {group.entries.map((entry) => (
          <MemoryFileCard key={entry.path} entry={entry} />
        ))}
      </CardContent>
    </Card>
  )
}

export default function MemoryPage() {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/memory")
      if (!res.ok) throw new Error("Failed to fetch memory files")
      const json: MemoryEntry[] = await res.json()
      setEntries(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMemory()
  }, [fetchMemory])

  const groups = groupByProject(entries)
  const projectCount = groups.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Memory
        </h1>
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
          {loading
            ? "..."
            : `${projectCount} project${projectCount !== 1 ? "s" : ""}`}
        </Badge>
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
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Brain className="mb-4 size-12 text-zinc-800" />
          <p className="text-sm text-zinc-500">
            No MEMORY.md files found.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Memory files are created in ~/.claude/projects/ when Claude Code
            stores context about your projects.
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((group) => (
            <ProjectCard key={group.projectName} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}
