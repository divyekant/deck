"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Bookmark, Download, Search, Star, Tag, X } from "lucide-react"
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
const ALL_TAGS = "__all__"

const TAG_COLORS: Record<string, string> = {
  "bug-fix": "bg-red-950 text-red-400 border-red-800",
  feature: "bg-blue-950 text-blue-400 border-blue-800",
  refactor: "bg-purple-950 text-purple-400 border-purple-800",
  exploration: "bg-amber-950 text-amber-400 border-amber-800",
  review: "bg-emerald-950 text-emerald-400 border-emerald-800",
}

function getTagClasses(tag: string): string {
  return TAG_COLORS[tag] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"
}

interface SessionAnnotation {
  tags: string[]
  note: string
}

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

  // Bookmark state
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set())
  const [showBookmarked, setShowBookmarked] = useState(false)

  // Annotation state
  const [annotations, setAnnotations] = useState<Record<string, SessionAnnotation>>({})
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState(ALL_TAGS)

  // Date range filter
  type DatePreset = "today" | "7d" | "30d" | "all"
  const [dateRange, setDateRange] = useState<DatePreset>("all")

  // Auto-refresh state
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [updatedLabel, setUpdatedLabel] = useState("")

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const isSelecting = selectedIds.size > 0
  const [showTagDropdown, setShowTagDropdown] = useState(false)

  // Keyboard navigation state
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // Shared fetch function for initial load and refresh
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions?limit=200")
      if (!res.ok) throw new Error("Failed to fetch sessions")
      const data = await res.json()
      setSessions(data.sessions)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Fetch bookmarks on mount
  useEffect(() => {
    async function fetchBookmarks() {
      try {
        const res = await fetch("/api/bookmarks")
        if (!res.ok) return
        const data = await res.json()
        setBookmarks(new Set(data.bookmarks))
      } catch {
        // Bookmarks are non-critical, fail silently
      }
    }
    fetchBookmarks()
  }, [])

  // Fetch annotations on mount
  useEffect(() => {
    async function fetchAnnotations() {
      try {
        const res = await fetch("/api/annotations")
        if (!res.ok) return
        const data = await res.json()
        setAnnotations(data.annotations ?? {})
        setAllTags(data.allTags ?? [])
      } catch {
        // Annotations are non-critical, fail silently
      }
    }
    fetchAnnotations()
  }, [])

  // Toggle bookmark handler
  const handleToggleBookmark = useCallback(async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation() // Don't navigate to session
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) return
      const data = await res.json()
      setBookmarks((prev) => {
        const next = new Set(prev)
        if (data.bookmarked) {
          next.add(sessionId)
        } else {
          next.delete(sessionId)
        }
        return next
      })
    } catch {
      // Fail silently
    }
  }, [])

  // Bulk selection handlers
  const handleToggleSelect = useCallback((e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }, [])

  const downloadExport = useCallback(async (format: "csv" | "markdown") => {
    const res = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionIds: Array.from(selectedIds), format }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = format === "csv" ? "deck-sessions.csv" : "deck-sessions.md"
    a.click()
    URL.revokeObjectURL(url)
  }, [selectedIds])

  const handleBulkTag = useCallback(async (tag: string) => {
    setShowTagDropdown(false)
    const promises = Array.from(selectedIds).map((sessionId) => {
      const existing = annotations[sessionId]?.tags ?? []
      if (existing.includes(tag)) return Promise.resolve()
      return fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, tags: [...existing, tag] }),
      })
    })
    await Promise.all(promises)
    // Refresh annotations
    try {
      const res = await fetch("/api/annotations")
      if (res.ok) {
        const data = await res.json()
        setAnnotations(data.annotations ?? {})
        setAllTags(data.allTags ?? [])
      }
    } catch { /* fail silently */ }
  }, [selectedIds, annotations])

  const handleBulkBookmark = useCallback(async () => {
    const promises = Array.from(selectedIds)
      .filter((id) => !bookmarks.has(id))
      .map((sessionId) =>
        fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })
      )
    await Promise.all(promises)
    setBookmarks((prev) => {
      const next = new Set(prev)
      for (const id of selectedIds) {
        next.add(id)
      }
      return next
    })
  }, [selectedIds, bookmarks])

  // Auto-refresh: visibilitychange + 30s polling
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    function startPolling() {
      if (interval) clearInterval(interval)
      interval = setInterval(fetchSessions, 30000)
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval)
        interval = null
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchSessions()
        startPolling()
      } else {
        stopPolling()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    if (document.visibilityState === "visible") startPolling()

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      stopPolling()
    }
  }, [fetchSessions])

  // Update "Updated X ago" label every 15 seconds
  useEffect(() => {
    function updateLabel() {
      if (!lastUpdated) {
        setUpdatedLabel("")
        return
      }
      const diffSec = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
      if (diffSec < 10) setUpdatedLabel("Updated just now")
      else if (diffSec < 60) setUpdatedLabel(`Updated ${diffSec}s ago`)
      else setUpdatedLabel(`Updated ${Math.floor(diffSec / 60)}m ago`)
    }

    updateLabel()
    const tick = setInterval(updateLabel, 15000)
    return () => clearInterval(tick)
  }, [lastUpdated])

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
    const now = Date.now()

    // Date range boundary
    let dateThreshold: number | null = null
    if (dateRange === "today") {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      dateThreshold = todayStart.getTime()
    } else if (dateRange === "7d") {
      dateThreshold = now - 7 * 24 * 60 * 60 * 1000
    } else if (dateRange === "30d") {
      dateThreshold = now - 30 * 24 * 60 * 60 * 1000
    }

    return sessions.filter((s) => {
      if (selectedProject !== ALL_PROJECTS && s.projectName !== selectedProject) return false
      if (selectedModel !== ALL_MODELS && s.model !== selectedModel) return false
      if (lowerSearch && !s.firstPrompt.toLowerCase().includes(lowerSearch)) return false
      if (showBookmarked && !bookmarks.has(s.id)) return false
      if (dateThreshold !== null && new Date(s.startTime).getTime() < dateThreshold) return false
      if (selectedTag !== ALL_TAGS) {
        const sessionAnnotation = annotations[s.id]
        if (!sessionAnnotation || !sessionAnnotation.tags.includes(selectedTag)) return false
      }
      return true
    })
  }, [sessions, search, selectedProject, selectedModel, showBookmarked, bookmarks, dateRange, selectedTag, annotations])

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filtered.length) {
        return new Set()
      }
      return new Set(filtered.map((s) => s.id))
    })
  }, [filtered])

  // Reset highlight when filter changes
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [search, selectedProject, selectedModel, showBookmarked, dateRange, selectedTag])

  // Keyboard shortcuts: j/k/Enter/Escape/slash
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName ?? "").toLowerCase()
      const isInInput = tag === "input" || tag === "textarea" || tag === "select"

      // "/" to focus search — always works
      if (e.key === "/" && !isInInput) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // Escape: blur input or clear search
      if (e.key === "Escape") {
        if (isInInput) {
          ;(document.activeElement as HTMLElement)?.blur()
        } else if (search) {
          setSearch("")
        }
        return
      }

      // j/k/Enter only when not in an input
      if (isInInput) return

      if (e.key === "j") {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.min(prev + 1, filtered.length - 1))
      } else if (e.key === "k") {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        e.preventDefault()
        router.push(`/sessions/${filtered[highlightedIndex].id}`)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [filtered, highlightedIndex, search, router])

  // Scroll highlighted row into view
  useEffect(() => {
    if (highlightedIndex < 0) return
    const row = tableRef.current?.querySelector(`[data-row-index="${highlightedIndex}"]`)
    row?.scrollIntoView({ block: "nearest" })
  }, [highlightedIndex])

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
              ref={searchInputRef}
              placeholder="Search prompts... (press /)"
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

          {/* Bookmarked filter */}
          <button
            onClick={() => setShowBookmarked((prev) => !prev)}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              showBookmarked
                ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/30"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
            }`}
          >
            <Star className={`size-3 ${showBookmarked ? "fill-yellow-500" : ""}`} />
            Bookmarked
          </button>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900 text-zinc-300">
                <Tag className="size-3 mr-1 text-zinc-500" />
                <SelectValue placeholder="All Tags" />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900">
                <SelectItem value={ALL_TAGS}>All Tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date range filter */}
          <div className="flex items-center gap-1">
            {(["Today", "7d", "30d", "All"] as const).map((label) => {
              const value = label === "Today" ? "today" : label === "All" ? "all" : label.toLowerCase() as "7d" | "30d"
              return (
                <button
                  key={label}
                  onClick={() => setDateRange(value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    dateRange === value
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Count + auto-refresh indicator */}
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
            Showing {filtered.length} of {sessions.length} sessions
            {updatedLabel && (
              <span className="text-zinc-600">&middot; {updatedLabel}</span>
            )}
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
        <div ref={tableRef} className="rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 w-[40px] px-2">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={handleSelectAll}
                    className="size-3.5 rounded border-zinc-600 bg-zinc-800 accent-emerald-500 cursor-pointer"
                  />
                </TableHead>
                <TableHead className="text-zinc-400 w-[40px]"></TableHead>
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
              {filtered.map((session, idx) => (
                <TableRow
                  key={session.id}
                  data-row-index={idx}
                  className={`cursor-pointer border-zinc-800 transition-colors hover:bg-zinc-800/50 ${
                    highlightedIndex === idx ? "bg-zinc-800 ring-1 ring-zinc-600" : ""
                  }`}
                  onClick={() => router.push(`/sessions/${session.id}`)}
                >
                  <TableCell className="px-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(session.id)}
                      onClick={(e) => handleToggleSelect(e, session.id)}
                      onChange={() => {}} // controlled
                      className="size-3.5 rounded border-zinc-600 bg-zinc-800 accent-emerald-500 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="px-2">
                    <button
                      onClick={(e) => handleToggleBookmark(e, session.id)}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`size-4 ${
                          bookmarks.has(session.id)
                            ? "fill-yellow-500 text-yellow-500"
                            : "text-zinc-600 hover:text-zinc-400"
                        }`}
                      />
                    </button>
                  </TableCell>
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
                    <div className="flex items-center gap-2">
                      <span className="truncate">{truncate(session.firstPrompt, 60)}</span>
                      {annotations[session.id]?.tags.map((tag) => (
                        <span
                          key={tag}
                          className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${getTagClasses(tag)}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
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

      {/* Bulk action bar */}
      {isSelecting && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-700 bg-zinc-900/95 backdrop-blur-sm px-6 py-3">
          <div className="mx-auto flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-200">
              {selectedIds.size} session{selectedIds.size !== 1 ? "s" : ""} selected
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadExport("csv")}
                className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700"
              >
                <Download className="size-3" />
                Export CSV
              </button>

              <button
                onClick={() => downloadExport("markdown")}
                className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700"
              >
                <Download className="size-3" />
                Export MD
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowTagDropdown((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700"
                >
                  <Tag className="size-3" />
                  Tag All
                </button>
                {showTagDropdown && (
                  <div className="absolute bottom-full mb-1 left-0 rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-lg min-w-[140px]">
                    {Object.keys(TAG_COLORS).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleBulkTag(tag)}
                        className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${getTagClasses(tag)}`}
                        >
                          {tag}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleBulkBookmark}
                className="flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100 border border-zinc-700"
              >
                <Bookmark className="size-3" />
                Bookmark All
              </button>
            </div>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <X className="size-3" />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
