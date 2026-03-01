"use client"

import { useEffect, useState, useCallback } from "react"
import { Bot, ChevronDown, ChevronRight, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getProjectColor } from "@/lib/project-colors"

interface AgentEntry {
  name: string
  scope: "global" | "project"
  projectName: string | null
  content: string
  path: string
  size: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Group agents by scope: global first, then by project name.
 */
function groupAgents(
  agents: AgentEntry[]
): { label: string; projectName: string | null; agents: AgentEntry[] }[] {
  const global = agents.filter((a) => a.scope === "global")
  const projectMap = new Map<string, AgentEntry[]>()

  for (const agent of agents) {
    if (agent.scope === "project" && agent.projectName) {
      const existing = projectMap.get(agent.projectName) ?? []
      existing.push(agent)
      projectMap.set(agent.projectName, existing)
    }
  }

  const groups: { label: string; projectName: string | null; agents: AgentEntry[] }[] = []

  if (global.length > 0) {
    groups.push({ label: "Global Agents", projectName: null, agents: global })
  }

  const sortedProjects = Array.from(projectMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  for (const [projectName, projectAgents] of sortedProjects) {
    groups.push({ label: projectName, projectName, agents: projectAgents })
  }

  return groups
}

function AgentCard({ agent }: { agent: AgentEntry }) {
  const [expanded, setExpanded] = useState(false)
  const color =
    agent.scope === "project" && agent.projectName
      ? getProjectColor(agent.projectName)
      : null

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Bot className="size-4 shrink-0 text-zinc-500" />
          <span className="truncate text-sm font-medium text-zinc-100">
            {agent.name}
          </span>
          {agent.scope === "global" ? (
            <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              global
            </span>
          ) : (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                color ? `${color.bg} ${color.text}` : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {agent.projectName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs text-zinc-500 hidden sm:inline">
            {formatBytes(agent.size)}
          </span>
          {expanded ? (
            <ChevronDown className="size-3.5 text-zinc-500" />
          ) : (
            <ChevronRight className="size-3.5 text-zinc-500" />
          )}
        </div>
      </button>

      {!expanded && (
        <div className="border-t border-zinc-800/50 px-4 py-2">
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <FileText className="size-3 shrink-0" />
            <span className="truncate font-mono">{agent.path}</span>
            <span className="shrink-0 sm:hidden">
              &middot; {formatBytes(agent.size)}
            </span>
          </p>
        </div>
      )}

      {expanded && (
        <div className="border-t border-zinc-800">
          <div className="px-4 py-2">
            <p className="flex items-center gap-1.5 text-xs text-zinc-500">
              <FileText className="size-3 shrink-0" />
              <span className="truncate font-mono">{agent.path}</span>
              <span>&middot;</span>
              <span className="shrink-0">{formatBytes(agent.size)}</span>
            </p>
          </div>
          <div className="mx-4 mb-4 max-h-96 overflow-y-auto rounded-md bg-zinc-950 p-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-zinc-300">
              {agent.content}
            </pre>
          </div>
          {agent.content.length >= 5000 && (
            <p className="px-4 pb-3 text-[10px] text-zinc-600">
              Content truncated at 5 KB. Full file: {formatBytes(agent.size)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents")
      if (!res.ok) throw new Error("Failed to fetch agents")
      const json: AgentEntry[] = await res.json()
      setAgents(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const groups = groupAgents(agents)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bot className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Agents
        </h1>
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
          {loading ? "..." : `${agents.length} agent${agents.length !== 1 ? "s" : ""}`}
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
            <Skeleton key={i} className="h-20 w-full rounded-lg bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && agents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bot className="mb-4 size-12 text-zinc-800" />
          <p className="text-sm text-zinc-500">No agent definitions found.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Add .md files to ~/.claude/agents/ or to your project&apos;s .claude/agents/ directory.
          </p>
        </div>
      )}

      {/* Agent groups */}
      {!loading && agents.length > 0 && (
        <div className="space-y-8">
          {groups.map((group) => {
            const color = group.projectName
              ? getProjectColor(group.projectName)
              : null

            return (
              <div key={group.label}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-400">
                  {color && (
                    <span
                      className={`inline-block size-2 rounded-full ${color.dot}`}
                    />
                  )}
                  {group.label}
                </h2>
                <div className="space-y-3">
                  {group.agents.map((agent) => (
                    <AgentCard
                      key={`${agent.scope}-${agent.projectName}-${agent.name}`}
                      agent={agent}
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
