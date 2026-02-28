"use client"

import { useEffect, useState, useCallback } from "react"
import { Sparkles, FileText, ChevronDown, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProjectColor } from "@/lib/project-colors"

interface CommandEntry {
  name: string
  scope: "global" | "project"
  projectName: string | null
  content: string
}

interface ClaudeMdEntry {
  path: string
  scope: "global" | "project"
  projectName: string | null
  content: string
  size: number
  truncated: boolean
}

interface SkillsData {
  commands: CommandEntry[]
  claudeMdFiles: ClaudeMdEntry[]
}

function CommandCard({ command }: { command: CommandEntry }) {
  const color =
    command.scope === "project" && command.projectName
      ? getProjectColor(command.projectName)
      : null

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-base text-zinc-100 font-mono">
            /{command.name}
          </CardTitle>
          {command.scope === "global" ? (
            <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
              global
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className={color ? `${color.bg} ${color.text}` : "bg-zinc-800 text-zinc-400"}
            >
              {command.projectName}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-60 overflow-y-auto rounded-md bg-zinc-950 p-3">
          <pre className="whitespace-pre-wrap break-words font-mono text-xs text-zinc-300">
            <code>{command.content}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}

function ClaudeMdCard({ file }: { file: ClaudeMdEntry }) {
  const [expanded, setExpanded] = useState(false)
  const color =
    file.scope === "project" && file.projectName
      ? getProjectColor(file.projectName)
      : null

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 shrink-0 text-zinc-500" />
            <CardTitle className="text-sm text-zinc-100 font-mono">
              {file.path}
            </CardTitle>
            {file.scope === "global" ? (
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
                global
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className={color ? `${color.bg} ${color.text}` : "bg-zinc-800 text-zinc-400"}
              >
                {file.projectName}
              </Badge>
            )}
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            {expanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          {formatBytes(file.size)}
          {file.truncated && " (preview)"}
        </p>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="max-h-96 overflow-y-auto rounded-md bg-zinc-950 p-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-zinc-300">
              <code>{file.content}</code>
            </pre>
          </div>
          {file.truncated && (
            <p className="mt-2 text-[10px] text-zinc-600">
              Full file: {formatBytes(file.size)}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Group commands by scope, with global first then by project name.
 */
function groupCommands(
  commands: CommandEntry[]
): { label: string; projectName: string | null; commands: CommandEntry[] }[] {
  const global = commands.filter((c) => c.scope === "global")
  const projectMap = new Map<string, CommandEntry[]>()

  for (const cmd of commands) {
    if (cmd.scope === "project" && cmd.projectName) {
      const existing = projectMap.get(cmd.projectName) ?? []
      existing.push(cmd)
      projectMap.set(cmd.projectName, existing)
    }
  }

  const groups: { label: string; projectName: string | null; commands: CommandEntry[] }[] = []

  if (global.length > 0) {
    groups.push({ label: "Global Commands", projectName: null, commands: global })
  }

  const sortedProjects = Array.from(projectMap.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  for (const [projectName, cmds] of sortedProjects) {
    groups.push({ label: projectName, projectName, commands: cmds })
  }

  return groups
}

export default function SkillsPage() {
  const [data, setData] = useState<SkillsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills")
      if (!res.ok) throw new Error("Failed to fetch skills")
      const json: SkillsData = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const commandCount = data?.commands.length ?? 0
  const claudeMdCount = data?.claudeMdFiles.length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Skills
        </h1>
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
          {loading
            ? "..."
            : `${commandCount} command${commandCount !== 1 ? "s" : ""}, ${claudeMdCount} instruction${claudeMdCount !== 1 ? "s" : ""}`}
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
          <Skeleton className="h-10 w-64 rounded-lg bg-zinc-800" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl bg-zinc-800" />
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <Tabs defaultValue="commands">
          <TabsList className="bg-zinc-900">
            <TabsTrigger value="commands">
              Commands
              {commandCount > 0 && (
                <span className="ml-1.5 text-xs text-zinc-500">
                  {commandCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="instructions">
              Instructions
              {claudeMdCount > 0 && (
                <span className="ml-1.5 text-xs text-zinc-500">
                  {claudeMdCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="commands" className="mt-4">
            {commandCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Sparkles className="mb-4 size-12 text-zinc-800" />
                <p className="text-sm text-zinc-500">
                  No custom commands found.
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Add .md files to ~/.claude/commands/ to create slash commands.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupCommands(data.commands).map((group) => {
                  const color =
                    group.projectName
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
                      <div className="grid gap-4 md:grid-cols-2">
                        {group.commands.map((cmd) => (
                          <CommandCard
                            key={`${cmd.scope}-${cmd.projectName}-${cmd.name}`}
                            command={cmd}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="instructions" className="mt-4">
            {claudeMdCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="mb-4 size-12 text-zinc-800" />
                <p className="text-sm text-zinc-500">
                  No CLAUDE.md files found.
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Add CLAUDE.md files to your projects for per-project instructions.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.claudeMdFiles.map((file) => (
                  <ClaudeMdCard key={file.path} file={file} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
