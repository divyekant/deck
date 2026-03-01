"use client"

import { useEffect, useState, useCallback } from "react"
import { Package, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

interface DependencyEntry {
  name: string
  specifiedVersion: string
  installedVersion: string | null
  type: "dependency" | "devDependency"
}

interface DependenciesData {
  dependencies: DependencyEntry[]
  totalDeps: number
  totalDevDeps: number
}

function versionMismatch(specified: string, installed: string | null): boolean {
  if (!installed) return false
  // Strip semver range prefixes (^, ~, >=, etc.) for comparison
  const clean = specified.replace(/^[\^~>=<]+/, "")
  return clean !== installed
}

function DependencyRow({ dep }: { dep: DependencyEntry }) {
  const mismatch = versionMismatch(dep.specifiedVersion, dep.installedVersion)

  return (
    <div className="flex items-center justify-between gap-4 rounded-md px-3 py-2 transition-colors hover:bg-zinc-800/50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-sm text-zinc-100 truncate">
          {dep.name}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-xs text-zinc-400">
          {dep.specifiedVersion}
        </span>
        {dep.installedVersion && (
          <>
            <span className="text-zinc-600">&rarr;</span>
            <span
              className={`font-mono text-xs ${
                mismatch ? "text-amber-400" : "text-zinc-400"
              }`}
            >
              {dep.installedVersion}
            </span>
            {mismatch ? (
              <AlertTriangle className="size-3.5 text-amber-400" />
            ) : (
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            )}
          </>
        )}
        {!dep.installedVersion && (
          <span className="font-mono text-xs text-zinc-600">not installed</span>
        )}
      </div>
    </div>
  )
}

export default function DependenciesPage() {
  const [data, setData] = useState<DependenciesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDependencies = useCallback(async () => {
    try {
      const res = await fetch("/api/dependencies")
      if (!res.ok) throw new Error("Failed to fetch dependencies")
      const json: DependenciesData = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDependencies()
  }, [fetchDependencies])

  const deps = data?.dependencies.filter((d) => d.type === "dependency") ?? []
  const devDeps =
    data?.dependencies.filter((d) => d.type === "devDependency") ?? []
  const totalCount = (data?.totalDeps ?? 0) + (data?.totalDevDeps ?? 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Package className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Dependencies
        </h1>
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
          {loading ? "..." : `${totalCount} package${totalCount !== 1 ? "s" : ""}`}
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
          <div className="flex gap-3">
            <Skeleton className="h-20 w-40 rounded-xl bg-zinc-800" />
            <Skeleton className="h-20 w-40 rounded-xl bg-zinc-800" />
          </div>
          <Skeleton className="h-8 w-48 rounded-lg bg-zinc-800" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && data && totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Package className="mb-4 size-12 text-zinc-800" />
          <p className="text-sm text-zinc-500">No dependencies found.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Could not read package.json or it has no dependencies.
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && data && totalCount > 0 && (
        <>
          {/* Summary stats */}
          <div className="flex gap-3">
            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-blue-950/60">
                  <Package className="size-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-zinc-50">
                    {data.totalDeps}
                  </p>
                  <p className="text-xs text-zinc-500">Dependencies</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="flex items-center gap-3 py-3 px-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-violet-950/60">
                  <Package className="size-4 text-violet-400" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-zinc-50">
                    {data.totalDevDeps}
                  </p>
                  <p className="text-xs text-zinc-500">Dev Dependencies</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dependencies section */}
          {deps.length > 0 && (
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-zinc-300">
                    Dependencies
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-blue-950/60 text-blue-400"
                  >
                    {deps.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-zinc-800/50">
                  {deps.map((dep) => (
                    <DependencyRow key={dep.name} dep={dep} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dev Dependencies section */}
          {devDeps.length > 0 && (
            <Card className="border-zinc-800 bg-zinc-900">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-zinc-300">
                    Dev Dependencies
                  </CardTitle>
                  <Badge
                    variant="secondary"
                    className="bg-violet-950/60 text-violet-400"
                  >
                    {devDeps.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-zinc-800/50">
                  {devDeps.map((dep) => (
                    <DependencyRow key={dep.name} dep={dep} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
