"use client"

import { useEffect, useState, useCallback } from "react"
import { Download, Loader2 } from "lucide-react"

type ExportType = "sessions" | "costs" | "tokens" | "models"
type ExportFormat = "json" | "csv"

const EXPORT_TYPES: { value: ExportType; label: string }[] = [
  { value: "sessions", label: "All Sessions" },
  { value: "costs", label: "Cost Report" },
  { value: "tokens", label: "Token Usage" },
  { value: "models", label: "Model Usage" },
]

const PREVIEW_LABELS: Record<ExportType, string[]> = {
  sessions: [
    "ID",
    "Project",
    "Start Time",
    "Duration (s)",
    "Messages",
    "Cost",
    "Model",
    "Cache Reads",
    "Cache Writes",
  ],
  costs: ["Date", "Sessions", "Total Cost", "Avg Cost/Session"],
  tokens: [
    "ID",
    "Project",
    "Model",
    "Start Time",
    "Input",
    "Output",
    "Cache Create",
    "Cache Read",
    "Total",
  ],
  models: [
    "Model",
    "Sessions",
    "Total Cost",
    "Input Tokens",
    "Output Tokens",
    "Cache Create",
    "Cache Read",
    "Avg Cost/Session",
  ],
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "number") {
    // Format costs with 4 decimal places, tokens as integers
    if (
      String(value).includes(".") &&
      Math.abs(value) < 1000
    ) {
      return `$${value.toFixed(4)}`
    }
    return value.toLocaleString()
  }
  if (typeof value === "string" && value.length > 24) {
    return value.slice(0, 21) + "..."
  }
  return String(value)
}

function getRowValues(type: ExportType, row: Record<string, unknown>): string[] {
  switch (type) {
    case "sessions":
      return [
        formatPreviewValue(row.id),
        formatPreviewValue(row.project),
        formatPreviewValue(row.startTime),
        formatPreviewValue(row.duration),
        formatPreviewValue(row.messages),
        formatPreviewValue(row.cost),
        formatPreviewValue(row.model),
        formatPreviewValue(row.cacheReads),
        formatPreviewValue(row.cacheWrites),
      ]
    case "costs":
      return [
        formatPreviewValue(row.date),
        formatPreviewValue(row.sessions),
        formatPreviewValue(row.totalCost),
        formatPreviewValue(row.avgCostPerSession),
      ]
    case "tokens":
      return [
        formatPreviewValue(row.id),
        formatPreviewValue(row.project),
        formatPreviewValue(row.model),
        formatPreviewValue(row.startTime),
        formatPreviewValue(row.inputTokens),
        formatPreviewValue(row.outputTokens),
        formatPreviewValue(row.cacheCreationTokens),
        formatPreviewValue(row.cacheReadTokens),
        formatPreviewValue(row.totalTokens),
      ]
    case "models":
      return [
        formatPreviewValue(row.model),
        formatPreviewValue(row.sessions),
        formatPreviewValue(row.totalCost),
        formatPreviewValue(row.totalInputTokens),
        formatPreviewValue(row.totalOutputTokens),
        formatPreviewValue(row.totalCacheCreationTokens),
        formatPreviewValue(row.totalCacheReadTokens),
        formatPreviewValue(row.avgCostPerSession),
      ]
    default:
      return Object.values(row).map((v) => formatPreviewValue(v))
  }
}

export default function ExportPage() {
  const [exportType, setExportType] = useState<ExportType>("sessions")
  const [format, setFormat] = useState<ExportFormat>("csv")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null)
  const [totalRows, setTotalRows] = useState(0)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true)
    try {
      const params = new URLSearchParams({
        type: exportType,
        format: "json",
      })
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)

      const res = await fetch(`/api/export?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch preview")

      const text = await res.text()
      const data: Record<string, unknown>[] = JSON.parse(text)
      setTotalRows(data.length)
      setPreview(data.slice(0, 5))
    } catch {
      setPreview(null)
      setTotalRows(0)
    } finally {
      setLoadingPreview(false)
    }
  }, [exportType, startDate, endDate])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  async function handleDownload() {
    setDownloading(true)
    try {
      const params = new URLSearchParams({
        type: exportType,
        format,
      })
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)

      const res = await fetch(`/api/export?${params.toString()}`)
      if (!res.ok) throw new Error("Export failed")

      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") || ""
      const filenameMatch = disposition.match(/filename="(.+?)"/)
      const filename = filenameMatch
        ? filenameMatch[1]
        : `deck-export.${format}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Download failed:", err)
    } finally {
      setDownloading(false)
    }
  }

  const headers = PREVIEW_LABELS[exportType]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Download className="size-6 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Data Export
        </h1>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Export Type */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">
            Export Type
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {EXPORT_TYPES.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setExportType(opt.value)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  exportType === opt.value
                    ? "bg-zinc-700 text-zinc-100"
                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-800/80 hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Format + Date Range */}
        <div className="space-y-6">
          {/* Format */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 text-sm font-medium text-zinc-300">Format</h2>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === "csv"}
                  onChange={() => setFormat("csv")}
                  className="accent-emerald-500"
                />
                CSV
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="format"
                  value="json"
                  checked={format === "json"}
                  onChange={() => setFormat("json")}
                  className="accent-emerald-500"
                />
                JSON
              </label>
            </div>
          </div>

          {/* Date Range */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 text-sm font-medium text-zinc-300">
              Date Range
            </h2>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-600 [color-scheme:dark]"
                placeholder="Start date"
              />
              <span className="text-xs text-zinc-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-zinc-600 [color-scheme:dark]"
                placeholder="End date"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">Preview</h2>
          {!loadingPreview && preview && (
            <span className="text-xs text-zinc-500">
              Showing {Math.min(5, totalRows)} of {totalRows.toLocaleString()}{" "}
              rows
            </span>
          )}
        </div>

        {loadingPreview ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-zinc-500" />
          </div>
        ) : preview && preview.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  {headers.map((h) => (
                    <th key={h} className="whitespace-nowrap pb-2 pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => {
                  const values = getRowValues(exportType, row)
                  return (
                    <tr
                      key={i}
                      className="border-b border-zinc-800/50 last:border-0"
                    >
                      {values.map((val, j) => (
                        <td
                          key={j}
                          className="whitespace-nowrap py-2 pr-4 text-zinc-400"
                          title={val}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500">
            No data available for the selected filters.
          </p>
        )}
      </div>

      {/* Download Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleDownload}
          disabled={downloading || !preview || preview.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {downloading ? "Downloading..." : `Download ${format.toUpperCase()}`}
        </button>
        {totalRows > 0 && (
          <span className="text-xs text-zinc-500">
            {totalRows.toLocaleString()} rows will be exported
          </span>
        )}
      </div>
    </div>
  )
}
