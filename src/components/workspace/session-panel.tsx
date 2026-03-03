"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, X } from "lucide-react"

export interface WorkspaceSession {
  id: string
  projectDir: string
  model: string
  prompt: string
  startedAt: string
  status: "running" | "idle" | "done" | "error"
}

interface SessionPanelProps {
  sessions: WorkspaceSession[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewSession: () => void
}

export function SessionPanel({
  sessions,
  selectedId,
  onSelect,
  onClose,
  onNewSession,
}: SessionPanelProps) {
  const active = sessions.filter((s) => s.status === "running" || s.status === "idle")
  const recent = sessions.filter((s) => s.status === "done" || s.status === "error")

  const projectName = (dir: string) => dir.split("/").pop() || dir

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
                  "mt-1 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
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
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
