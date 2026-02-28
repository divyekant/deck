"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCost } from "@/lib/claude/costs"

// ---- Types ----

interface GraphNode {
  id: string
  type: "project" | "session" | "file"
  label: string
  color?: string
  cost?: number
  date?: string
  project?: string
  firstPrompt?: string
  messageCount?: number
  action?: string
  changeCount?: number
}

interface GraphEdge {
  source: string
  target: string
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    projectCount: number
    sessionCount: number
    fileCount: number
  }
}

interface PositionedNode extends GraphNode {
  x: number
  y: number
  radius: number
}

// ---- Color name to hex ----

const COLOR_HEX: Record<string, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
  lime: "#84cc16",
  indigo: "#6366f1",
}

// Default file color
const FILE_COLOR = "#71717a" // zinc-500

// ---- Layout helpers ----

function computeLayout(data: GraphData): PositionedNode[] {
  const { nodes, edges } = data
  const positioned: PositionedNode[] = []

  // Separate by type
  const projects = nodes.filter((n) => n.type === "project")
  const sessions = nodes.filter((n) => n.type === "session")
  const files = nodes.filter((n) => n.type === "file")

  // Build adjacency: for each session, find its project
  const sessionToProject = new Map<string, string>()
  const sessionToFiles = new Map<string, string[]>()
  const fileToSessions = new Map<string, string[]>()

  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)
    if (!sourceNode || !targetNode) continue

    if (sourceNode.type === "session" && targetNode.type === "project") {
      sessionToProject.set(sourceNode.id, targetNode.id)
    }
    if (sourceNode.type === "session" && targetNode.type === "file") {
      const existing = sessionToFiles.get(sourceNode.id) ?? []
      existing.push(targetNode.id)
      sessionToFiles.set(sourceNode.id, existing)

      const fSessions = fileToSessions.get(targetNode.id) ?? []
      fSessions.push(sourceNode.id)
      fileToSessions.set(targetNode.id, fSessions)
    }
  }

  // Center of the graph
  const cx = 500
  const cy = 400

  // Place projects in a circle
  const projectRadius = Math.max(150, projects.length * 40)
  const projectPositions = new Map<string, { x: number; y: number }>()

  for (let i = 0; i < projects.length; i++) {
    const angle = (2 * Math.PI * i) / Math.max(projects.length, 1) - Math.PI / 2
    const x = cx + projectRadius * Math.cos(angle)
    const y = cy + projectRadius * Math.sin(angle)
    projectPositions.set(projects[i].id, { x, y })
    positioned.push({ ...projects[i], x, y, radius: 24 })
  }

  // Place sessions clustered near their project
  const sessionPositions = new Map<string, { x: number; y: number }>()
  const projectSessionCounters = new Map<string, number>()

  for (const session of sessions) {
    const projectId = sessionToProject.get(session.id)
    const projectPos = projectId ? projectPositions.get(projectId) : null
    const baseX = projectPos?.x ?? cx
    const baseY = projectPos?.y ?? cy

    const counter = projectSessionCounters.get(projectId ?? "") ?? 0
    projectSessionCounters.set(projectId ?? "", counter + 1)

    // Spiral layout around the project node
    const spiralAngle = counter * 0.8 + Math.random() * 0.3
    const spiralDist = 50 + counter * 12 + Math.random() * 20
    const x = baseX + spiralDist * Math.cos(spiralAngle)
    const y = baseY + spiralDist * Math.sin(spiralAngle)

    sessionPositions.set(session.id, { x, y })
    positioned.push({ ...session, x, y, radius: 8 })
  }

  // Place files near the centroid of sessions that touch them
  for (const file of files) {
    const sessionsForFile = fileToSessions.get(file.id) ?? []
    let avgX = cx
    let avgY = cy

    if (sessionsForFile.length > 0) {
      let totalX = 0
      let totalY = 0
      for (const sid of sessionsForFile) {
        const pos = sessionPositions.get(sid)
        totalX += pos?.x ?? cx
        totalY += pos?.y ?? cy
      }
      avgX = totalX / sessionsForFile.length
      avgY = totalY / sessionsForFile.length
    }

    // Offset slightly to avoid exact overlap
    const jitterAngle = Math.random() * 2 * Math.PI
    const jitterDist = 15 + Math.random() * 25
    const x = avgX + jitterDist * Math.cos(jitterAngle)
    const y = avgY + jitterDist * Math.sin(jitterAngle)

    positioned.push({ ...file, x, y, radius: 4 })
  }

  return positioned
}

// Compute bounding box for viewBox
function computeViewBox(nodes: PositionedNode[]): string {
  if (nodes.length === 0) return "0 0 1000 800"

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.radius)
    minY = Math.min(minY, n.y - n.radius)
    maxX = Math.max(maxX, n.x + n.radius)
    maxY = Math.max(maxY, n.y + n.radius)
  }

  const pad = 80
  return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
}

// ---- Tooltip ----

function TooltipContent({ node }: { node: GraphNode }) {
  if (node.type === "project") {
    return (
      <div>
        <div className="font-medium text-zinc-100">{node.label}</div>
        <div className="text-zinc-400 text-xs mt-0.5">Project</div>
      </div>
    )
  }

  if (node.type === "session") {
    return (
      <div>
        <div className="font-medium text-zinc-100 max-w-[240px] break-words">
          {node.firstPrompt
            ? node.firstPrompt.length > 100
              ? node.firstPrompt.slice(0, 100) + "..."
              : node.firstPrompt
            : "Session"}
        </div>
        <div className="flex gap-3 mt-1 text-xs text-zinc-400">
          {node.date && (
            <span>
              {new Date(node.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {node.messageCount != null && <span>{node.messageCount} msgs</span>}
          {node.cost != null && <span>{formatCost(node.cost)}</span>}
        </div>
        {node.project && (
          <div className="text-xs text-zinc-500 mt-0.5">{node.project}</div>
        )}
      </div>
    )
  }

  // file
  return (
    <div>
      <div className="font-mono text-zinc-100 text-xs">{node.label}</div>
      <div className="flex gap-3 mt-0.5 text-xs text-zinc-400">
        {node.action && <span>{node.action}</span>}
        {node.changeCount != null && (
          <span>{node.changeCount} change{node.changeCount !== 1 ? "s" : ""}</span>
        )}
      </div>
    </div>
  )
}

// ---- Main Component ----

export default function WorkGraphPage() {
  const router = useRouter()
  const [data, setData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  // Fetch data
  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch(`/api/work-graph?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load graph data")
        return res.json()
      })
      .then((d: GraphData) => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [days])

  // Compute layout
  const positionedNodes = useMemo(() => {
    if (!data) return []
    return computeLayout(data)
  }, [data])

  const viewBox = useMemo(() => computeViewBox(positionedNodes), [positionedNodes])

  // Build a position lookup for edges
  const nodePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; color?: string }>()
    for (const n of positionedNodes) {
      map.set(n.id, { x: n.x, y: n.y, color: n.color })
    }
    return map
  }, [positionedNodes])

  // Connected edges and nodes for hover highlight
  const connectedSet = useMemo(() => {
    if (!hoveredId || !data) return new Set<string>()
    const set = new Set<string>()
    set.add(hoveredId)
    for (const edge of data.edges) {
      if (edge.source === hoveredId || edge.target === hoveredId) {
        set.add(edge.source)
        set.add(edge.target)
      }
    }
    return set
  }, [hoveredId, data])

  const hoveredNode = useMemo(() => {
    if (!hoveredId) return null
    return positionedNodes.find((n) => n.id === hoveredId) ?? null
  }, [hoveredId, positionedNodes])

  // Mouse handlers
  const handleNodeHover = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      setHoveredId(nodeId)
      setTooltipPos({ x: event.clientX, y: event.clientY })
    },
    []
  )

  const handleNodeLeave = useCallback(() => {
    setHoveredId(null)
    setTooltipPos(null)
  }, [])

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      if (node.type === "project") {
        router.push(`/repos/${encodeURIComponent(node.label)}`)
      } else if (node.type === "session") {
        const sessionId = node.id.replace("session:", "")
        router.push(`/sessions/${sessionId}`)
      }
    },
    [router]
  )

  // ---- Render ----

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-100">Work Graph</h1>

        <div className="flex items-center gap-4">
          {/* Stats */}
          {data && !loading && (
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <span>
                <span className="text-zinc-200 font-medium">
                  {data.stats.projectCount}
                </span>{" "}
                projects
              </span>
              <span className="text-zinc-600">|</span>
              <span>
                <span className="text-zinc-200 font-medium">
                  {data.stats.sessionCount}
                </span>{" "}
                sessions
              </span>
              <span className="text-zinc-600">|</span>
              <span>
                <span className="text-zinc-200 font-medium">
                  {data.stats.fileCount}
                </span>{" "}
                files
              </span>
            </div>
          )}

          {/* Date range buttons */}
          <div className="flex items-center gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  days === d
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Graph area */}
      <div className="relative bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden" style={{ minHeight: 500 }}>
        {loading && (
          <div className="flex flex-col items-center justify-center h-[500px] gap-4">
            <Skeleton className="h-64 w-64 rounded-full bg-zinc-800" />
            <div className="text-sm text-zinc-500">Loading work graph...</div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-[500px]">
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {!loading && !error && data && data.nodes.length === 0 && (
          <div className="flex items-center justify-center h-[500px]">
            <div className="text-center">
              <div className="text-zinc-400 text-sm">
                No sessions found in the last {days} days
              </div>
              <div className="text-zinc-500 text-xs mt-1">
                Try expanding the date range
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && data.nodes.length > 0 && (
          <svg
            viewBox={viewBox}
            className="w-full"
            style={{ minHeight: 500, height: "calc(100vh - 200px)", maxHeight: 800 }}
            onMouseLeave={handleNodeLeave}
          >
            {/* Edges */}
            {data.edges.map((edge, i) => {
              const from = nodePositions.get(edge.source)
              const to = nodePositions.get(edge.target)
              if (!from || !to) return null

              const isHighlighted =
                hoveredId !== null &&
                (connectedSet.has(edge.source) && connectedSet.has(edge.target))
              const edgeColor = from.color ?? to.color ?? FILE_COLOR

              return (
                <line
                  key={`edge-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={edgeColor}
                  strokeWidth={isHighlighted ? 1.5 : 0.5}
                  strokeOpacity={
                    hoveredId === null ? 0.15 : isHighlighted ? 0.6 : 0.04
                  }
                />
              )
            })}

            {/* Nodes */}
            {positionedNodes.map((node) => {
              const isHovered = hoveredId === node.id
              const isConnected = connectedSet.has(node.id)
              const dimmed = hoveredId !== null && !isConnected

              const fill = node.type === "file" ? FILE_COLOR : node.color ?? FILE_COLOR
              let opacity = 1
              if (dimmed) opacity = 0.15
              else if (hoveredId !== null && isConnected && !isHovered) opacity = 0.8

              const r = isHovered ? node.radius * 1.3 : node.radius
              const cursor =
                node.type === "project" || node.type === "session"
                  ? "pointer"
                  : "default"

              return (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill={fill}
                    fillOpacity={node.type === "session" ? opacity * 0.7 : opacity}
                    stroke={isHovered ? "#e4e4e7" : "none"}
                    strokeWidth={isHovered ? 2 : 0}
                    style={{ cursor, transition: "r 0.15s, fill-opacity 0.15s" }}
                    onMouseEnter={(e) => handleNodeHover(node.id, e)}
                    onMouseMove={(e) =>
                      setTooltipPos({ x: e.clientX, y: e.clientY })
                    }
                    onMouseLeave={handleNodeLeave}
                    onClick={() => handleNodeClick(node)}
                  />
                  {/* Labels for project nodes */}
                  {node.type === "project" && (
                    <text
                      x={node.x}
                      y={node.y + node.radius + 14}
                      textAnchor="middle"
                      fill={dimmed ? "#3f3f46" : "#a1a1aa"}
                      fontSize={12}
                      fontWeight={500}
                      style={{ pointerEvents: "none" }}
                    >
                      {node.label}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        )}

        {/* Tooltip */}
        {hoveredNode && tooltipPos && (
          <div
            className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm shadow-lg pointer-events-none"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 8,
              maxWidth: 300,
            }}
          >
            <TooltipContent node={hoveredNode} />
          </div>
        )}

        {/* Legend */}
        {!loading && !error && data && data.nodes.length > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-4 text-xs text-zinc-500 bg-zinc-950/80 px-3 py-2 rounded-md border border-zinc-800/50 backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12">
                <circle cx="6" cy="6" r="6" fill="#3b82f6" />
              </svg>
              <span>Project</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10">
                <circle cx="5" cy="5" r="4" fill="#3b82f6" fillOpacity="0.7" />
              </svg>
              <span>Session</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="8" height="8">
                <circle cx="4" cy="4" r="3" fill={FILE_COLOR} />
              </svg>
              <span>File</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
