"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { truncate } from "@/lib/format"

// ---- Types ----

interface MatchInfo {
  messageIndex: number
  snippet: string
  role: "human" | "assistant" | "thinking"
}

interface SessionSearchResult {
  sessionId: string
  project: string
  firstPrompt: string
  matchCount: number
  matches: MatchInfo[]
}

interface SearchResponse {
  results: SessionSearchResult[]
  total: number
  query: string
}

// ---- Helpers ----

const ROLE_LABELS: Record<string, string> = {
  human: "Human",
  assistant: "Assistant",
  thinking: "Thinking",
}

const ROLE_COLORS: Record<string, string> = {
  human: "text-blue-400",
  assistant: "text-emerald-400",
  thinking: "text-zinc-500",
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
              className="rounded-sm bg-amber-500/25 px-0.5 font-semibold text-amber-300"
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

// ---- Loading skeleton ----

function SearchSkeleton() {
  return (
    <div className="space-y-3 max-w-4xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border-zinc-800 bg-zinc-900/50 py-0">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 bg-zinc-800" />
              <Skeleton className="h-5 w-10 bg-zinc-800" />
            </div>
            <Skeleton className="h-4 w-3/4 bg-zinc-800" />
            <div className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2.5">
              <Skeleton className="h-4 w-full bg-zinc-800" />
              <Skeleton className="mt-1.5 h-3 w-20 bg-zinc-800" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ---- Page ----

const PAGE_SIZE = 20

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SessionSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeQuery = useRef("")

  const fetchResults = useCallback(async (q: string, offset: number = 0) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setResults([])
      setTotal(0)
      setSearched(false)
      return
    }

    if (offset === 0) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setSearched(true)
    activeQuery.current = trimmed

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=${PAGE_SIZE}&offset=${offset}`
      )
      if (!res.ok) {
        if (offset === 0) {
          setResults([])
          setTotal(0)
        }
        return
      }
      const json: SearchResponse = await res.json()

      // Only apply if this is still the active query
      if (activeQuery.current !== trimmed) return

      if (offset === 0) {
        setResults(json.results)
      } else {
        setResults((prev) => [...prev, ...json.results])
      }
      setTotal(json.total)
    } catch {
      if (offset === 0) {
        setResults([])
        setTotal(0)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Debounce query changes — 300ms
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchResults(query)
    }, 300)

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

  const hasMore = results.length < total

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Search className="size-6 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Search
        </h1>
      </div>

      {/* Search Input */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-zinc-500" />
        <Input
          ref={inputRef}
          placeholder="Search across all session messages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 pl-11 text-base border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-zinc-700"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-zinc-500" />
        )}
      </div>

      {/* Results info */}
      {searched && !loading && total > 0 && (
        <p className="text-sm text-zinc-500">
          {total} session{total !== 1 ? "s" : ""} matched
        </p>
      )}

      {/* Loading skeleton */}
      {loading && <SearchSkeleton />}

      {/* No results */}
      {searched && !loading && total === 0 && (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-zinc-500">
            No results found for &ldquo;{query.trim()}&rdquo;
          </p>
        </div>
      )}

      {/* Empty state — no query yet */}
      {!searched && !loading && (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-zinc-500">
            Type to search across all session conversations
          </p>
        </div>
      )}

      {/* Results list */}
      {!loading && results.length > 0 && (
        <div className="space-y-3 max-w-4xl">
          {results.map((session) => (
            <Card
              key={session.sessionId}
              className="cursor-pointer border-zinc-800 bg-zinc-900/50 py-0 transition-colors hover:bg-zinc-800/50"
              onClick={() => router.push(`/sessions/${session.sessionId}`)}
            >
              <div className="px-5 py-4 space-y-3">
                {/* Session header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="secondary"
                    className="bg-zinc-800 text-zinc-300 text-[11px]"
                  >
                    {session.project}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-amber-700/50 bg-amber-950/30 text-amber-400 text-[10px]"
                  >
                    {session.matchCount} match{session.matchCount !== 1 ? "es" : ""}
                  </Badge>
                </div>

                {/* First prompt */}
                <p className="text-sm text-zinc-400 truncate">
                  {truncate(session.firstPrompt, 120)}
                </p>

                {/* Match snippets */}
                <div className="space-y-2">
                  {session.matches.map((match) => (
                    <div
                      key={match.messageIndex}
                      className="rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 space-y-1"
                    >
                      <p className="text-sm leading-relaxed text-zinc-300">
                        <SnippetText snippet={match.snippet} />
                      </p>
                      <p className={`text-[11px] ${ROLE_COLORS[match.role]}`}>
                        {ROLE_LABELS[match.role]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2 pb-4">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  fetchResults(query, results.length)
                }}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load more (${total - results.length} remaining)`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
