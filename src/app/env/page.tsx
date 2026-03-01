"use client"

import { useEffect, useState, useCallback } from "react"
import { Shield, FileWarning, FolderOpen, Eye, EyeOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { getProjectColor } from "@/lib/project-colors"

interface EnvFileEntry {
  projectName: string
  projectDir: string
  fileName: string
  path: string
  variableCount: number
  size: number
  inGitignore: boolean
  isExposed: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function EnvFileRow({ file }: { file: EnvFileEntry }) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
        file.isExposed
          ? "border-red-800 bg-red-950/30"
          : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <FileWarning
          className={`size-4 shrink-0 ${
            file.isExposed ? "text-red-400" : "text-zinc-500"
          }`}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">
            {file.fileName}
          </p>
          <p className="text-xs text-zinc-500 truncate">{file.path}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-xs text-zinc-400 tabular-nums">
          {file.variableCount} var{file.variableCount !== 1 ? "s" : ""}
        </span>
        <span className="text-xs text-zinc-500 tabular-nums">
          {formatBytes(file.size)}
        </span>
        {file.inGitignore ? (
          <Badge
            variant="secondary"
            className="bg-emerald-900/60 text-emerald-400 gap-1"
          >
            <EyeOff className="size-3" />
            Protected
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="bg-red-900/60 text-red-400 gap-1"
          >
            <Eye className="size-3" />
            Exposed
          </Badge>
        )}
      </div>
    </div>
  )
}

function ProjectGroup({
  projectName,
  files,
}: {
  projectName: string
  files: EnvFileEntry[]
}) {
  const color = getProjectColor(projectName)
  const exposedCount = files.filter((f) => f.isExposed).length

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block size-2.5 rounded-full ${color.dot}`}
            />
            <CardTitle className="text-base text-zinc-100">
              {projectName}
            </CardTitle>
            <span className="text-xs text-zinc-500">
              {files.length} file{files.length !== 1 ? "s" : ""}
            </span>
          </div>
          {exposedCount > 0 && (
            <Badge
              variant="secondary"
              className="bg-red-900/60 text-red-400"
            >
              {exposedCount} exposed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {files.map((file) => (
          <EnvFileRow key={file.path} file={file} />
        ))}
      </CardContent>
    </Card>
  )
}

export default function EnvScannerPage() {
  const [data, setData] = useState<EnvFileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEnv = useCallback(async () => {
    try {
      const res = await fetch("/api/env")
      if (!res.ok) throw new Error("Failed to fetch env data")
      const json: EnvFileEntry[] = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEnv()
  }, [fetchEnv])

  const exposedCount = data.filter((f) => f.isExposed).length
  const projectNames = [...new Set(data.map((f) => f.projectName))]
  const grouped = projectNames.map((name) => ({
    projectName: name,
    files: data.filter((f) => f.projectName === name),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Env Scanner
        </h1>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Summary stats */}
      {!loading && !error && data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-500">Total Env Files</p>
            <p className="text-2xl font-bold tabular-nums text-zinc-100">
              {data.length}
            </p>
          </div>
          <div
            className={`rounded-lg border px-4 py-3 ${
              exposedCount > 0
                ? "border-red-800 bg-red-950/30"
                : "border-zinc-800 bg-zinc-900"
            }`}
          >
            <p className="text-xs text-zinc-500">Exposed</p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                exposedCount > 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {exposedCount}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <p className="text-xs text-zinc-500">Projects Scanned</p>
            <p className="text-2xl font-bold tabular-nums text-zinc-100">
              {projectNames.length}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg bg-zinc-800" />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-40 w-full rounded-xl bg-zinc-800"
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="mb-4 size-12 text-zinc-800" />
          <p className="text-sm text-zinc-500">
            No .env files found &mdash; your projects are clean!
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Env files will appear here once they exist in your project
            directories.
          </p>
        </div>
      )}

      {/* Project groups */}
      {!loading && grouped.length > 0 && (
        <div className="space-y-4">
          {grouped.map((group) => (
            <ProjectGroup
              key={group.projectName}
              projectName={group.projectName}
              files={group.files}
            />
          ))}
        </div>
      )}
    </div>
  )
}
