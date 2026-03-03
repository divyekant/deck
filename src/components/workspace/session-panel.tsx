"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, X, RotateCw, Search } from "lucide-react"

export interface WorkspaceSession {
  id: string
  projectDir: string
  model: string
  prompt: string
  startedAt: string
  status: "running" | "idle" | "done" | "error"
}

export interface HistorySession {
  id: string
  projectDir: string
  model: string
  prompt: string
  startedAt: string
}

interface SessionPanelProps {
  sessions: WorkspaceSession[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewSession: () => void
  onRestart?: (session: WorkspaceSession) => void
  historySessions?: HistorySession[]
  onLoadMore?: () => void
  hasMore?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ""
  const diff = Date.now() - date.getTime()
  const mins = Math.max(0, Math.floor(diff / 60000))
  if (mins === 0) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function matchesQuery(item: { projectDir: string; prompt: string }, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  const name = item.projectDir.split("/").pop()?.toLowerCase() || ""
  return name.includes(q) || item.prompt.toLowerCase().includes(q)
}

export function SessionPanel({
  sessions,
  selectedId,
  onSelect,
  onClose,
  onNewSession,
  onRestart,
  historySessions,
  onLoadMore,
  hasMore,
  searchQuery,
  onSearchChange,
}: SessionPanelProps) {
  const projectName = (dir: string) => dir.split("/").pop() || dir

  const active = sessions.filter((s) => (s.status === "running" || s.status === "idle") && matchesQuery(s, searchQuery ?? ""))
  const recent = sessions.filter((s) => (s.status === "done" || s.status === "error") && matchesQuery(s, searchQuery ?? ""))
  const history = (historySessions ?? []).filter((s) => matchesQuery(s, searchQuery ?? ""))

  const statusDot = (status: WorkspaceSession["status"]) => {
    const colors = {
      running: "bg-emerald-500",
      idle: "bg-amber-400",
      done: "bg-zinc-400",
      error: "bg-red-500",
    }
    return (
      <span className={cn("inline-block size-2 shrink-0 rounded-full", colors[status])} />
    )
  }

  return (
    <div className="flex h-full w-[220px] shrink-0 flex-col border-r border-border bg-muted/30">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Sessions
        </span>
        <Button variant="ghost" size="icon" className="size-6" onClick={onNewSession} title="New Session">
          <Plus className="size-3.5" />
        </Button>
      </div>

      {onSearchChange && (
        <div className="px-2 pb-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1">
            <Search className="size-3 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search sessions..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {active.length > 0 && (
          <div className="px-2 pb-2">
            <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Active
            </span>
            {active.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "group mt-1 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  selectedId === s.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                {statusDot(s.status)}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{projectName(s.projectDir)}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.model}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onClose(s.id); }}
                  className="hidden shrink-0 rounded p-0.5 hover:bg-destructive/20 group-hover:block"
                  title="Close session"
                >
                  <X className="size-3" />
                </button>
              </button>
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <div className="px-2 pb-2">
            <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Recent
            </span>
            {recent.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "group mt-1 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  selectedId === s.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                {statusDot(s.status)}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{projectName(s.projectDir)}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.model}</div>
                </div>
                {onRestart && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRestart(s); }}
                    className="hidden shrink-0 rounded p-0.5 hover:bg-accent group-hover:block"
                    title="Restart with same settings"
                  >
                    <RotateCw className="size-3" />
                  </button>
                )}
              </button>
            ))}
          </div>
        )}
        {history.length > 0 && (
          <div className="px-2 pb-2">
            <span className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              History
            </span>
            {history.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "group mt-1 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  selectedId === s.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                <span className="inline-block size-2 shrink-0 rounded-full bg-zinc-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{projectName(s.projectDir)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {s.model} &middot; {timeAgo(s.startedAt)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {hasMore && onLoadMore && (
          <div className="px-2 pb-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={onLoadMore}
            >
              Load more
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
