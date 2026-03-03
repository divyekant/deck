"use client"

import { useState, useEffect, useCallback } from "react"
import { X, FileCode, Tag, StickyNote, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ContextWindowChart } from "@/components/context-window-chart"
import { formatTokens, formatCost } from "@/lib/claude/costs"
import type { SessionMessage } from "@/lib/claude/types"

// ---- Types ----

interface SessionMeta {
  sessionId: string
  startedAt: string
  duration?: number
  model: string
  cli?: string
  totalCost?: number
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
}

interface FileDiff {
  path: string
  action: "created" | "edited" | "modified"
  count: number
}

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  sessionId: string | null
  messages: SessionMessage[]
  model?: string
  meta?: SessionMeta
}

// ---- Constants ----

const SUGGESTED_TAGS = [
  { label: "bug-fix", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { label: "feature", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { label: "refactor", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { label: "exploration", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { label: "review", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
] as const

const ACTION_BADGES: Record<string, { label: string; className: string }> = {
  created: { label: "C", className: "bg-emerald-500/20 text-emerald-400" },
  edited: { label: "E", className: "bg-amber-500/20 text-amber-400" },
  modified: { label: "M", className: "bg-blue-500/20 text-blue-400" },
}

// ---- Component ----

export function DetailDrawer({
  open,
  onClose,
  sessionId,
  messages,
  model,
  meta,
}: DetailDrawerProps) {
  const [tags, setTags] = useState<string[]>([])
  const [noteValue, setNoteValue] = useState("")
  const [files, setFiles] = useState<FileDiff[]>([])

  // Fetch annotations when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setTags([])
      setNoteValue("")
      return
    }

    let cancelled = false

    async function fetchAnnotations() {
      try {
        const res = await fetch(`/api/annotations?sessionId=${sessionId}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setTags(data.tags ?? [])
        // Use the first note text if available
        const firstNote = data.notes?.[0]?.text ?? ""
        setNoteValue(firstNote)
      } catch {
        // silent
      }
    }

    fetchAnnotations()
    return () => { cancelled = true }
  }, [sessionId])

  // Fetch diffs when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      setFiles([])
      return
    }

    let cancelled = false

    async function fetchDiffs() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/diffs`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setFiles(data.files ?? [])
      } catch {
        // silent
      }
    }

    fetchDiffs()
    return () => { cancelled = true }
  }, [sessionId])

  // Tag toggle
  const toggleTag = useCallback(
    async (tag: string) => {
      if (!sessionId) return
      const hasTag = tags.includes(tag)
      const action = hasTag ? "removeTag" : "addTag"

      // Optimistic update
      setTags((prev) =>
        hasTag ? prev.filter((t) => t !== tag) : [...prev, tag]
      )

      try {
        await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, action, tag }),
        })
      } catch {
        // Revert on error
        setTags((prev) =>
          hasTag ? [...prev, tag] : prev.filter((t) => t !== tag)
        )
      }
    },
    [sessionId, tags]
  )

  // Save note on blur
  const saveNote = useCallback(async () => {
    if (!sessionId) return
    try {
      await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "addNote", text: noteValue }),
      })
    } catch {
      // silent
    }
  }, [sessionId, noteValue])

  if (!open) return null

  const truncateId = (id: string) =>
    id.length > 12 ? `${id.slice(0, 8)}...` : id

  const formatDuration = (ms?: number) => {
    if (!ms) return "—"
    const mins = Math.floor(ms / 60_000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    return `${hours}h ${mins % 60}m`
  }

  const fileName = (path: string) => {
    const parts = path.split("/")
    return parts[parts.length - 1] || path
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-l border-border bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Details
        </span>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title="Close details"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {/* Tags */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <Tag className="size-3 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Tags
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map(({ label, color }) => {
                const active = tags.includes(label)
                return (
                  <button
                    key={label}
                    onClick={() => toggleTag(label)}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all",
                      active
                        ? color
                        : "border-border text-muted-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Notes */}
          <section>
            <div className="flex items-center gap-1.5 mb-2">
              <StickyNote className="size-3 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Notes
              </span>
            </div>
            <textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onBlur={saveNote}
              placeholder="Add session notes..."
              className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50"
              rows={3}
            />
          </section>

          {/* Files Changed */}
          {files.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <FileCode className="size-3 text-muted-foreground" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Files Changed
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {files.length}
                </span>
              </div>
              <div className="space-y-1">
                {files.map((f) => {
                  const badge = ACTION_BADGES[f.action] ?? ACTION_BADGES.modified
                  return (
                    <div
                      key={f.path}
                      className="flex items-center gap-2 rounded px-1.5 py-1 text-xs"
                    >
                      <span
                        className={cn(
                          "inline-flex size-4 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                      <span className="min-w-0 truncate text-muted-foreground" title={f.path}>
                        {fileName(f.path)}
                      </span>
                      {f.count > 1 && (
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                          x{f.count}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Context Window */}
          {messages.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Context Window
                </span>
              </div>
              <ContextWindowChart messages={messages} model={model} />
            </section>
          )}

          {/* Session Meta */}
          {meta && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Info className="size-3 text-muted-foreground" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Session Info
                </span>
              </div>
              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">ID</dt>
                  <dd className="font-mono text-foreground" title={meta.sessionId}>
                    {truncateId(meta.sessionId)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="text-foreground">{meta.model}</dd>
                </div>
                {meta.totalCost !== undefined && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cost</dt>
                    <dd className="text-foreground">{formatCost(meta.totalCost)}</dd>
                  </div>
                )}
                {meta.inputTokens !== undefined && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Input</dt>
                    <dd className="text-foreground">{formatTokens(meta.inputTokens)}</dd>
                  </div>
                )}
                {meta.outputTokens !== undefined && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Output</dt>
                    <dd className="text-foreground">{formatTokens(meta.outputTokens)}</dd>
                  </div>
                )}
                {meta.cacheReadTokens !== undefined && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Cache</dt>
                    <dd className="text-foreground">{formatTokens(meta.cacheReadTokens)}</dd>
                  </div>
                )}
                {meta.duration !== undefined && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="text-foreground">{formatDuration(meta.duration)}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
