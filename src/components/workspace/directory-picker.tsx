"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Folder, Clock } from "lucide-react"

const STORAGE_KEY = "deck-recent-directories"
const MAX_RECENT = 10

interface DirectoryPickerProps {
  value: string
  onChange: (path: string) => void
}

export function DirectoryPicker({ value, onChange }: DirectoryPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [directories, setDirectories] = useState<{ name: string; path: string }[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync query with value prop
  useEffect(() => { setQuery(value) }, [value])

  // Load recent directories from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setRecent(JSON.parse(stored))
    } catch {}
  }, [])

  // Save a directory to recent list
  const saveRecent = useCallback((path: string) => {
    setRecent((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, MAX_RECENT)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Browse directories when query changes
  useEffect(() => {
    if (!open || !query) return
    const controller = new AbortController()
    setLoading(true)

    fetch(`/api/filesystem/browse?path=${encodeURIComponent(query)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.directories) setDirectories(data.directories)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    return () => controller.abort()
  }, [query, open])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const select = (path: string) => {
    setQuery(path)
    onChange(path)
    saveRecent(path)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="~/Projects/my-project"
          className="h-8 text-sm"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-lg">
          <ScrollArea className="max-h-60">
            {/* Recent directories */}
            {recent.length > 0 && (
              <div className="p-1">
                <span className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Recent
                </span>
                {recent.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => select(dir)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
                  >
                    <Clock className="size-3 text-muted-foreground" />
                    <span className="truncate">{dir}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Browsed directories */}
            {directories.length > 0 && (
              <div className="p-1">
                <span className="px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Browse
                </span>
                {directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => select(dir.path)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent"
                  >
                    <Folder className="size-3 text-muted-foreground" />
                    <span className="truncate">{dir.name}</span>
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
