"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCost, formatTokens } from "@/lib/claude/costs"
import type { SessionMeta } from "@/lib/claude/types"

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + "..."
}

function formatDate(dateStr: string): string {
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

const ALL_PROJECTS = "__all__"
const ALL_MODELS = "__all__"

export default function SessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-40 bg-zinc-800" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md bg-zinc-800" />
            ))}
          </div>
        </div>
      }
    >
      <SessionsContent />
    </Suspense>
  )
}

function SessionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [selectedProject, setSelectedProject] = useState(
    searchParams.get("project") ?? ALL_PROJECTS
  )
  const [selectedModel, setSelectedModel] = useState(ALL_MODELS)

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/sessions")
        if (!res.ok) throw new Error("Failed to fetch sessions")
        const data = await res.json()
        setSessions(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  // Sync project filter from URL param
  useEffect(() => {
    const param = searchParams.get("project")
    if (param) setSelectedProject(param)
  }, [searchParams])

  // Unique projects and models for filter dropdowns
  const projects = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.projectName))).sort(),
    [sessions]
  )
  const models = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.model))).sort(),
    [sessions]
  )

  // Filtered sessions
  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase()
    return sessions.filter((s) => {
      if (selectedProject !== ALL_PROJECTS && s.projectName !== selectedProject) return false
      if (selectedModel !== ALL_MODELS && s.model !== selectedModel) return false
      if (lowerSearch && !s.firstPrompt.toLowerCase().includes(lowerSearch)) return false
      return true
    })
  }, [sessions, search, selectedProject, selectedModel])

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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Sessions
        </h1>
        {!loading && (
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {sessions.length}
          </Badge>
        )}
      </div>

      {/* Filters */}
      {!loading && sessions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-500"
            />
          </div>

          {/* Project filter */}
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[180px] border-zinc-800 bg-zinc-900 text-zinc-300">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value={ALL_PROJECTS}>All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Model filter */}
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[220px] border-zinc-800 bg-zinc-900 text-zinc-300">
              <SelectValue placeholder="All Models" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value={ALL_MODELS}>All Models</SelectItem>
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Count */}
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {filtered.length} of {sessions.length} sessions
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-12 w-full rounded-md bg-zinc-800"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">No sessions found.</p>
        </div>
      ) : (
        <div className="rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 w-[60px]">Source</TableHead>
                <TableHead className="text-zinc-400">Project</TableHead>
                <TableHead className="text-zinc-400">First Prompt</TableHead>
                <TableHead className="text-zinc-400">Model</TableHead>
                <TableHead className="text-zinc-400 text-right">
                  Messages
                </TableHead>
                <TableHead className="text-zinc-400 text-right">
                  Tokens
                </TableHead>
                <TableHead className="text-zinc-400 text-right">
                  Cost
                </TableHead>
                <TableHead className="text-zinc-400 text-right">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((session) => (
                <TableRow
                  key={session.id}
                  className="cursor-pointer border-zinc-800 transition-colors hover:bg-zinc-800/50"
                  onClick={() => router.push(`/sessions/${session.id}`)}
                >
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        session.source === "codex"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]"
                          : "bg-zinc-800 text-zinc-400 text-[10px]"
                      }
                    >
                      {session.source === "codex" ? "Codex" : "CC"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-zinc-200">
                    {session.projectName}
                  </TableCell>
                  <TableCell className="max-w-xs text-zinc-400">
                    {truncate(session.firstPrompt, 60)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-[10px] text-zinc-500"
                    >
                      {session.model}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-zinc-400">
                    {session.messageCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-zinc-500">
                    {formatTokens(session.totalInputTokens)} /{" "}
                    {formatTokens(session.totalOutputTokens)}
                  </TableCell>
                  <TableCell className="text-right text-zinc-300">
                    {formatCost(session.estimatedCost)}
                  </TableCell>
                  <TableCell className="text-right text-zinc-500">
                    {formatDate(session.startTime)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
