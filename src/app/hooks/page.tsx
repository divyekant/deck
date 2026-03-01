"use client"

import { useEffect, useState, useCallback } from "react"
import { Webhook, Terminal, Filter, Globe } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getProjectColor } from "@/lib/project-colors"

interface HookCommand {
  type: string
  command: string
  timeout?: number
}

interface HookRule {
  matcher: string
  hooks: HookCommand[]
}

interface HookGroup {
  event: string
  scope: "global" | "project"
  projectName: string | null
  rules: HookRule[]
}

const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  PreToolUse: { bg: "bg-blue-900/60", text: "text-blue-300" },
  PostToolUse: { bg: "bg-green-900/60", text: "text-green-300" },
  Notification: { bg: "bg-amber-900/60", text: "text-amber-300" },
  Stop: { bg: "bg-red-900/60", text: "text-red-300" },
  SubagentStop: { bg: "bg-violet-900/60", text: "text-violet-300" },
  UserPromptSubmit: { bg: "bg-cyan-900/60", text: "text-cyan-300" },
  SessionStart: { bg: "bg-emerald-900/60", text: "text-emerald-300" },
  SessionEnd: { bg: "bg-orange-900/60", text: "text-orange-300" },
  PreCompact: { bg: "bg-pink-900/60", text: "text-pink-300" },
}

const DEFAULT_EVENT_COLOR = { bg: "bg-zinc-700", text: "text-zinc-300" }

function getEventColor(event: string) {
  return EVENT_COLORS[event] || DEFAULT_EVENT_COLOR
}

function HookCard({ group }: { group: HookGroup }) {
  const eventColor = getEventColor(group.event)
  const projectColor =
    group.scope === "project" && group.projectName
      ? getProjectColor(group.projectName)
      : null

  const totalCommands = group.rules.reduce(
    (sum, rule) => sum + rule.hooks.length,
    0
  )

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <Webhook className="size-4 shrink-0 text-zinc-500" />
          <CardTitle className="text-base text-zinc-100">
            {group.event}
          </CardTitle>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${eventColor.bg} ${eventColor.text}`}
          >
            {group.event}
          </span>
          {group.scope === "global" ? (
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
              <Globe className="size-3 mr-1" />
              global
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className={
                projectColor
                  ? `${projectColor.bg} ${projectColor.text}`
                  : "bg-zinc-800 text-zinc-400"
              }
            >
              {group.projectName}
            </Badge>
          )}
          <span className="text-[11px] text-zinc-600">
            {totalCommands} command{totalCommands !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.rules.map((rule, ruleIdx) => (
          <div key={ruleIdx} className="space-y-2">
            {rule.matcher && (
              <div className="flex items-center gap-1.5">
                <Filter className="size-3 text-zinc-500" />
                <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
                  {rule.matcher}
                </span>
              </div>
            )}
            {rule.hooks.map((hook, hookIdx) => (
              <div
                key={hookIdx}
                className="flex items-start gap-2 rounded-md bg-zinc-950 p-3"
              >
                <Terminal className="size-3.5 mt-0.5 shrink-0 text-zinc-600" />
                <div className="min-w-0 flex-1 space-y-1">
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs text-zinc-300">
                    <code>{hook.command}</code>
                  </pre>
                  {hook.timeout != null && (
                    <span className="text-[10px] text-zinc-600">
                      timeout: {hook.timeout}s
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/**
 * Group HookGroups by scope section: global first, then by project name.
 */
function groupByScope(
  groups: HookGroup[]
): { label: string; projectName: string | null; groups: HookGroup[] }[] {
  const globalGroups = groups.filter((g) => g.scope === "global")
  const projectMap = new Map<string, HookGroup[]>()

  for (const g of groups) {
    if (g.scope === "project" && g.projectName) {
      const existing = projectMap.get(g.projectName) ?? []
      existing.push(g)
      projectMap.set(g.projectName, existing)
    }
  }

  const sections: {
    label: string
    projectName: string | null
    groups: HookGroup[]
  }[] = []

  if (globalGroups.length > 0) {
    sections.push({
      label: "Global Hooks",
      projectName: null,
      groups: globalGroups,
    })
  }

  const sortedProjects = Array.from(projectMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  for (const [projectName, grps] of sortedProjects) {
    sections.push({ label: projectName, projectName, groups: grps })
  }

  return sections
}

export default function HooksPage() {
  const [data, setData] = useState<HookGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHooks = useCallback(async () => {
    try {
      const res = await fetch("/api/hooks")
      if (!res.ok) throw new Error("Failed to fetch hooks")
      const json: HookGroup[] = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHooks()
  }, [fetchHooks])

  const totalRules = data.reduce(
    (sum, g) =>
      sum + g.rules.reduce((rs, r) => rs + r.hooks.length, 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Webhook className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Hooks
        </h1>
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
          {loading
            ? "..."
            : `${data.length} event${data.length !== 1 ? "s" : ""}, ${totalRules} hook${totalRules !== 1 ? "s" : ""}`}
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
          <Skeleton className="h-10 w-48 rounded-lg bg-zinc-800" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-48 w-full rounded-xl bg-zinc-800"
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Webhook className="mb-4 size-12 text-zinc-800" />
          <p className="text-sm text-zinc-500">No hooks configured</p>
          <p className="mt-1 text-xs text-zinc-600">
            Add hooks to ~/.claude/settings.json to automate Claude Code
            workflows.
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && data.length > 0 && (
        <div className="space-y-8">
          {groupByScope(data).map((section) => {
            const color = section.projectName
              ? getProjectColor(section.projectName)
              : null

            return (
              <div key={section.label}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
                  {color && (
                    <span
                      className={`inline-block size-2 rounded-full ${color.dot}`}
                    />
                  )}
                  {section.label}
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {section.groups.map((group) => (
                    <HookCard
                      key={`${group.scope}-${group.projectName}-${group.event}`}
                      group={group}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
