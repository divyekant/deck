"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  DollarSign,
  Cpu,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageView } from "@/components/message-view"
import { ReplayFilesPanel } from "@/components/replay-files-panel"
import { formatCost, formatTokens, calculateCost } from "@/lib/claude/costs"
import type {
  SessionDetail,
  UserMessage,
  AssistantMessage,
  ContentBlock,
  TokenUsage,
} from "@/lib/claude/types"

type Speed = 1 | 2 | 5
const SPEEDS: Speed[] = [1, 2, 5]

export default function SessionReplayPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(2)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrubberRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  // Fetch session
  useEffect(() => {
    if (!id) return
    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/${id}`)
        if (!res.ok) throw new Error("Failed to fetch session")
        const data = await res.json()
        setSession(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    fetchSession()
  }, [id])

  // Filter conversation messages
  const convMessages = useMemo(() => {
    if (!session) return []
    return session.messages.filter((msg) => {
      if (msg.type === "user") {
        const userMsg = msg as UserMessage
        if (Array.isArray(userMsg.message.content)) {
          const hasOnlyToolResults = userMsg.message.content.every(
            (block: ContentBlock) => block.type === "tool_result"
          )
          if (hasOnlyToolResults) return false
        }
        return true
      }
      if (msg.type === "assistant") return true
      return false
    })
  }, [session])

  const total = convMessages.length
  const atEnd = currentIndex >= total - 1

  // Auto-play logic
  useEffect(() => {
    if (playing && !atEnd) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1
          if (next >= total - 1) {
            setPlaying(false)
          }
          return Math.min(next, total - 1)
        })
      }, speed * 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [playing, speed, atEnd, total])

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentIndex])

  // Handlers
  const handleBack = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleForward = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, total - 1))
  }, [total])

  const handlePlayPause = useCallback(() => {
    if (atEnd) {
      // Restart from beginning
      setCurrentIndex(0)
      setPlaying(true)
    } else {
      setPlaying((prev) => !prev)
    }
  }, [atEnd])

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (total === 0) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = x / rect.width
      const idx = Math.round(pct * (total - 1))
      setCurrentIndex(Math.max(0, Math.min(idx, total - 1)))
      setPlaying(false)
    },
    [total]
  )

  // Running stats: accumulate cost and tokens from messages 0..currentIndex
  const runningStats = useMemo(() => {
    let cost = 0
    let inputTokens = 0
    let outputTokens = 0

    for (let i = 0; i <= currentIndex && i < convMessages.length; i++) {
      const msg = convMessages[i]
      if (msg.type === "assistant") {
        const aMsg = msg as AssistantMessage
        const usage = aMsg.message.usage
        if (usage) {
          inputTokens += usage.input_tokens || 0
          outputTokens += usage.output_tokens || 0
          cost += calculateCost(aMsg.message.model, {
            input_tokens: usage.input_tokens || 0,
            output_tokens: usage.output_tokens || 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
            cache_read_input_tokens: usage.cache_read_input_tokens || 0,
          } as TokenUsage)
        }
      }
    }

    return { cost, inputTokens, outputTokens }
  }, [convMessages, currentIndex])

  // Session title: first prompt truncated
  const sessionTitle = useMemo(() => {
    if (!session) return ""
    const fp = session.meta.firstPrompt || ""
    return fp.length > 80 ? fp.slice(0, 80) + "..." : fp
  }, [session])

  // Progress percentage
  const progressPct = total > 1 ? ((currentIndex) / (total - 1)) * 100 : 100

  // Timeline scrubber: classify each message for marker coloring
  const messageMarkers = useMemo(() => {
    return convMessages.map((msg) => {
      if (msg.type === "user") return "user" as const
      if (msg.type === "assistant") {
        const aMsg = msg as AssistantMessage
        const hasToolUse = Array.isArray(aMsg.message.content) &&
          aMsg.message.content.some((block: ContentBlock) => block.type === "tool_use")
        return hasToolUse ? ("tool" as const) : ("assistant" as const)
      }
      return "assistant" as const
    })
  }, [convMessages])

  // Scrubber: compute index from mouse position on the bar
  const scrubberIndexFromEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!scrubberRef.current || total === 0) return 0
      const rect = scrubberRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const pct = x / rect.width
      return Math.max(0, Math.min(Math.round(pct * (total - 1)), total - 1))
    },
    [total]
  )

  // Scrubber drag handlers
  const handleScrubberMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setDragging(true)
      const idx = scrubberIndexFromEvent(e)
      setCurrentIndex(idx)
      setPlaying(false)
    },
    [scrubberIndexFromEvent]
  )

  useEffect(() => {
    if (!dragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const idx = scrubberIndexFromEvent(e)
      setCurrentIndex(idx)
    }
    const handleMouseUp = () => {
      setDragging(false)
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [dragging, scrubberIndexFromEvent])

  // Scrubber keyboard navigation
  const handleScrubberKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setCurrentIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setCurrentIndex((prev) => Math.min(prev + 1, total - 1))
      }
    },
    [total]
  )

  // ---- Render ----

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md bg-zinc-800" />
          ))}
        </div>
      </div>
    )
  }

  if (!session || total === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-zinc-500">No messages to replay.</p>
        <Link href={`/sessions/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1 text-zinc-400 hover:text-zinc-200">
            <ArrowLeft className="size-4" />
            Back to session
          </Button>
        </Link>
      </div>
    )
  }

  // Visible messages: 0 through currentIndex
  const visibleMessages = convMessages.slice(0, currentIndex + 1)

  return (
    <div className="flex h-full flex-col pb-20">
      {/* Header */}
      <div className="shrink-0 space-y-2 mb-4">
        <div className="flex items-center gap-3">
          <Link href={`/sessions/${id}`}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="size-4" />
              Session
            </Button>
          </Link>
          <span className="text-sm text-zinc-400 truncate max-w-lg" title={session.meta.firstPrompt}>
            {sessionTitle}
          </span>
        </div>
      </div>

      {/* Timeline scrubber bar */}
      <div className="shrink-0 mb-3">
        <div className="flex items-center gap-3">
          {/* Scrubber track */}
          <div
            ref={scrubberRef}
            tabIndex={0}
            role="slider"
            aria-label="Timeline scrubber"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={currentIndex + 1}
            className="relative flex-1 h-[6px] rounded-full bg-zinc-800 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-1 focus:ring-offset-zinc-950"
            onMouseDown={handleScrubberMouseDown}
            onKeyDown={handleScrubberKeyDown}
          >
            {/* Filled portion */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 pointer-events-none"
              style={{ width: `${progressPct}%` }}
            />

            {/* Event markers */}
            {messageMarkers.map((kind, idx) => {
              const left = total > 1 ? (idx / (total - 1)) * 100 : 50
              const colorClass =
                kind === "user"
                  ? "bg-blue-400"
                  : kind === "tool"
                    ? "bg-amber-400"
                    : "bg-zinc-500"
              return (
                <div
                  key={idx}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-2 rounded-full ${colorClass} pointer-events-none ring-1 ring-zinc-900/60`}
                  style={{ left: `${left}%` }}
                />
              )
            })}

            {/* Playhead */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-full bg-white border-2 border-emerald-500 shadow-md pointer-events-none z-10"
              style={{ left: `${progressPct}%` }}
            />
          </div>

          {/* Progress text */}
          <span className="text-xs text-zinc-500 font-mono tabular-nums whitespace-nowrap">
            Message {currentIndex + 1} of {total}
          </span>
        </div>

        {/* Marker legend */}
        <div className="flex items-center gap-3 mt-1.5 ml-0.5">
          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
            <span className="inline-block size-1.5 rounded-full bg-blue-400" />
            User
          </span>
          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
            <span className="inline-block size-1.5 rounded-full bg-zinc-500" />
            Assistant
          </span>
          <span className="flex items-center gap-1 text-[10px] text-zinc-500">
            <span className="inline-block size-1.5 rounded-full bg-amber-400" />
            Tool use
          </span>
        </div>
      </div>

      {/* Message display area + Files panel */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto space-y-1">
          {visibleMessages.map((msg, idx) => {
            const isLatest = idx === currentIndex

            if (msg.type === "user") {
              const userMsg = msg as UserMessage
              const content =
                typeof userMsg.message.content === "string"
                  ? userMsg.message.content
                  : userMsg.message.content
                      .filter((b: ContentBlock) => b.type === "text")
                      .map((b: ContentBlock) => (b.type === "text" ? b.text : ""))
                      .join("\n")

              return (
                <div
                  key={msg.uuid}
                  className={
                    isLatest
                      ? "animate-in fade-in slide-in-from-bottom-2 duration-300"
                      : ""
                  }
                >
                  <MessageView
                    type="user"
                    content={content}
                    timestamp={msg.timestamp}
                    index={idx + 1}
                    total={total}
                  />
                </div>
              )
            }

            if (msg.type === "assistant") {
              const assistantMsg = msg as AssistantMessage
              return (
                <div
                  key={msg.uuid}
                  className={
                    isLatest
                      ? "animate-in fade-in slide-in-from-bottom-2 duration-300"
                      : ""
                  }
                >
                  <MessageView
                    type="assistant"
                    content={assistantMsg.message.content}
                    model={assistantMsg.message.model}
                    timestamp={msg.timestamp}
                    usage={{
                      input_tokens: assistantMsg.message.usage.input_tokens,
                      output_tokens: assistantMsg.message.usage.output_tokens,
                    }}
                    index={idx + 1}
                    total={total}
                  />
                </div>
              )
            }

            return null
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Files touched sidebar */}
        <ReplayFilesPanel messages={convMessages} currentIndex={currentIndex} />
      </div>

      {/* Controls bar — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-4">
          {/* Transport controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
              onClick={handleBack}
              disabled={currentIndex === 0}
            >
              <SkipBack className="size-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white"
              onClick={handlePlayPause}
            >
              {playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
              onClick={handleForward}
              disabled={atEnd}
            >
              <SkipForward className="size-4" />
            </Button>
          </div>

          {/* Speed selector */}
          <div className="flex items-center gap-1">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                  speed === s
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {s}s
              </button>
            ))}
          </div>

          {/* Progress bar */}
          <div
            className="flex-1 h-2 rounded-full bg-zinc-800 cursor-pointer relative group"
            onClick={handleProgressClick}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
            {/* Hover tooltip */}
            <div
              className="absolute -top-7 text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${progressPct}%`, transform: "translateX(-50%)" }}
            >
              {currentIndex + 1}/{total}
            </div>
          </div>

          {/* Position indicator */}
          <span className="text-xs text-zinc-500 font-mono tabular-nums min-w-[4rem] text-right">
            {currentIndex + 1} / {total}
          </span>

          {/* Running stats */}
          <div className="flex items-center gap-3 border-l border-zinc-800 pl-3">
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <DollarSign className="size-3" />
              {formatCost(runningStats.cost)}
            </span>
            <span className="flex items-center gap-1 text-xs text-zinc-400 font-mono">
              <Cpu className="size-3" />
              {formatTokens(runningStats.inputTokens + runningStats.outputTokens)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
