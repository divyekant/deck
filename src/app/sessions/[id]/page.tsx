"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { MessageView } from "@/components/message-view"
import { formatCost, formatTokens } from "@/lib/claude/costs"
import type { SessionDetail, UserMessage, AssistantMessage } from "@/lib/claude/types"

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      // Skip if content is an array containing tool_result blocks
      if (Array.isArray(userMsg.message.content)) {
        const hasOnlyToolResults = userMsg.message.content.every(
          (block: any) => block.type === "tool_result"
        )
        if (hasOnlyToolResults) return false
      }
      return true
    }
    if (msg.type === "assistant") return true
    return false
  })

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
        </div>

        <Separator className="bg-zinc-800" />
      </div>

      {/* Conversation */}
      <ScrollArea className="flex-1 mt-4">
        <div className="space-y-1 pb-8">
          {conversationMessages.map((msg) => {
            if (msg.type === "user") {
              const userMsg = msg as UserMessage
              const content =
                typeof userMsg.message.content === "string"
                  ? userMsg.message.content
                  : userMsg.message.content
                      .filter((b: any) => b.type === "text")
                      .map((b: any) => b.text)
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
        </div>
      </ScrollArea>
    </div>
  )
}
