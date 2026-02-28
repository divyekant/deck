"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, MessageSquare, DollarSign, Cpu, Calendar, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatsCard } from "@/components/stats-card"
import { CostTrendChart } from "@/components/cost-trend-chart"
import { formatCost, formatTokens } from "@/lib/claude/costs"
import type { SessionMeta } from "@/lib/claude/types"

interface ModelSummary {
  model: string
  cost: number
  sessions: number
}

interface ProjectDetail {
  projectName: string
  projectPath: string
  totalSessions: number
  totalCost: number
  models: ModelSummary[]
  activeDays: number
  costTrend: { date: string; cost: number }[]
  topSessionsByCost: SessionMeta[]
  sessions: SessionMeta[]
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + "..."
}

function formatDate(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  const remainMin = min % 60
  return remainMin > 0 ? `${hr}h ${remainMin}m` : `${hr}h`
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const name = decodeURIComponent(params.name as string)

  const [data, setData] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(name)}`)
        if (!res.ok) {
          if (res.status === 404) throw new Error("Project not found")
          throw new Error("Failed to fetch project")
        }
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    fetchProject()
  }, [name])

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-400">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/repos")}
          className="text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="size-4" />
          Back to Repos
        </Button>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-zinc-800" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl bg-zinc-800" />
        <Skeleton className="h-48 rounded-xl bg-zinc-800" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/repos")}
          className="mt-0.5 shrink-0 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            {data.projectName}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.projectPath}
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Sessions"
          value={data.totalSessions}
          icon={MessageSquare}
        />
        <StatsCard
          title="Total Cost"
          value={formatCost(data.totalCost)}
          icon={DollarSign}
        />
        <StatsCard
          title="Models Used"
          value={data.models.length}
          icon={Cpu}
        />
        <StatsCard
          title="Active Days"
          value={data.activeDays}
          icon={Calendar}
        />
      </div>

      {/* Cost Trend */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-300">
            Cost Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CostTrendChart data={data.costTrend} days={30} />
        </CardContent>
      </Card>

      {/* Model Breakdown + Top Sessions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Model Breakdown */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-300">
              Model Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-zinc-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Model</TableHead>
                    <TableHead className="text-zinc-400 text-right">Sessions</TableHead>
                    <TableHead className="text-zinc-400 text-right">Cost</TableHead>
                    <TableHead className="text-zinc-400 text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.models.map((m) => (
                    <TableRow key={m.model} className="border-zinc-800">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-zinc-700 text-[10px] text-zinc-400"
                        >
                          {m.model}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-zinc-400">
                        {m.sessions}
                      </TableCell>
                      <TableCell className="text-right text-zinc-300">
                        {formatCost(m.cost)}
                      </TableCell>
                      <TableCell className="text-right text-zinc-500">
                        {data.totalCost > 0
                          ? `${((m.cost / data.totalCost) * 100).toFixed(1)}%`
                          : "0%"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Most Expensive Sessions */}
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-300">
              Most Expensive Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topSessionsByCost.map((s) => (
                <Link key={s.id} href={`/sessions/${s.id}`}>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80 cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-zinc-300 truncate flex-1">
                        {truncate(s.firstPrompt, 60)}
                      </p>
                      <span className="shrink-0 text-sm font-medium text-zinc-200">
                        {formatCost(s.estimatedCost)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="border-zinc-700 text-[10px] text-zinc-500"
                      >
                        {s.model}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {s.messageCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(s.startTime)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Session List */}
      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-100">
          All Sessions
        </h2>
        <div className="rounded-md border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400 w-[60px]">Source</TableHead>
                <TableHead className="text-zinc-400">First Prompt</TableHead>
                <TableHead className="text-zinc-400">Model</TableHead>
                <TableHead className="text-zinc-400 text-right">Messages</TableHead>
                <TableHead className="text-zinc-400 text-right">Tokens</TableHead>
                <TableHead className="text-zinc-400 text-right">Cost</TableHead>
                <TableHead className="text-zinc-400 text-right">Duration</TableHead>
                <TableHead className="text-zinc-400 text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="cursor-pointer border-zinc-800 transition-colors hover:bg-zinc-800/50"
                  onClick={() => router.push(`/sessions/${session.id}`)}
                >
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        session.source === "codex"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px]"
                          : "bg-zinc-800 text-zinc-400 text-[10px]"
                      }
                    >
                      {session.source === "codex" ? "Codex" : "CC"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs text-zinc-400">
                    {truncate(session.firstPrompt, 60)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-[10px] text-zinc-500"
                    >
                      {session.model}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-zinc-400">
                    {session.messageCount}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-zinc-500">
                    {formatTokens(session.totalInputTokens)} /{" "}
                    {formatTokens(session.totalOutputTokens)}
                  </TableCell>
                  <TableCell className="text-right text-zinc-300">
                    {formatCost(session.estimatedCost)}
                  </TableCell>
                  <TableCell className="text-right text-zinc-500">
                    {formatDuration(session.duration)}
                  </TableCell>
                  <TableCell className="text-right text-zinc-500">
                    {formatDate(session.startTime)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
