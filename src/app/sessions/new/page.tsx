"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Play,
  Square,
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  DollarSign,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MessageView } from "@/components/message-view"
import { MODEL_PRICING, formatCost } from "@/lib/claude/costs"
import type { SessionMeta } from "@/lib/claude/types"

// Map short CLI model names to full model IDs for pricing lookup
const CLAUDE_MODELS: Record<string, { id: string; label: string }> = {
  sonnet: { id: "claude-sonnet-4-6", label: "Sonnet" },
  opus: { id: "claude-opus-4-6", label: "Opus" },
  haiku: { id: "claude-haiku-4-5", label: "Haiku" },
}

const CODEX_MODELS: Record<string, { id: string; label: string }> = {
  "gpt-5.2-codex": { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
  "gpt-5-codex-mini": { id: "gpt-5-codex-mini", label: "Codex Mini" },
  "gpt-5.1-codex-max": { id: "gpt-5.1-codex-max", label: "Codex Max" },
}

function getModels(cli: "claude" | "codex") {
  return cli === "codex" ? CODEX_MODELS : CLAUDE_MODELS
}

interface StreamMessage {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface CostAccumulator {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

function computeCost(model: string, cli: "claude" | "codex", usage: CostAccumulator): number {
  const models = getModels(cli)
  const fullModelId = models[model]?.id || "claude-sonnet-4-6"
  const pricing = MODEL_PRICING[fullModelId] ?? MODEL_PRICING["claude-opus-4-6"]

  return (
    (usage.inputTokens / 1_000_000) * pricing.input +
    (usage.outputTokens / 1_000_000) * pricing.output +
    (usage.cacheCreationTokens / 1_000_000) * pricing.cacheWrite +
    (usage.cacheReadTokens / 1_000_000) * pricing.cacheRead
  )
}

export default function NewSessionPage() {
  // Form state
  const [projects, setProjects] = useState<{ path: string; name: string }[]>([])
  const [projectDir, setProjectDir] = useState("")
  const [cli, setCli] = useState<"claude" | "codex">("claude")
  const [model, setModel] = useState("sonnet")
  const [prompt, setPrompt] = useState("")
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [envWarning, setEnvWarning] = useState<string | null>(null)

  // Stream state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [done, setDone] = useState(false)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [messages, setMessages] = useState<StreamMessage[]>([])
  const [cost, setCost] = useState<CostAccumulator>({
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  })

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Fetch projects for the dropdown
  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/sessions?limit=200")
        if (!res.ok) return
        const data = await res.json()
        const sessions: SessionMeta[] = data.sessions
        // Extract unique project paths
        const seen = new Map<string, string>()
        for (const s of sessions) {
          if (s.projectPath && !seen.has(s.projectPath)) {
            seen.set(s.projectPath, s.projectName)
          }
        }
        const projectList = Array.from(seen.entries()).map(([path, name]) => ({
          path,
          name,
        }))
        setProjects(projectList)
        if (projectList.length > 0 && !projectDir) {
          setProjectDir(projectList[0].path)
        }
      } catch {
        // Silently fail — user can still type
      }
    }
    fetchProjects()
    // Preflight: check if CLI is accessible
    async function checkEnv() {
      try {
        const res = await fetch("/api/sessions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectDir: "/tmp", model: "sonnet", prompt: "test", cli: "claude" }),
        })
        if (!res.ok) {
          const data = await res.json()
          if (data.error?.includes("CLI not found")) {
            setEnvWarning("Claude Code CLI is not available in this environment. Session launching requires running Deck locally (bun dev) with Claude Code installed.")
          }
        }
      } catch {
        // Ignore
      }
    }
    checkEnv()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleLaunch = useCallback(async () => {
    if (!prompt.trim() || !projectDir) return

    setLaunching(true)
    setLaunchError(null)
    setMessages([])
    setDone(false)
    setExitCode(null)
    setCost({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 })

    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectDir, model, prompt: prompt.trim(), cli }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to start session")
      }

      const { sessionId: sid } = await res.json()
      setSessionId(sid)
      setStreaming(true)
      setLaunching(false)

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

      // eslint-disable-next-line no-constant-condition
      while (true) {
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

            // Track cost from assistant messages
            if (parsed.type === "assistant" && parsed.message?.usage) {
              const u = parsed.message.usage
              setCost((prev) => ({
                inputTokens: prev.inputTokens + (u.input_tokens || 0),
                outputTokens: prev.outputTokens + (u.output_tokens || 0),
                cacheCreationTokens:
                  prev.cacheCreationTokens + (u.cache_creation_input_tokens || 0),
                cacheReadTokens:
                  prev.cacheReadTokens + (u.cache_read_input_tokens || 0),
              }))
            }

            if (parsed.type === "done") {
              setDone(true)
              setStreaming(false)
              setExitCode(parsed.exitCode ?? null)
              break
            }

            // Only render user and assistant messages
            if (parsed.type === "user" || parsed.type === "assistant") {
              setMessages((prev) => {
                // For assistant messages with the same id, replace (partial update)
                if (parsed.type === "assistant" && parsed.message?.id) {
                  const existingIdx = prev.findIndex(
                    (m) => m.type === "assistant" && m.message?.id === parsed.message.id
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
      if (!done) setDone(true)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped the session
        return
      }
      setLaunchError(err instanceof Error ? err.message : "Something went wrong")
      setLaunching(false)
      setStreaming(false)
    }
  }, [prompt, projectDir, model, cli, done])

  const handleStop = useCallback(async () => {
    if (!sessionId) return

    // Abort the fetch stream
    abortRef.current?.abort()

    try {
      await fetch(`/api/sessions/${sessionId}/stop`, { method: "POST" })
    } catch {
      // Best effort
    }

    setStreaming(false)
    setDone(true)
  }, [sessionId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !envWarning) {
      e.preventDefault()
      handleLaunch()
    }
  }

  const isActive = streaming || sessionId !== null

  // Render conversation messages from the stream
  const renderMessages = () => {
    return messages.map((msg, i) => {
      if (msg.type === "user") {
        const content =
          typeof msg.message?.content === "string"
            ? msg.message.content
            : Array.isArray(msg.message?.content)
              ? msg.message.content
                  .filter((b: { type: string }) => b.type === "text")
                  .map((b: { text: string }) => b.text)
                  .join("\n")
              : ""

        return (
          <MessageView
            key={`user-${i}`}
            type="user"
            content={content}
          />
        )
      }

      if (msg.type === "assistant") {
        return (
          <MessageView
            key={`assistant-${msg.message?.id || i}`}
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
      {/* Header */}
      <div className="shrink-0 space-y-4">
        <div className="flex items-center gap-3">
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
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            New Session
          </h1>
        </div>
        <Separator className="bg-zinc-800" />
      </div>

      {/* Environment warning */}
      {envWarning && (
        <div className="mt-4 rounded-md border border-amber-800 bg-amber-950/50 px-4 py-3">
          <p className="text-sm text-amber-300">{envWarning}</p>
          <p className="mt-1 text-xs text-amber-500">
            Run <code className="rounded bg-amber-900/50 px-1 py-0.5">bun dev</code> locally to use this feature, or launch sessions directly from your terminal with <code className="rounded bg-amber-900/50 px-1 py-0.5">claude</code>.
          </p>
        </div>
      )}

      {/* Main content — form + stream */}
      <div className="flex flex-1 gap-6 mt-4 min-h-0">
        {/* Left panel: Form (sticky on desktop) */}
        <div className="w-80 shrink-0 space-y-5 lg:sticky lg:top-0 lg:self-start">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="space-y-4 pt-0">
              {/* Project selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Project</label>
                <Select value={projectDir} onValueChange={setProjectDir} disabled={isActive}>
                  <SelectTrigger className="w-full border-zinc-700 bg-zinc-950 text-zinc-200">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.path} value={p.path}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {projectDir && (
                  <p className="font-mono text-[10px] text-zinc-600 truncate">{projectDir}</p>
                )}
              </div>

              {/* CLI selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">CLI</label>
                <div className="flex gap-2">
                  {(["claude", "codex"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setCli(c)
                        const defaults = c === "codex" ? Object.keys(CODEX_MODELS) : Object.keys(CLAUDE_MODELS)
                        setModel(defaults[0])
                      }}
                      disabled={isActive}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        cli === c
                          ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                          : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {c === "claude" ? "Claude Code" : "Codex"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Model</label>
                <div className="flex gap-2">
                  {Object.entries(getModels(cli)).map(([key, { label }]) => (
                    <button
                      key={key}
                      onClick={() => setModel(key)}
                      disabled={isActive}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                        model === key
                          ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                          : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400">Prompt</label>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isActive}
                  placeholder={cli === "codex" ? "What would you like Codex to do?" : "What would you like Claude to do?"}
                  rows={5}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50"
                />
                <p className="text-[10px] text-zinc-600">
                  {navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to launch
                </p>
              </div>

              {/* Launch / Stop button */}
              {!isActive ? (
                <Button
                  onClick={handleLaunch}
                  disabled={!prompt.trim() || !projectDir || launching || !!envWarning}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500"
                >
                  {launching ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Launch Session
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleStop}
                  variant="destructive"
                  className="w-full"
                  disabled={done}
                >
                  <Square className="size-4" />
                  Stop Session
                </Button>
              )}

              {launchError && (
                <div className="max-h-24 overflow-y-auto rounded-md border border-red-900 bg-red-950/50 px-3 py-2">
                  <p className="text-xs text-red-400 break-words">{launchError}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session info card (visible when streaming) */}
          {sessionId && (
            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-center gap-2">
                  {streaming ? (
                    <Badge className="bg-emerald-900 text-emerald-300 border-emerald-700">
                      <Zap className="size-3 mr-1" />
                      Live
                    </Badge>
                  ) : exitCode === 0 || exitCode === null ? (
                    <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700">
                      <CheckCircle2 className="size-3 mr-1" />
                      Complete
                    </Badge>
                  ) : (
                    <Badge className="bg-red-900 text-red-300 border-red-700">
                      <XCircle className="size-3 mr-1" />
                      Error ({exitCode})
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="border-zinc-700 text-zinc-500 text-[10px]"
                  >
                    {getModels(cli)[model]?.label || model}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <DollarSign className="size-3" />
                  <span className="font-mono">
                    {formatCost(computeCost(model, cli, cost))}
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="font-mono text-zinc-500">
                    {cost.inputTokens.toLocaleString()}in / {cost.outputTokens.toLocaleString()}out
                  </span>
                </div>

                <p className="font-mono text-[10px] text-zinc-600 truncate">
                  {sessionId}
                </p>

                {done && (
                  <Link
                    href={`/sessions/${sessionId}`}
                    className="block text-xs text-emerald-500 hover:text-emerald-400 hover:underline"
                  >
                    View full session details
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right panel: Stream output */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!sessionId ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center space-y-2">
                <Play className="size-10 text-zinc-800 mx-auto" />
                <p className="text-sm text-zinc-600">
                  Configure and launch a session to see live output here.
                </p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div ref={scrollRef} className="space-y-1 pb-8 overflow-y-auto h-full">
                {renderMessages()}

                {streaming && messages.length === 0 && (
                  <div className="flex items-center gap-2 py-4">
                    <Loader2 className="size-4 animate-spin text-zinc-500" />
                    <span className="text-sm text-zinc-500">Waiting for output...</span>
                  </div>
                )}

                {done && (
                  <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-900/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      {exitCode === 0 || exitCode === null ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : (
                        <XCircle className="size-4 text-red-500" />
                      )}
                      <span className="text-sm font-medium text-zinc-300">
                        Session complete
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatCost(computeCost(model, cli, cost))} total
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  )
}
