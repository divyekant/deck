"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bookmark as BookmarkIcon, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelativeDate } from "@/lib/format"

interface Bookmark {
  id: string
  sessionId: string
  messageIndex: number
  messagePreview: string
  project: string
  createdAt: string
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [removing, setRemoving] = useState<Set<string>>(new Set())

  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch("/api/bookmarks")
      if (!res.ok) throw new Error("Failed to fetch bookmarks")
      const data = await res.json()
      setBookmarks(data.bookmarks)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  const handleRemove = useCallback(async (id: string) => {
    setRemoving((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setBookmarks((prev) => prev.filter((b) => b.id !== id))
      }
    } catch {
      // Fail silently
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return bookmarks
    const query = search.toLowerCase()
    return bookmarks.filter(
      (b) =>
        b.messagePreview.toLowerCase().includes(query) ||
        b.project.toLowerCase().includes(query)
    )
  }, [bookmarks, search])

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
        <BookmarkIcon className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Bookmarks
        </h1>
        {!loading && bookmarks.length > 0 && (
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {bookmarks.length}
          </Badge>
        )}
      </div>

      {/* Search */}
      {!loading && bookmarks.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            placeholder="Search bookmarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-zinc-800 bg-zinc-900 pl-9 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-zinc-700 focus-visible:ring-zinc-700/50"
          />
        </div>
      )}

      {/* Bookmark list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : filtered.length === 0 && search.trim() ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Search className="size-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No bookmarks matching &ldquo;{search}&rdquo;
          </p>
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <BookmarkIcon className="size-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            No bookmarks yet. Bookmark messages from session detail pages.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((bookmark) => {
            const isRemoving = removing.has(bookmark.id)
            const preview =
              bookmark.messagePreview.length > 120
                ? bookmark.messagePreview.slice(0, 120) + "..."
                : bookmark.messagePreview

            return (
              <div
                key={bookmark.id}
                className={`group rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-opacity ${
                  isRemoving ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <BookmarkIcon className="size-4 mt-1 shrink-0 text-zinc-600" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/sessions/${bookmark.sessionId}`}
                        className="text-sm font-medium text-zinc-100 hover:text-white transition-colors"
                      >
                        Message #{bookmark.messageIndex}
                      </Link>
                      <Badge
                        variant="secondary"
                        className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0"
                      >
                        {bookmark.project}
                      </Badge>
                      <span className="text-xs text-zinc-600">
                        {formatRelativeDate(bookmark.createdAt)}
                      </span>
                    </div>

                    <Link
                      href={`/sessions/${bookmark.sessionId}`}
                      className="mt-1.5 block text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                    >
                      {preview}
                    </Link>
                  </div>

                  <button
                    onClick={() => handleRemove(bookmark.id)}
                    disabled={isRemoving}
                    className="shrink-0 rounded-md p-1 text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-zinc-400 hover:bg-zinc-800 transition-all disabled:opacity-50"
                    title="Remove bookmark"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
