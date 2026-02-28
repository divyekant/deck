"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Hash,
  Search,
  Timer,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatCost } from "@/lib/claude/costs"
import { getProjectColor } from "@/lib/project-colors"

// ---- Types ----

type PromptCategory =
  | "bug-fix"
  | "feature"
  | "refactor"
  | "testing"
  | "review"
  | "exploration"
  | "general"

interface PromptEntry {
  text: string
  useCount: number
  projects: string[]
  models: string[]
  avgCost: number
  avgDuration: number
  totalCost: number
  lastUsed: string
  category: PromptCategory
}

// ---- Category Config ----

const CATEGORY_STYLES: Record<PromptCategory, { label: string; classes: string }> = {
  "bug-fix": { label: "Bug Fix", classes: "bg-red-950 text-red-400 border-red-800" },
  feature: { label: "Feature", classes: "bg-blue-950 text-blue-400 border-blue-800" },
  refactor: { label: "Refactor", classes: "bg-purple-950 text-purple-400 border-purple-800" },
  testing: { label: "Testing", classes: "bg-emerald-950 text-emerald-400 border-emerald-800" },
  review: { label: "Review", classes: "bg-amber-950 text-amber-400 border-amber-800" },
  exploration: { label: "Exploration", classes: "bg-cyan-950 text-cyan-400 border-cyan-800" },
  general: { label: "General", classes: "bg-zinc-800 text-zinc-400 border-zinc-700" },
}

const ALL_CATEGORIES = "__all__"

// ---- Helpers ----

function formatRelativeDate(dateStr: string): string {
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

// ---- Components ----

function PromptCard({ prompt }: { prompt: PromptEntry }) {
  const [expanded, setExpanded] = useState(false)
  const categoryStyle = CATEGORY_STYLES[prompt.category]

  const isLong = prompt.text.length > 200

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
      {/* Top row: category badge + last used */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${categoryStyle.classes}`}
        >
          {categoryStyle.label}
        </span>
        <span className="text-xs text-zinc-500 flex items-center gap-1">
          <Clock className="size-3" />
          {formatRelativeDate(prompt.lastUsed)}
        </span>
      </div>

      {/* Prompt text */}
      <div className="relative">
        <p
          className={`text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap break-words ${
            !expanded && isLong ? "line-clamp-3" : ""
          }`}
        >
          {prompt.text}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-1 flex items-center gap-0.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="size-3" /> Show more
              </>
            )}
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1" title="Times used">
          <Hash className="size-3" />
          {prompt.useCount} use{prompt.useCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1" title="Avg cost">
          <DollarSign className="size-3" />
          {formatCost(prompt.avgCost)} avg
        </span>
        <span className="flex items-center gap-1" title="Avg duration">
          <Timer className="size-3" />
          {formatDuration(prompt.avgDuration)}
        </span>
      </div>

      {/* Project badges */}
      {prompt.projects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {prompt.projects.map((project) => {
            const color = getProjectColor(project)
            return (
              <span
                key={project}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${color.bg} ${color.text} ${color.border}`}
              >
                <span className={`size-1.5 rounded-full ${color.dot}`} />
                {project}
              </span>
            )
          })}
        </div>
      )}

      {/* Model badges */}
      {prompt.models.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {prompt.models.map((model) => (
            <Badge
              key={model}
              variant="outline"
              className="border-zinc-700 text-[10px] text-zinc-500 rounded-full"
            >
              {model}
            </Badge>
          ))}
        </div>
      )}

      {/* View sessions link */}
      <div className="pt-1 border-t border-zinc-800">
        <Link
          href={`/sessions?q=${encodeURIComponent(prompt.text)}`}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View sessions &rarr;
        </Link>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-40 bg-zinc-800" />
        <Skeleton className="h-6 w-12 rounded-full bg-zinc-800" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-64 bg-zinc-800" />
        <Skeleton className="h-9 w-40 bg-zinc-800" />
        <Skeleton className="h-9 w-40 bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg bg-zinc-800" />
        ))}
      </div>
    </div>
  )
}

// ---- Page ----

export default function PromptsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <PromptsContent />
    </Suspense>
  )
}

function PromptsContent() {
  const [prompts, setPrompts] = useState<PromptEntry[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Controls
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES)
  const [sort, setSort] = useState<"recent" | "cost" | "used">("recent")

  // Fetch from API
  const fetchPrompts = useCallback(
    async (sortParam: string, categoryParam: string) => {
      try {
        const params = new URLSearchParams({ sort: sortParam })
        if (categoryParam && categoryParam !== ALL_CATEGORIES) {
          params.set("category", categoryParam)
        }
        const res = await fetch(`/api/prompts?${params.toString()}`)
        if (!res.ok) throw new Error("Failed to fetch prompts")
        const data = await res.json()
        setPrompts(data.prompts)
        setCategories(data.categories)
        setTotal(data.total)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Initial fetch and re-fetch on sort/category change
  useEffect(() => {
    setLoading(true)
    fetchPrompts(sort, selectedCategory)
  }, [sort, selectedCategory, fetchPrompts])

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search) return prompts
    const lower = search.toLowerCase()
    return prompts.filter((p) => p.text.toLowerCase().includes(lower))
  }, [prompts, search])

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Prompt Library
        </h1>
        {!loading && (
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {total}
          </Badge>
        )}
      </div>

      {/* Controls */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-500"
            />
          </div>

          {/* Category filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900 text-zinc-300">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
              {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
                <SelectItem key={key} value={key}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort selector */}
          <Select value={sort} onValueChange={(v) => setSort(v as "recent" | "cost" | "used")}>
            <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-900 text-zinc-300">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value="recent">Recent</SelectItem>
              <SelectItem value="cost">Lowest Cost</SelectItem>
              <SelectItem value="used">Most Used</SelectItem>
            </SelectContent>
          </Select>

          {/* Count */}
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {filtered.length} of {total} prompts
          </span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {search
              ? "No prompts match your search."
              : "No prompts found. Start some sessions to build your prompt library."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((prompt, idx) => (
            <PromptCard key={`${prompt.text.slice(0, 40)}-${idx}`} prompt={prompt} />
          ))}
        </div>
      )}
    </div>
  )
}
