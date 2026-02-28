"use client"

import { useEffect, useState, useCallback } from "react"
import { formatCost } from "@/lib/claude/costs"

// ---- Types ----

type ReportType = "weekly" | "monthly" | "project"

interface DailyActivityEntry {
  date: string
  count: number
  cost: number
}

interface TopSession {
  id: string
  prompt: string
  cost: number
  project: string
  model: string
}

interface ModelBreakdownEntry {
  model: string
  cost: number
  sessions: number
}

interface ReportData {
  title: string
  dateRange: { start: string; end: string }
  summary: {
    sessions: number
    cost: number
    models: number
    projects: string[]
  }
  dailyActivity: DailyActivityEntry[]
  topSessions: TopSession[]
  modelBreakdown: ModelBreakdownEntry[]
  availableProjects: string[]
}

// ---- Helpers ----

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + "..."
}

function getModelDisplayName(model: string): string {
  return model.replace("claude-", "").replace(/-\d{8}$/, "")
}

// ---- Report Type Card ----

function TypeCard({
  type,
  title,
  description,
  selected,
  onClick,
}: {
  type: ReportType
  title: string
  description: string
  selected: boolean
  onClick: (type: ReportType) => void
}) {
  return (
    <button
      onClick={() => onClick(type)}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-emerald-500/50 bg-emerald-950/30"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      }`}
    >
      <p className={`text-sm font-medium ${selected ? "text-emerald-400" : "text-zinc-300"}`}>
        {title}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
    </button>
  )
}

// ---- CSS Bar Chart (print-friendly) ----

function ActivityBarChart({ data }: { data: DailyActivityEntry[] }) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-400">No activity data.</p>
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  // Show at most ~30 bars, sample if more
  const display = data.length > 35
    ? data.filter((_, i) => i % Math.ceil(data.length / 30) === 0)
    : data

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-px" style={{ height: "120px" }}>
        {display.map((d) => {
          const heightPct = (d.count / maxCount) * 100
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col justify-end items-center group relative"
              style={{ height: "100%" }}
            >
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max(heightPct, 2)}%`,
                  backgroundColor: d.count > 0 ? "#10b981" : "#27272a",
                  minHeight: "2px",
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{formatDateShort(display[0].date)}</span>
        <span>{formatDateShort(display[display.length - 1].date)}</span>
      </div>
    </div>
  )
}

// ---- Model Cost Bars (CSS, print-friendly) ----

function ModelCostBars({ data }: { data: ModelBreakdownEntry[] }) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-400">No model data.</p>
  }

  const maxCost = data[0]?.cost ?? 1

  return (
    <div className="space-y-2.5">
      {data.map((m) => {
        const widthPct = maxCost > 0 ? (m.cost / maxCost) * 100 : 0
        return (
          <div key={m.model}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-700 font-medium">
                {getModelDisplayName(m.model)}
                <span className="ml-1.5 text-gray-400 font-normal">
                  {m.sessions} session{m.sessions !== 1 ? "s" : ""}
                </span>
              </span>
              <span className="tabular-nums text-gray-600">{formatCost(m.cost)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(widthPct, 1)}%`,
                  backgroundColor: "#10b981",
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- Report Preview ----

function ReportPreview({ data }: { data: ReportData }) {
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div
      id="report-preview"
      className="bg-white text-gray-900 rounded-lg shadow-sm print:shadow-none print:rounded-none"
    >
      {/* Header */}
      <div className="border-b border-gray-200 px-8 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Deck Activity Report</h1>
        <p className="mt-1 text-sm text-gray-500">
          {data.title} &mdash; {formatDate(data.dateRange.start)} to {formatDate(data.dateRange.end)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 px-8 py-6 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Sessions</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
            {data.summary.sessions.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Cost</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
            {formatCost(data.summary.cost)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Models</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
            {data.summary.models}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Projects</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
            {data.summary.projects.length}
          </p>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="px-8 py-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Daily Activity
        </h2>
        <ActivityBarChart data={data.dailyActivity} />
      </div>

      {/* Cost Breakdown by Model */}
      <div className="px-8 py-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Cost by Model
        </h2>
        <ModelCostBars data={data.modelBreakdown} />
      </div>

      {/* Top Sessions Table */}
      {data.topSessions.length > 0 && (
        <div className="px-8 py-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Top Sessions by Cost
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-4">Project</th>
                  <th className="pb-2 pr-4">Prompt</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.topSessions.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">{s.project}</td>
                    <td className="py-2 pr-4 text-gray-600 max-w-xs">
                      {truncate(s.prompt, 60)}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 print:border print:border-gray-300">
                        {getModelDisplayName(s.model)}
                      </span>
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700">
                      {formatCost(s.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Projects List */}
      {data.summary.projects.length > 0 && (
        <div className="px-8 py-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Projects
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.summary.projects.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 print:border print:border-gray-300"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 px-8 py-4 mt-4">
        <p className="text-xs text-gray-400 text-center">
          Generated by Deck on {generatedDate}
        </p>
      </div>
    </div>
  )
}

// ---- Main Page ----

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("weekly")
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [availableProjects, setAvailableProjects] = useState<string[]>([])

  // Fetch available projects on mount
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/reports?type=weekly")
        if (!res.ok) return
        const json: ReportData = await res.json()
        setAvailableProjects(json.availableProjects)
        if (json.availableProjects.length > 0 && !selectedProject) {
          setSelectedProject(json.availableProjects[0])
        }
      } catch {
        // ignore
      }
    }
    fetchProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generateReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: reportType })
      if (reportType === "project" && selectedProject) {
        params.set("project", selectedProject)
      }
      const res = await fetch(`/api/reports?${params.toString()}`)
      if (!res.ok) return
      const json: ReportData = await res.json()
      setData(json)
      setAvailableProjects(json.availableProjects)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [reportType, selectedProject])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the report */
          body > div > div > aside,
          body > div > div > nav,
          body > div > div > main > div > div:first-child,
          [data-config-panel] {
            display: none !important;
          }

          /* Report takes full width */
          main {
            padding: 0 !important;
            overflow: visible !important;
          }

          #report-preview {
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* Force white background */
          body,
          html {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Ensure bar chart colors print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Page breaks */
          #report-preview > div {
            page-break-inside: avoid;
          }

          table {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Config Panel */}
        <div data-config-panel className="w-full shrink-0 space-y-5 lg:w-72 xl:w-80">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Reports</h1>

          {/* Report Type Selection */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Report Type
            </p>
            <TypeCard
              type="weekly"
              title="Weekly"
              description="Last 7 days of activity"
              selected={reportType === "weekly"}
              onClick={setReportType}
            />
            <TypeCard
              type="monthly"
              title="Monthly"
              description="Last 30 days of activity"
              selected={reportType === "monthly"}
              onClick={setReportType}
            />
            <TypeCard
              type="project"
              title="Project"
              description="All-time report for a project"
              selected={reportType === "project"}
              onClick={setReportType}
            />
          </div>

          {/* Project Selector */}
          {reportType === "project" && (
            <div className="space-y-1.5">
              <label
                htmlFor="project-select"
                className="text-xs font-medium uppercase tracking-wider text-zinc-500"
              >
                Project
              </label>
              <select
                id="project-select"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 focus:border-zinc-600 focus:outline-none"
              >
                {availableProjects.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Display */}
          {data && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
                Date Range
              </p>
              <p className="text-sm text-zinc-300">
                {formatDate(data.dateRange.start)} &mdash; {formatDate(data.dateRange.end)}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={generateReport}
              disabled={loading || (reportType === "project" && !selectedProject)}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Generating..." : "Generate Report"}
            </button>

            {data && (
              <button
                onClick={handlePrint}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                Print Report
              </button>
            )}
          </div>
        </div>

        {/* Report Preview */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-32">
              <p className="text-sm text-zinc-500">Generating report...</p>
            </div>
          ) : data ? (
            <ReportPreview data={data} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 py-32">
              <p className="text-sm text-zinc-500">
                Select a report type and click Generate Report.
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                The report preview will appear here.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
