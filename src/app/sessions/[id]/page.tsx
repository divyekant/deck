"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Play,
  Square,
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageView } from "@/components/message-view"
import { formatCost, formatTokens } from "@/lib/claude/costs"
import type { SessionDetail, UserMessage, AssistantMessage, ContentBlock } from "@/lib/claude/types"

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

interface StreamMessage {
  type: string
  message?: {
    id?: string
    model?: string
    role?: string
    content?: ContentBlock[] | string
    usage?: { input_tokens: number; output_tokens: number }
  }
  exitCode?: number
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Resume state
  const [showResume, setShowResume] = useState(false)
  const [resumePrompt, setResumePrompt] = useState("")
  const [resuming, setResuming] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamDone, setStreamDone] = useState(false)
  const [streamExitCode, setStreamExitCode] = useState<number | null>(null)
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([])
  const [resumeError, setResumeError] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  // Auto-scroll when new stream messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamMessages])

  // Focus textarea when resume panel opens
  useEffect(() => {
    if (showResume) {
      textareaRef.current?.focus()
    }
  }, [showResume])

  const handleResume = useCallback(async () => {
    if (!resumePrompt.trim() || !id) return

    setResuming(true)
    setResumeError(null)
    setStreamMessages([])
    setStreamDone(false)
    setStreamExitCode(null)

    try {
      const res = await fetch("/api/sessions/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id, prompt: resumePrompt.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to resume session")
      }

      const { sessionId: sid } = await res.json()
      setStreaming(true)
      setResuming(false)
      setShowResume(false)

      // Start SSE stream
      const abort = new AbortController()
      abortRef.current = abort

      const streamRes = await fetch(`/api/sessions/${sid}/stream`, {
        signal: abort.signal,
      })

      if (!streamRes.ok || !streamRes.body) {
        throw new Error("Failed to connect to stream")
      }

      const reader = streamRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      for (;;) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const parsed: StreamMessage = JSON.parse(jsonStr)

            if (parsed.type === "done") {
              setStreamDone(true)
              setStreaming(false)
              setStreamExitCode(parsed.exitCode ?? null)
              break
            }

            if (parsed.type === "user" || parsed.type === "assistant") {
              setStreamMessages((prev) => {
                if (parsed.type === "assistant" && parsed.message?.id) {
                  const existingIdx = prev.findIndex(
                    (m) => m.type === "assistant" && m.message?.id === parsed.message?.id
                  )
                  if (existingIdx >= 0) {
                    const updated = [...prev]
                    updated[existingIdx] = parsed
                    return updated
                  }
                }
                return [...prev, parsed]
              })
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }

      setStreaming(false)
      setStreamDone(true)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setResumeError(err instanceof Error ? err.message : "Something went wrong")
      setResuming(false)
      setStreaming(false)
    }
  }, [resumePrompt, id])

  const handleStopResume = useCallback(async () => {
    if (!id) return
    abortRef.current?.abort()
    try {
      await fetch(`/api/sessions/${id}/stop`, { method: "POST" })
    } catch {
      // Best effort
    }
    setStreaming(false)
    setStreamDone(true)
  }, [id])

  const handleResumeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleResume()
    }
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-zinc-800" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 bg-zinc-800" />
          <Skeleton className="h-6 w-32 bg-zinc-800" />
        </div>
        <Separator className="bg-zinc-800" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-20 w-full rounded-md bg-zinc-800"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Session not found.</p>
      </div>
    )
  }

  const { meta, messages } = session

  // Filter to user and assistant messages only, skip tool_result user messages
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

  const isResumeActive = streaming || resuming

  // Render stream messages from the resume
  const renderStreamMessages = () => {
    return streamMessages.map((msg, i) => {
      if (msg.type === "user") {
        const content =
          typeof msg.message?.content === "string"
            ? msg.message.content
            : Array.isArray(msg.message?.content)
              ? msg.message.content
                  .filter((b: ContentBlock) => b.type === "text")
                  .map((b: ContentBlock) => (b.type === "text" ? b.text : ""))
                  .join("\n")
              : ""

        return (
          <MessageView
            key={`resume-user-${i}`}
            type="user"
            content={content}
          />
        )
      }

      if (msg.type === "assistant") {
        return (
          <MessageView
            key={`resume-assistant-${msg.message?.id || i}`}
            type="assistant"
            content={msg.message?.content || []}
            model={msg.message?.model}
            usage={
              msg.message?.usage
                ? {
                    input_tokens: msg.message.usage.input_tokens,
                    output_tokens: msg.message.usage.output_tokens,
                  }
                : undefined
            }
          />
        )
      }

      return null
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header Bar */}
      <div className="shrink-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/sessions">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="size-4" />
              Sessions
            </Button>
          </Link>

          <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
            {meta.projectName}
          </Badge>
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-500 text-[10px]"
          >
            {meta.model}
          </Badge>

          <span className="text-sm text-zinc-500">
            {formatDuration(meta.duration)}
          </span>
          <span className="text-sm font-medium text-zinc-300">
            {formatCost(meta.estimatedCost)}
          </span>
          <span className="font-mono text-xs text-zinc-500">
            in: {formatTokens(meta.totalInputTokens)} / out:{" "}
            {formatTokens(meta.totalOutputTokens)}
          </span>

          {/* Continue button */}
          {!isResumeActive && !showResume && (
            <Button
              size="sm"
              onClick={() => setShowResume(true)}
              className="ml-auto gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              <Play className="size-3.5" />
              Continue
            </Button>
          )}

          {/* Streaming indicator */}
          {streaming && (
            <div className="ml-auto flex items-center gap-2">
              <Badge className="bg-emerald-900 text-emerald-300 border-emerald-700">
                <Zap className="size-3 mr-1" />
                Live
              </Badge>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStopResume}
                className="gap-1"
              >
                <Square className="size-3" />
                Stop
              </Button>
            </div>
          )}
        </div>

        <Separator className="bg-zinc-800" />
      </div>

      {/* Conversation */}
      <ScrollArea className="flex-1 mt-4">
        <div ref={scrollRef} className="space-y-1 pb-8">
          {conversationMessages.map((msg) => {
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
                <MessageView
                  key={msg.uuid}
                  type="user"
                  content={content}
                  timestamp={msg.timestamp}
                />
              )
            }

            if (msg.type === "assistant") {
              const assistantMsg = msg as AssistantMessage
              return (
                <MessageView
                  key={msg.uuid}
                  type="assistant"
                  content={assistantMsg.message.content}
                  model={assistantMsg.message.model}
                  timestamp={msg.timestamp}
                  usage={{
                    input_tokens: assistantMsg.message.usage.input_tokens,
                    output_tokens: assistantMsg.message.usage.output_tokens,
                  }}
                />
              )
            }

            return null
          })}

          {/* Resumed session stream output */}
          {(streamMessages.length > 0 || streaming) && (
            <>
              <Separator className="bg-zinc-800 my-4" />
              <div className="flex items-center gap-2 py-2">
                <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px]">
                  Resumed
                </Badge>
              </div>
              {renderStreamMessages()}

              {streaming && streamMessages.length === 0 && (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="size-4 animate-spin text-zinc-500" />
                  <span className="text-sm text-zinc-500">Waiting for output...</span>
                </div>
              )}

              {streamDone && (
                <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {streamExitCode === 0 || streamExitCode === null ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : (
                      <XCircle className="size-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium text-zinc-300">
                      Resume complete
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Resume prompt panel */}
      {showResume && !streaming && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={resumePrompt}
                onChange={(e) => setResumePrompt(e.target.value)}
                onKeyDown={handleResumeKeyDown}
                disabled={resuming}
                placeholder="Follow-up prompt..."
                rows={3}
                className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
              />
              <p className="mt-1 text-[10px] text-zinc-600">
                {typeof navigator !== "undefined" && navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to send
              </p>
            </div>
            <div className="flex flex-col gap-2 pb-6">
              <Button
                onClick={handleResume}
                disabled={!resumePrompt.trim() || resuming}
                size="sm"
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
              >
                {resuming ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Send
              </Button>
              <Button
                onClick={() => {
                  setShowResume(false)
                  setResumePrompt("")
                }}
                disabled={resuming}
                variant="ghost"
                size="sm"
                className="text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </Button>
            </div>
          </div>
          {resumeError && (
            <div className="mt-2 rounded-md border border-red-900 bg-red-950/50 px-3 py-2">
              <p className="text-xs text-red-400">{resumeError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
