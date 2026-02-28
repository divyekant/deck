"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, ClipboardCopy, Search, Terminal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getProjectColor } from "@/lib/project-colors"
import { formatRelativeDate } from "@/lib/format"

// ---- Types ----

interface CommandEntry {
  command: string
  output: string
  sessionId: string
  project: string
  timestamp: string
  messageIndex: number
}

// ---- Components ----

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may fail in some contexts
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
      title="Copy command"
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" />
      ) : (
        <ClipboardCopy className="size-3.5" />
      )}
    </button>
  )
}

function CommandCard({ entry }: { entry: CommandEntry }) {
  const projectColor = getProjectColor(entry.project)

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3">
      {/* Command */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-emerald-500 font-mono text-xs select-none">$</span>
            <pre className="flex-1 overflow-x-auto rounded bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-200 whitespace-pre-wrap break-all leading-relaxed">
              {entry.command}
            </pre>
            <CopyButton text={entry.command} />
          </div>
        </div>
      </div>

      {/* Output preview */}
      {entry.output && (
        <pre className="overflow-x-auto rounded bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-500 whitespace-pre-wrap break-all leading-relaxed border border-zinc-800/50">
          {entry.output}
        </pre>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <Link
          href={`/sessions/${entry.sessionId}`}
          className="hover:text-zinc-300 transition-colors underline-offset-2 hover:underline"
        >
          Session
        </Link>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${projectColor.bg} ${projectColor.text} ${projectColor.border}`}
        >
          <span className={`size-1.5 rounded-full ${projectColor.dot}`} />
          {entry.project}
        </span>
        <span className="ml-auto">
          {formatRelativeDate(entry.timestamp)}
        </span>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-52 bg-zinc-800" />
        <Skeleton className="h-6 w-12 rounded-full bg-zinc-800" />
      </div>
      <Skeleton className="h-9 w-full max-w-sm bg-zinc-800" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg bg-zinc-800" />
        ))}
      </div>
    </div>
  )
}

// ---- Page ----

export default function CommandsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <CommandsContent />
    </Suspense>
  )
}

function CommandsContent() {
  const [commands, setCommands] = useState<CommandEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Pagination
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 100

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset on search change
  useEffect(() => {
    setCommands([])
    setOffset(0)
    setLoading(true)
  }, [debouncedSearch])

  // Fetch commands
  const fetchCommands = useCallback(
    async (currentOffset: number, append: boolean) => {
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(currentOffset),
        })
        if (debouncedSearch) {
          params.set("q", debouncedSearch)
        }
        const res = await fetch(`/api/commands?${params.toString()}`)
        if (!res.ok) throw new Error("Failed to fetch commands")
        const data = await res.json()

        if (append) {
          setCommands((prev) => [...prev, ...data.commands])
        } else {
          setCommands(data.commands)
        }
        setTotal(data.total)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [debouncedSearch]
  )

  // Initial fetch and search-triggered fetch
  useEffect(() => {
    fetchCommands(0, false)
  }, [fetchCommands])

  // Load more handler
  const handleLoadMore = useCallback(() => {
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    setLoadingMore(true)
    fetchCommands(nextOffset, true)
  }, [offset, fetchCommands])

  const hasMore = commands.length < total

  // Client-side secondary filter for instant feedback while debounce settles
  const displayed = useMemo(() => {
    if (!search || search === debouncedSearch) return commands
    const lower = search.toLowerCase()
    return commands.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(lower) ||
        cmd.output.toLowerCase().includes(lower) ||
        cmd.project.toLowerCase().includes(lower)
    )
  }, [commands, search, debouncedSearch])

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
        <Terminal className="size-6 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Command History
        </h1>
        {!loading && (
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {total}
          </Badge>
        )}
      </div>

      {/* Search */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search commands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 border-zinc-800 bg-zinc-900 text-zinc-200 placeholder:text-zinc-500"
            />
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {displayed.length} of {total} commands
          </span>
        </div>
      )}

      {/* Command list */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2">
          <Terminal className="size-8 text-zinc-700" />
          <p className="text-sm text-muted-foreground">
            {search
              ? "No commands match your search."
              : "No commands found. Terminal commands from your Claude Code sessions will appear here."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayed.map((cmd, idx) => (
              <CommandCard
                key={`${cmd.sessionId}-${cmd.messageIndex}-${idx}`}
                entry={cmd}
              />
            ))}
          </div>

          {/* Load more */}
          {hasMore && !loadingMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
              >
                Load more
              </button>
            </div>
          )}
          {loadingMore && (
            <div className="flex justify-center pt-2">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <div className="size-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
                Loading...
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
