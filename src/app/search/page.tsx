"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface SearchResult {
  sessionId: string
  projectName: string
  model: string
  startTime: string
  firstPrompt: string
  matchType: "user" | "assistant" | "thinking"
  snippet: string
  matchIndex: number
}

interface SearchResponse {
  results: SearchResult[]
  query: string
  total: number
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

const MATCH_TYPE_LABELS: Record<string, string> = {
  user: "in user message",
  assistant: "in assistant response",
  thinking: "in thinking",
}

/**
 * Render snippet text, converting **bold** markers into highlighted spans.
 */
function SnippetText({ snippet }: { snippet: string }) {
  const parts = snippet.split(/(\*\*.*?\*\*)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <mark
              key={i}
              className="rounded-sm bg-yellow-500/20 px-0.5 font-semibold text-yellow-300"
            >
              {part.slice(2, -2)}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

/**
 * Group consecutive results from the same session together.
 */
function groupResults(results: SearchResult[]): { sessionId: string; items: SearchResult[] }[] {
  const groups: { sessionId: string; items: SearchResult[] }[] = []

  for (const result of results) {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.sessionId === result.sessionId) {
      lastGroup.items.push(result)
    } else {
      groups.push({ sessionId: result.sessionId, items: [result] })
    }
  }

  return groups
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [data, setData] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim()) {
      setData(null)
      setSearched(false)
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      if (!res.ok) {
        setData(null)
        return
      }
      const json: SearchResponse = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce query changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchResults(query)
    }, 400)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, fetchResults])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const groups = data ? groupResults(data.results) : []
  const sessionCount = groups.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
        Search
      </h1>

      {/* Search Input */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-500" />
        <Input
          ref={inputRef}
          placeholder="Search across all session messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pl-11 text-base border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-500"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-zinc-500" />
        )}
      </div>

      {/* Results info */}
      {searched && !loading && data && (
        <p className="text-sm text-zinc-500">
          Found {data.total} match{data.total !== 1 ? "es" : ""} across{" "}
          {sessionCount} session{sessionCount !== 1 ? "s" : ""}
        </p>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-zinc-500" />
        </div>
      )}

      {/* No results */}
      {searched && !loading && data && data.total === 0 && (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-zinc-500">
            No results found for &ldquo;{data.query}&rdquo;
          </p>
        </div>
      )}

      {/* Results list */}
      {!loading && data && data.total > 0 && (
        <div className="space-y-3 max-w-4xl">
          {groups.map((group) => {
            const first = group.items[0]
            return (
              <Card
                key={`${group.sessionId}-${first.matchIndex}`}
                className="cursor-pointer border-zinc-800 bg-zinc-900/50 py-0 transition-colors hover:bg-zinc-800/50"
                onClick={() => router.push(`/sessions/${group.sessionId}`)}
              >
                <div className="px-5 py-4 space-y-3">
                  {/* Session header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-300 text-[11px]"
                    >
                      {first.projectName}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-zinc-700 text-[10px] text-zinc-500"
                    >
                      {first.model}
                    </Badge>
                    <span className="text-xs text-zinc-500 ml-auto">
                      {formatDate(first.startTime)}
                    </span>
                  </div>

                  {/* First prompt */}
                  <p className="text-sm text-zinc-500 truncate">
                    {truncate(first.firstPrompt, 120)}
                  </p>

                  {/* Match snippets */}
                  {group.items.map((result) => (
                    <div
                      key={result.matchIndex}
                      className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 space-y-1"
                    >
                      <p className="text-sm leading-relaxed text-zinc-300">
                        <SnippetText snippet={result.snippet} />
                      </p>
                      <p className="text-[11px] text-zinc-600">
                        {MATCH_TYPE_LABELS[result.matchType]}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
