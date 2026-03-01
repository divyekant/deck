"use client"

import { useEffect, useState, useCallback } from "react"
import { Package, AlertTriangle, CheckCircle2, Network, Share2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

// ---- Types ----

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

interface GraphNode {
  id: string
  name: string
  depCount: number
}

interface GraphLink {
  source: string
  target: string
  sharedDeps: string[]
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

type DepTab = "health" | "graph"

const DEP_TABS: { value: DepTab; label: string }[] = [
  { value: "health", label: "Health" },
  { value: "graph", label: "Graph" },
]

// ---- Color helpers ----

const CONNECTION_COLORS = [
  { min: 20, bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400", label: "Strong" },
  { min: 10, bg: "bg-blue-950/60", text: "text-blue-400", dot: "bg-blue-400", label: "Moderate" },
  { min: 5, bg: "bg-amber-950/60", text: "text-amber-400", dot: "bg-amber-400", label: "Weak" },
  { min: 0, bg: "bg-zinc-800", text: "text-zinc-400", dot: "bg-zinc-500", label: "Minimal" },
]

function getConnectionStyle(count: number) {
  for (const c of CONNECTION_COLORS) {
    if (count >= c.min) return c
  }
  return CONNECTION_COLORS[CONNECTION_COLORS.length - 1]
}

const PROJECT_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-violet-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-yellow-500",
  "bg-rose-500",
  "bg-purple-500",
  "bg-green-500",
]

// ---- Health tab components ----

function versionMismatch(specified: string, installed: string | null): boolean {
  if (!installed) return false
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

function HealthTab({
  data,
  loading,
  error,
}: {
  data: DependenciesData | null
  loading: boolean
  error: string | null
}) {
  const deps = data?.dependencies.filter((d) => d.type === "dependency") ?? []
  const devDeps =
    data?.dependencies.filter((d) => d.type === "devDependency") ?? []
  const totalCount = (data?.totalDeps ?? 0) + (data?.totalDevDeps ?? 0)

  return (
    <div className="space-y-6">
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

// ---- Graph tab components ----

function GraphTab({
  data,
  loading,
  error,
}: {
  data: GraphData | null
  loading: boolean
  error: string | null
}) {
  const [expandedLink, setExpandedLink] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-zinc-800" />
          ))}
        </div>
        <Skeleton className="h-8 w-48 rounded-lg bg-zinc-800" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg bg-zinc-800" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Network className="mb-4 size-12 text-zinc-800" />
        <p className="text-sm text-zinc-500">No cross-project data found.</p>
        <p className="mt-1 text-xs text-zinc-600">
          Could not find any projects with package.json files in ~/.claude/projects/.
        </p>
      </div>
    )
  }

  const maxDeps = Math.max(...data.nodes.map((n) => n.depCount), 1)

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="flex gap-3">
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-950/60">
              <Network className="size-4 text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-zinc-50">
                {data.nodes.length}
              </p>
              <p className="text-xs text-zinc-500">Projects</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-950/60">
              <Share2 className="size-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-zinc-50">
                {data.links.length}
              </p>
              <p className="text-xs text-zinc-500">Connections</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project cards grid */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-300">
            Projects
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.nodes.map((node, i) => {
              const barWidth = Math.max(
                8,
                (node.depCount / maxDeps) * 100
              )
              const colorClass = PROJECT_COLORS[i % PROJECT_COLORS.length]

              // Count how many links this node participates in
              const linkCount = data.links.filter(
                (l) => l.source === node.id || l.target === node.id
              ).length

              return (
                <div
                  key={node.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 transition-colors hover:border-zinc-700"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`size-2.5 rounded-full ${colorClass} shrink-0`} />
                    <span className="text-sm font-medium text-zinc-100 truncate" title={node.name}>
                      {node.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                    <span>{node.depCount} deps</span>
                    <span>{linkCount} link{linkCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${colorClass}`}
                      style={{ width: `${barWidth}%`, opacity: 0.7 }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="font-medium text-zinc-400">Connection strength:</span>
        {CONNECTION_COLORS.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            <div className={`size-2 rounded-full ${c.dot}`} />
            <span>
              {c.label} ({c.min}+)
            </span>
          </div>
        ))}
      </div>

      {/* Shared Dependencies table */}
      {data.links.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-zinc-300">
                Shared Dependencies
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-zinc-800 text-zinc-400"
              >
                {data.links.length} pair{data.links.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-zinc-800/50">
              {data.links.map((link, idx) => {
                const sourceNode = data.nodes.find((n) => n.id === link.source)
                const targetNode = data.nodes.find((n) => n.id === link.target)
                const style = getConnectionStyle(link.sharedDeps.length)
                const isExpanded = expandedLink === idx

                return (
                  <div key={`${link.source}-${link.target}`} className="py-2.5">
                    <button
                      onClick={() =>
                        setExpandedLink(isExpanded ? null : idx)
                      }
                      className="flex w-full items-center justify-between gap-4 rounded-md px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`size-2 rounded-full ${style.dot} shrink-0`} />
                        <span className="text-sm text-zinc-100 truncate">
                          {sourceNode?.name ?? link.source}
                        </span>
                        <span className="text-zinc-600 shrink-0">&harr;</span>
                        <span className="text-sm text-zinc-100 truncate">
                          {targetNode?.name ?? link.target}
                        </span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${style.bg} ${style.text} shrink-0`}
                      >
                        {link.sharedDeps.length} shared
                      </Badge>
                    </button>
                    {isExpanded && (
                      <div className="mt-2 ml-8 flex flex-wrap gap-1.5">
                        {link.sharedDeps.map((dep) => (
                          <span
                            key={dep}
                            className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-400"
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {data.links.length === 0 && data.nodes.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center">
          <Share2 className="mx-auto mb-3 size-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No shared dependencies found between projects.
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Each project uses a unique set of packages.
          </p>
        </div>
      )}
    </div>
  )
}

// ---- Main Page ----

export default function DependenciesPage() {
  const [activeTab, setActiveTab] = useState<DepTab>("health")

  // Health tab state
  const [healthData, setHealthData] = useState<DependenciesData | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)

  // Graph tab state
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [graphFetched, setGraphFetched] = useState(false)

  const fetchDependencies = useCallback(async () => {
    try {
      const res = await fetch("/api/dependencies")
      if (!res.ok) throw new Error("Failed to fetch dependencies")
      const json: DependenciesData = await res.json()
      setHealthData(json)
      setHealthError(null)
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setHealthLoading(false)
    }
  }, [])

  const fetchGraph = useCallback(async () => {
    if (graphFetched) return
    setGraphLoading(true)
    try {
      const res = await fetch("/api/dependencies/graph")
      if (!res.ok) throw new Error("Failed to fetch dependency graph")
      const json: GraphData = await res.json()
      setGraphData(json)
      setGraphError(null)
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setGraphLoading(false)
      setGraphFetched(true)
    }
  }, [graphFetched])

  useEffect(() => {
    fetchDependencies()
  }, [fetchDependencies])

  useEffect(() => {
    if (activeTab === "graph") {
      fetchGraph()
    }
  }, [activeTab, fetchGraph])

  const totalCount = (healthData?.totalDeps ?? 0) + (healthData?.totalDevDeps ?? 0)

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="flex items-center gap-3">
        <Package className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Dependencies
        </h1>
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
          {healthLoading ? "..." : `${totalCount} package${totalCount !== 1 ? "s" : ""}`}
        </Badge>
        <div className="ml-4 flex items-center gap-1 border-b border-zinc-800">
          {DEP_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`border-b-2 px-3 pb-2 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "border-emerald-500 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Tab content */}
      {activeTab === "health" && (
        <HealthTab data={healthData} loading={healthLoading} error={healthError} />
      )}
      {activeTab === "graph" && (
        <GraphTab data={graphData} loading={graphLoading} error={graphError} />
      )}
    </div>
  )
}
