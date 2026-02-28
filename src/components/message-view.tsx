"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ToolCallView } from "@/components/tool-call-view"
import { cn } from "@/lib/utils"
import { ChevronRight, User, Bot, Copy, Check } from "lucide-react"
import type { ContentBlock } from "@/lib/claude/types"

interface MessageViewProps {
  type: "user" | "assistant"
  content: string | ContentBlock[]
  model?: string
  timestamp?: string
  usage?: { input_tokens: number; output_tokens: number }
  index?: number
  total?: number
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function extractText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return String(content)
  return content
    .filter((b): b is ContentBlock & { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
}

function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="my-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-zinc-300 transition-colors"
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        Thinking...
      </button>
      {open && (
        <div className="mt-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <p className="whitespace-pre-wrap text-sm italic text-muted-foreground">{text}</p>
        </div>
      )}
    </div>
  )
}

function renderAssistantContent(content: string | ContentBlock[]) {
  if (typeof content === "string") {
    return <p className="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">{content}</p>
  }

  if (!Array.isArray(content)) {
    return <p className="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">{String(content)}</p>
  }

  return content.map((block: ContentBlock, i: number) => {
    if (block.type === "text") {
      return (
        <p key={i} className="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed">
          {block.text}
        </p>
      )
    }

    if (block.type === "thinking") {
      return <ThinkingBlock key={i} text={block.thinking || ""} />
    }

    if (block.type === "tool_use") {
      return (
        <ToolCallView
          key={i}
          name={block.name}
          input={block.input}
        />
      )
    }

    if (block.type === "tool_result") {
      return (
        <div key={i} className="my-1 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Tool Result</p>
          <p className="whitespace-pre-wrap font-mono text-xs text-zinc-400">
            {typeof block.content === "string"
              ? block.content.slice(0, 500)
              : JSON.stringify(block.content, null, 2).slice(0, 500)}
          </p>
        </div>
      )
    }

    return null
  })
}

export function MessageView({ type, content, model, timestamp, usage, index, total }: MessageViewProps) {
  const isUser = type === "user"
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const text = extractText(content)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={cn("group/msg relative flex gap-3 py-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-800">
          <Bot className="size-4 text-zinc-400" />
        </div>
      )}
      <div
        className={cn(
          "relative max-w-[85%] space-y-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Copy button — visible on hover */}
        <button
          onClick={handleCopy}
          className={cn(
            "absolute -top-1 right-0 z-10 flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-[10px] text-zinc-400 opacity-0 transition-opacity hover:text-zinc-200 group-hover/msg:opacity-100",
            copied && "text-emerald-400 hover:text-emerald-400"
          )}
          title="Copy message"
        >
          {copied ? (
            <>
              <Check className="size-3" />
              <span>Copied!</span>
            </>
          ) : (
            <Copy className="size-3" />
          )}
        </button>

        {isUser ? (
          <div className="rounded-lg bg-zinc-800 px-4 py-2.5">
            <p className="whitespace-pre-wrap text-sm text-zinc-200">{String(content)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {renderAssistantContent(content)}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1">
          {model && (
            <Badge variant="outline" className="border-zinc-700 text-[10px] text-zinc-500">
              {model}
            </Badge>
          )}
          {usage && (
            <Badge variant="outline" className="border-zinc-700 text-[10px] text-zinc-500 font-mono">
              {usage.input_tokens.toLocaleString()}in / {usage.output_tokens.toLocaleString()}out
            </Badge>
          )}
          {timestamp && (
            <span className="text-[10px] text-zinc-600" title={timestamp}>
              {relativeTime(timestamp)}
            </span>
          )}
          {index != null && total != null && (
            <span className="text-[10px] text-zinc-600">
              Message {index} of {total}
            </span>
          )}
        </div>
      </div>
      {isUser && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-800">
          <User className="size-4 text-zinc-400" />
        </div>
      )}
    </div>
  )
}
