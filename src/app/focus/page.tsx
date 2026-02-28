"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { Loader2, ExternalLink, User, Bot, ChevronRight } from "lucide-react"
import { formatCost, formatTokens } from "@/lib/claude/costs"
import type {
  SessionDetail,
  SessionMeta,
  UserMessage,
  AssistantMessage,
  ContentBlock,
} from "@/lib/claude/types"
import { cn } from "@/lib/utils"

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str
  return str.slice(0, len) + "..."
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="my-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform", open && "rotate-90")}
        />
        Thinking...
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="whitespace-pre-wrap text-base italic text-zinc-500 leading-relaxed">
            {text}
          </p>
        </div>
      )}
    </div>
  )
}

function renderContent(content: string | ContentBlock[]) {
  if (typeof content === "string") {
    return (
      <p className="whitespace-pre-wrap text-base text-zinc-200 leading-relaxed">
        {content}
      </p>
    )
  }

  if (!Array.isArray(content)) {
    return (
      <p className="whitespace-pre-wrap text-base text-zinc-200 leading-relaxed">
        {String(content)}
      </p>
    )
  }

  return content.map((block: ContentBlock, i: number) => {
    if (block.type === "text") {
      return (
        <p
          key={i}
          className="whitespace-pre-wrap text-base text-zinc-200 leading-relaxed"
        >
          {block.text}
        </p>
      )
    }

    if (block.type === "thinking") {
      return <ThinkingBlock key={i} text={block.thinking || ""} />
    }

    if (block.type === "tool_use") {
      return (
        <div
          key={i}
          className="my-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-2"
        >
          <span className="font-mono text-sm text-zinc-500">
            {block.name}()
          </span>
        </div>
      )
    }

    if (block.type === "tool_result") {
      return null // Skip tool results in focus mode for cleanliness
    }

    return null
  })
}

function FocusMessage({
  type,
  content,
}: {
  type: "user" | "assistant"
  content: string | ContentBlock[]
}) {
  const isUser = type === "user"

  return (
    <div className={cn("flex gap-4 py-6", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 mt-1">
          <Bot className="size-4 text-zinc-400" />
        </div>
      )}
      <div className={cn("max-w-[80%] space-y-3", isUser ? "items-end" : "items-start")}>
        {isUser ? (
          <div className="rounded-xl bg-zinc-800/80 px-5 py-3">
            <p className="whitespace-pre-wrap text-base text-zinc-100 leading-relaxed">
              {String(content)}
            </p>
          </div>
        ) : (
          <div className="space-y-3">{renderContent(content)}</div>
        )}
      </div>
      {isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80 mt-1">
          <User className="size-4 text-zinc-400" />
        </div>
      )}
    </div>
  )
}

export default function FocusPage() {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLatestSession = useCallback(async () => {
    try {
      // Step 1: Get most recent session ID
      const listRes = await fetch("/api/sessions?limit=1")
      if (!listRes.ok) throw new Error("Failed to fetch sessions")
      const listData = await listRes.json()

      if (!listData.sessions || listData.sessions.length === 0) {
        setSession(null)
        setLoading(false)
        return
      }

      const latestMeta: SessionMeta = listData.sessions[0]
      setSessionId(latestMeta.id)

      // Step 2: Fetch full session detail
      const detailRes = await fetch(`/api/sessions/${latestMeta.id}`)
      if (!detailRes.ok) throw new Error("Failed to fetch session detail")
      const detailData: SessionDetail = await detailRes.json()

      setSession(detailData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchLatestSession()
  }, [fetchLatestSession])

  // Auto-refresh if session appears to be running (endTime within last 5 minutes)
  useEffect(() => {
    if (!session) return

    const endTime = new Date(session.meta.endTime).getTime()
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const isLikelyRunning = endTime > fiveMinutesAgo

    if (isLikelyRunning) {
      refreshTimerRef.current = setInterval(() => {
        fetchLatestSession()
      }, 15_000)
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [session, fetchLatestSession])

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  // No sessions
  if (!session) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-zinc-950">
        <p className="text-base text-zinc-500">No sessions yet</p>
        <p className="text-sm text-zinc-600">
          Start a Claude Code session and it will appear here.
        </p>
      </div>
    )
  }

  const { meta, messages } = session

  // Filter to user and assistant messages only, skip tool_result-only user messages
  const conversationMessages = messages.filter((msg) => {
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

  const title = truncate(meta.firstPrompt || "Untitled Session", 80)
  const totalTokens = meta.totalInputTokens + meta.totalOutputTokens

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950">
      {/* Top Bar */}
      <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-950 px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-medium text-zinc-200">
              {title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3 text-sm text-zinc-500">
            <span>{formatDuration(meta.duration)}</span>
            <span className="text-zinc-700">|</span>
            <span className="font-medium text-zinc-300">
              {formatCost(meta.estimatedCost)}
            </span>
            <span className="text-zinc-700">|</span>
            <span className="font-mono text-xs">{formatTokens(totalTokens)} tokens</span>
          </div>

          {sessionId && (
            <Link
              href={`/sessions/${sessionId}`}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            >
              Exit Focus
              <ExternalLink className="size-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <div className="divide-y divide-zinc-800/40">
            {conversationMessages.map((msg) => {
              if (msg.type === "user") {
                const userMsg = msg as UserMessage
                const content =
                  typeof userMsg.message.content === "string"
                    ? userMsg.message.content
                    : userMsg.message.content
                        .filter(
                          (b: ContentBlock) => b.type === "text"
                        )
                        .map((b: ContentBlock) =>
                          b.type === "text" ? b.text : ""
                        )
                        .join("\n")

                return (
                  <FocusMessage key={msg.uuid} type="user" content={content} />
                )
              }

              if (msg.type === "assistant") {
                const assistantMsg = msg as AssistantMessage
                return (
                  <FocusMessage
                    key={msg.uuid}
                    type="assistant"
                    content={assistantMsg.message.content}
                  />
                )
              }

              return null
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
