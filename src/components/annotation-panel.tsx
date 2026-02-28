"use client"

import { useEffect, useState, useCallback } from "react"
import { ChevronDown, ChevronRight, X, Plus, Trash2 } from "lucide-react"

// ---- Types ----

interface Note {
  id: string
  text: string
  createdAt: string
}

interface SessionAnnotation {
  notes: Note[]
  tags: string[]
}

// ---- Tag colors (matching session detail page) ----

const TAG_COLORS: Record<string, string> = {
  "bug-fix": "bg-red-950 text-red-400 border-red-800",
  feature: "bg-blue-950 text-blue-400 border-blue-800",
  refactor: "bg-purple-950 text-purple-400 border-purple-800",
  exploration: "bg-amber-950 text-amber-400 border-amber-800",
  review: "bg-emerald-950 text-emerald-400 border-emerald-800",
}

function getTagClasses(tag: string): string {
  return TAG_COLORS[tag] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"
}

// ---- Helpers ----

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  })
}

// ---- Component ----

interface AnnotationPanelProps {
  sessionId: string
}

export function AnnotationPanel({ sessionId }: AnnotationPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [annotation, setAnnotation] = useState<SessionAnnotation>({ notes: [], tags: [] })
  const [noteInput, setNoteInput] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [loading, setLoading] = useState(false)

  // Fetch annotations on mount
  useEffect(() => {
    if (!sessionId) return
    let active = true

    async function fetchAnnotation() {
      setLoading(true)
      try {
        const res = await fetch(`/api/annotations?sessionId=${encodeURIComponent(sessionId)}`)
        if (!res.ok) return
        const data: SessionAnnotation = await res.json()
        if (active) {
          setAnnotation(data)
        }
      } catch {
        // Non-critical
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchAnnotation()
    return () => { active = false }
  }, [sessionId])

  // ---- Note actions ----

  const handleAddNote = useCallback(async () => {
    const text = noteInput.trim()
    if (!text) return

    setNoteInput("")

    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "addNote", text }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.note) {
        setAnnotation((prev) => ({
          ...prev,
          notes: [...prev.notes, data.note],
        }))
      }
    } catch {
      // Restore input on failure
      setNoteInput(text)
    }
  }, [sessionId, noteInput])

  const handleRemoveNote = useCallback(async (noteId: string) => {
    // Optimistic update
    setAnnotation((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== noteId),
    }))

    try {
      await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "removeNote", noteId }),
      })
    } catch {
      // Refetch on failure
      try {
        const res = await fetch(`/api/annotations?sessionId=${encodeURIComponent(sessionId)}`)
        if (res.ok) {
          const data = await res.json()
          setAnnotation(data)
        }
      } catch {
        // Give up
      }
    }
  }, [sessionId])

  // ---- Tag actions ----

  const handleAddTag = useCallback(async (tag: string) => {
    const normalized = tag.trim().toLowerCase()
    if (!normalized) return
    if (annotation.tags.includes(normalized)) return

    setTagInput("")

    // Optimistic update
    setAnnotation((prev) => ({
      ...prev,
      tags: [...prev.tags, normalized],
    }))

    try {
      await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "addTag", tag: normalized }),
      })
    } catch {
      // Revert on failure
      setAnnotation((prev) => ({
        ...prev,
        tags: prev.tags.filter((t) => t !== normalized),
      }))
    }
  }, [sessionId, annotation.tags])

  const handleRemoveTag = useCallback(async (tag: string) => {
    // Optimistic update
    setAnnotation((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }))

    try {
      await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "removeTag", tag }),
      })
    } catch {
      // Revert on failure
      setAnnotation((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }))
    }
  }, [sessionId])

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddNote()
    }
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag(tagInput)
    }
  }

  const noteCount = annotation.notes.length
  const tagCount = annotation.tags.length
  const totalCount = noteCount + tagCount

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50">
      {/* Accordion header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        Annotations
        {totalCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            {totalCount}
          </span>
        )}
      </button>

      {/* Accordion content */}
      {expanded && (
        <div className="space-y-4 border-t border-zinc-800 px-4 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="size-3 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-400" />
              <span className="text-xs text-zinc-500">Loading...</span>
            </div>
          ) : (
            <>
              {/* ---- Notes section ---- */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Notes
                </p>

                {/* Existing notes */}
                {annotation.notes.length > 0 ? (
                  <div className="space-y-1.5">
                    {annotation.notes.map((note) => (
                      <div
                        key={note.id}
                        className="group flex items-start gap-2 rounded-md border border-zinc-800/50 bg-zinc-900/50 px-3 py-2"
                      >
                        <p className="flex-1 text-sm text-zinc-300 whitespace-pre-wrap break-words">
                          {note.text}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-[10px] text-zinc-600">
                            {formatTimestamp(note.createdAt)}
                          </span>
                          <button
                            onClick={() => handleRemoveNote(note.id)}
                            className="rounded p-0.5 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                            title="Delete note"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600 italic">No notes yet.</p>
                )}

                {/* Add note input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={handleNoteKeyDown}
                    placeholder="Add a note..."
                    className="h-8 flex-1 rounded-md border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteInput.trim()}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="size-3" />
                    Add Note
                  </button>
                </div>
              </div>

              {/* ---- Tags section ---- */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Tags
                </p>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Existing tags as removable badges */}
                  {annotation.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium border ${getTagClasses(tag)}`}
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-0.5 rounded-sm hover:opacity-70"
                        title={`Remove ${tag}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}

                  {/* Tag input */}
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Add tag..."
                    className="h-6 w-24 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                  />
                </div>

                {annotation.tags.length === 0 && (
                  <p className="text-xs text-zinc-600 italic">No tags yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
