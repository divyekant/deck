"use client"

import { useEffect, useState, useCallback } from "react"
import { GitBranch, FolderGit2, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getProjectColor } from "@/lib/project-colors"

interface WorktreeEntry {
  projectName: string
  worktreePath: string
  branch: string
  isMain: boolean
  commitHash: string
  fileCount: number | null
  isDirty: boolean
}

/**
 * Group worktrees by project name.
 */
function groupByProject(
  worktrees: WorktreeEntry[]
): { projectName: string; worktrees: WorktreeEntry[] }[] {
  const map = new Map<string, WorktreeEntry[]>()

  for (const wt of worktrees) {
    const existing = map.get(wt.projectName) ?? []
    existing.push(wt)
    map.set(wt.projectName, existing)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([projectName, entries]) => ({
      projectName,
      worktrees: entries.sort((a, b) => {
        // Main worktree first, then alphabetical by branch
        if (a.isMain !== b.isMain) return a.isMain ? -1 : 1
        return a.branch.localeCompare(b.branch)
      }),
    }))
}

function WorktreeCard({ worktree }: { worktree: WorktreeEntry }) {
  const color = getProjectColor(worktree.projectName)

  return (
    <Card
      className={`border-zinc-800 bg-zinc-900 ${
        worktree.isMain
          ? `border-l-2 ${color.borderLeft}`
          : "border-l-2 border-l-zinc-700"
      }`}
    >
      <CardContent className="pt-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <GitBranch
                className={`size-4 shrink-0 ${
                  worktree.isMain ? color.text : "text-zinc-500"
                }`}
              />
              <span
                className={`text-sm font-semibold truncate ${
                  worktree.isMain ? color.text : "text-zinc-200"
                }`}
              >
                {worktree.branch}
              </span>
              {worktree.isMain && (
                <Badge
                  variant="secondary"
                  className={`shrink-0 ${color.bg} ${color.text}`}
                >
                  main
                </Badge>
              )}
              {worktree.isDirty && (
                <Badge
                  variant="secondary"
                  className="shrink-0 bg-amber-900/60 text-amber-400"
                >
                  dirty
                </Badge>
              )}
            </div>
            <p className="mt-1.5 truncate font-mono text-xs text-zinc-500">
              {worktree.worktreePath}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
          {worktree.commitHash && (
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-zinc-400">
                {worktree.commitHash.slice(0, 7)}
              </span>
            </span>
          )}
          {worktree.fileCount !== null && (
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-400">{worktree.fileCount}</span>
              file{worktree.fileCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function WorktreesPage() {
  const [worktrees, setWorktrees] = useState<WorktreeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorktrees = useCallback(async () => {
    try {
      const res = await fetch("/api/worktrees")
      if (!res.ok) throw new Error("Failed to fetch worktrees")
      const json = await res.json()
      setWorktrees(json.worktrees as WorktreeEntry[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorktrees()
  }, [fetchWorktrees])

  const groups = groupByProject(worktrees)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitBranch className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Worktrees
        </h1>
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
          {loading
            ? "..."
            : `${worktrees.length} worktree${worktrees.length !== 1 ? "s" : ""}`}
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
            <Skeleton key={i} className="h-28 w-full rounded-xl bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && worktrees.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderGit2 className="mb-4 size-12 text-zinc-800" />
          <p className="text-sm text-zinc-500">No worktrees found.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Use <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-400">claude</code> with the worktree flag to create isolated worktrees for your projects.
          </p>
        </div>
      )}

      {/* Worktree groups by project */}
      {!loading && worktrees.length > 0 && (
        <div className="space-y-8">
          {groups.map((group) => {
            const color = getProjectColor(group.projectName)
            const secondaryCount = group.worktrees.filter(
              (w) => !w.isMain
            ).length
            const dirtyCount = group.worktrees.filter(
              (w) => w.isDirty
            ).length

            return (
              <div key={group.projectName}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={`inline-block size-2 rounded-full ${color.dot}`}
                  />
                  <h2 className="text-sm font-medium text-zinc-400">
                    {group.projectName}
                  </h2>
                  <Badge
                    variant="secondary"
                    className="bg-zinc-800 text-zinc-500"
                  >
                    {group.worktrees.length}
                  </Badge>
                  {secondaryCount > 0 && (
                    <span className="text-xs text-zinc-600">
                      {secondaryCount} secondary
                    </span>
                  )}
                  {dirtyCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                      <AlertCircle className="size-3" />
                      {dirtyCount} dirty
                    </span>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {group.worktrees.map((wt) => (
                    <WorktreeCard
                      key={wt.worktreePath}
                      worktree={wt}
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
