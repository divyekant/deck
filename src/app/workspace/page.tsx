"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { SessionPanel, type WorkspaceSession, type HistorySession } from "@/components/workspace/session-panel"
import { DetailDrawer } from "@/components/workspace/detail-drawer"
import { DirectoryPicker } from "@/components/workspace/directory-picker"
import { getProjectPrefs, saveProjectPrefs } from "@/lib/workspace-prefs"
import { MessageView } from "@/components/message-view"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Settings, Terminal, Loader2, PanelRight, Play } from "lucide-react"
import { ReplayScrubber } from "@/components/workspace/replay-scrubber"

interface StreamMessage {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export default function WorkspacePage() {
  // Session management
  const [sessions, setSessions] = useState<WorkspaceSession[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)

  // Detail drawer & history
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [historyPage, setHistoryPage] = useState(0)
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedSessionMeta, setSelectedSessionMeta] = useState<any>(null)

  // Per-session messages (keyed by session ID)
  const [messagesBySession, setMessagesBySession] = useState<Record<string, StreamMessage[]>>({})

  // New session form
  const [projectDir, setProjectDir] = useState("")
  const [cli, setCli] = useState<"claude" | "codex">("claude")
  const [model, setModel] = useState("sonnet")
  const [prompt, setPrompt] = useState("")
  const [showOptions, setShowOptions] = useState(false)
  const [skipPermissions, setSkipPermissions] = useState(false)
  const [remoteControl, setRemoteControl] = useState(false)
  const [chromeMcp, setChromeMcp] = useState(false)
  const [maxTurns, setMaxTurns] = useState("")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [additionalFlags, setAdditionalFlags] = useState("")

  // Follow-up input
  const [followUp, setFollowUp] = useState("")

  // UI state
  const [launching, setLaunching] = useState(false)
  const [sending, setSending] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  // Replay mode
  const [replayMode, setReplayMode] = useState(false)
  const [replayIndex, setReplayIndex] = useState(0)
  const [replayPlaying, setReplayPlaying] = useState(false)
  const [replaySpeed, setReplaySpeed] = useState(1)

  // Refs for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Track active EventSource/fetch abort controllers per session
  const streamAbortRefs = useRef<Record<string, AbortController>>({})

  const selectedSession = sessions.find((s) => s.id === selectedId) || null
  const messages = selectedId ? messagesBySession[selectedId] || [] : []

  // For history sessions, create a virtual session object for display
  const isHistorySession = selectedId != null && !sessions.some((s) => s.id === selectedId)
  const historyMatch = historySessions.find((h) => h.id === selectedId)
  const displaySession: WorkspaceSession | null = selectedSession || (
    isHistorySession && historyMatch
      ? {
          id: historyMatch.id,
          projectDir: historyMatch.projectDir || selectedSessionMeta?.projectDir || "",
          model: historyMatch.model || selectedSessionMeta?.model || "",
          prompt: historyMatch.prompt || "",
          startedAt: historyMatch.startedAt || "",
          status: "done" as const,
        }
      : null
  )

  // Replay eligibility
  const isCompleted = displaySession?.status === "done" || displaySession?.status === "error"
  const canReplay = (isCompleted || isHistorySession) && messages.length > 0
  const canReplayRef = useRef(canReplay)
  canReplayRef.current = canReplay

  const projectName = (dir: string) => dir.split("/").pop() || dir

  // --- Stream connection ---

  const connectStream = useCallback((sessionId: string) => {
    // Abort any existing stream for this session
    if (streamAbortRefs.current[sessionId]) {
      streamAbortRefs.current[sessionId].abort()
    }

    const abort = new AbortController()
    streamAbortRefs.current[sessionId] = abort

    async function readStream() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/stream`, {
          signal: abort.signal,
        })

        if (!res.ok || !res.body) return

        const reader = res.body.getReader()
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

              if (parsed.type === "idle") {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === sessionId ? { ...s, status: "idle" } : s
                  )
                )
                continue
              }

              if (parsed.type === "done") {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === sessionId
                      ? { ...s, status: parsed.exitCode === 0 ? "done" : "error" }
                      : s
                  )
                )
                break
              }

              // Accumulate user and assistant messages
              if (parsed.type === "user" || parsed.type === "assistant") {
                setMessagesBySession((prev) => {
                  const existing = prev[sessionId] || []
                  // For assistant messages with same id, replace (partial update)
                  if (parsed.type === "assistant" && parsed.message?.id) {
                    const existingIdx = existing.findIndex(
                      (m) =>
                        m.type === "assistant" &&
                        m.message?.id === parsed.message.id
                    )
                    if (existingIdx >= 0) {
                      const updated = [...existing]
                      updated[existingIdx] = parsed
                      return { ...prev, [sessionId]: updated }
                    }
                  }
                  return { ...prev, [sessionId]: [...existing, parsed] }
                })
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        // Stream ended unexpectedly
      } finally {
        delete streamAbortRefs.current[sessionId]
      }
    }

    readStream()
  }, [])

  // --- Handlers ---

  const handleLaunch = useCallback(async () => {
    if (!projectDir || !prompt.trim()) return
    setLaunching(true)
    setLaunchError(null)

    // Save preferences
    saveProjectPrefs(projectDir, {
      cli,
      model,
      skipPermissions,
      remoteControl,
      chromeMcp,
      maxTurns,
      systemPrompt,
      additionalFlags,
    })

    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectDir,
          model,
          prompt: prompt.trim(),
          cli,
          skipPermissions,
          remoteControl,
          maxTurns,
          systemPrompt,
          additionalFlags,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const newSession: WorkspaceSession = {
        id: data.sessionId,
        projectDir,
        model,
        prompt: prompt.trim(),
        startedAt: new Date().toISOString(),
        status: "running",
      }

      setSessions((prev) => [newSession, ...prev])
      setSelectedId(data.sessionId)
      setShowNewForm(false)
      setPrompt("")
      setLaunching(false)

      // Connect SSE stream
      connectStream(data.sessionId)
    } catch (err) {
      setLaunching(false)
      setLaunchError(err instanceof Error ? err.message : "Failed to launch session")
    }
  }, [
    projectDir, prompt, cli, model, skipPermissions, remoteControl,
    chromeMcp, maxTurns, systemPrompt, additionalFlags, connectStream,
  ])

  const handleSendFollowUp = useCallback(async () => {
    if (!selectedId || !followUp.trim()) return
    setSending(true)
    setSendError(null)

    try {
      const res = await fetch(`/api/sessions/${selectedId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: followUp.trim() }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "Failed to send message")

      setSessions((prev) =>
        prev.map((s) =>
          s.id === selectedId ? { ...s, status: "running" } : s
        )
      )
      setFollowUp("")

      // Reconnect the stream to receive the follow-up response
      connectStream(selectedId)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send follow-up")
    } finally {
      setSending(false)
    }
  }, [selectedId, followUp, connectStream])

  const handleCloseSession = useCallback(
    async (id: string) => {
      const session = sessions.find((s) => s.id === id)
      if (session && (session.status === "running" || session.status === "idle")) {
        // Abort the stream
        if (streamAbortRefs.current[id]) {
          streamAbortRefs.current[id].abort()
          delete streamAbortRefs.current[id]
        }
        await fetch(`/api/sessions/${id}/stop`, { method: "POST" }).catch(() => {})
      }
      setSessions((prev) => prev.filter((s) => s.id !== id))
      setMessagesBySession((prev) => {
        const { [id]: _, ...rest } = prev
        return rest
      })
      if (selectedId === id) {
        setSelectedId(null)
        setShowNewForm(false)
        setSendError(null)
      }
    },
    [sessions, selectedId]
  )

  const handleSelectSession = useCallback(
    async (id: string) => {
      setSelectedId(id)
      setShowNewForm(false)
      setSendError(null)
      // If not an active session, load from API
      const isActive = sessions.some((s) => s.id === id)
      if (!isActive) {
        try {
          const res = await fetch(`/api/sessions/${id}`)
          const data = await res.json()
          if (data.messages) {
            setMessagesBySession((prev) => ({ ...prev, [id]: data.messages }))
          }
          if (data.meta) {
            // Map API field names to DetailDrawer's SessionMeta interface
            const m = data.meta
            setSelectedSessionMeta({
              sessionId: m.id || id,
              startedAt: m.startTime || "",
              duration: m.duration,
              model: m.model || "",
              cli: m.source || "",
              totalCost: m.estimatedCost,
              inputTokens: m.totalInputTokens,
              outputTokens: m.totalOutputTokens,
              cacheReadTokens: m.cacheReadTokens,
            })
          }
        } catch {
          // silent
        }
      }
    },
    [sessions]
  )

  // --- Effects ---

  // Load session from URL params (handles redirects from detail/replay pages)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionParam = params.get("session")
    const replay = params.get("replay")
    if (sessionParam) {
      // First try running sessions
      fetch("/api/sessions/running")
        .then((res) => res.json())
        .then((data) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const running = data.find((s: any) => s.id === sessionParam)
          if (running) {
            const ws: WorkspaceSession = {
              id: running.id,
              projectDir: running.projectDir,
              model: running.model,
              prompt: running.prompt,
              startedAt: running.startedAt,
              status: "idle",
            }
            setSessions([ws])
            setSelectedId(sessionParam)
            connectStream(sessionParam)
          } else {
            // Not running — load as history session
            handleSelectSession(sessionParam)
            if (replay === "true") {
              // Small delay to let messages load first
              setTimeout(() => setReplayMode(true), 500)
            }
          }
        })
        .catch(() => {
          // Fallback: try loading as history session
          handleSelectSession(sessionParam)
          if (replay === "true") {
            setTimeout(() => setReplayMode(true), 500)
          }
        })
    }
  }, [connectStream, handleSelectSession])

  // Auto-scroll messages — scroll the ScrollArea viewport directly
  // instead of scrollIntoView which scrolls ALL ancestor containers
  useEffect(() => {
    const el = messagesEndRef.current
    if (!el) return
    const viewport = el.closest("[data-radix-scroll-area-viewport]")
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
    }
  }, [messages])

  // Replay playback timer
  useEffect(() => {
    if (!replayMode || !replayPlaying) return
    const totalMsgs = messages.filter((m) => m.type === "user" || m.type === "assistant").length
    const interval = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= totalMsgs - 1) {
          setReplayPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1000 / replaySpeed)
    return () => clearInterval(interval)
  }, [replayMode, replayPlaying, replaySpeed, messages])

  // Reset replay mode when session changes
  useEffect(() => {
    setReplayMode(false)
    setReplayPlaying(false)
    setReplayIndex(0)
  }, [selectedId])

  // Load history sessions from API
  useEffect(() => {
    fetch(`/api/sessions?limit=20&offset=${historyPage * 20}`)
      .then((r) => r.json())
      .then((data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (data.sessions || []).map((s: any) => ({
          id: s.id,
          projectDir: s.projectPath || "",
          model: s.model || "",
          prompt: s.firstPrompt || "",
          startedAt: s.startTime || "",
        }))
        setHistorySessions((prev) =>
          historyPage === 0 ? mapped : [...prev, ...mapped]
        )
        setHistoryHasMore(mapped.length === 20)
      })
      .catch(() => {})
  }, [historyPage])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if focused in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"

      // Cmd/Ctrl+N — new session
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault()
        setShowNewForm(true)
        setSelectedId(null)
      }
      // Cmd/Ctrl+W — close current session (only when not in an input)
      if ((e.metaKey || e.ctrlKey) && e.key === "w" && !isInput) {
        e.preventDefault()
        if (selectedId) handleCloseSession(selectedId)
      }
      // Cmd/Ctrl+I — toggle detail drawer
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault()
        setDrawerOpen((prev) => !prev)
      }
      // Cmd/Ctrl+R — toggle replay mode (completed sessions only)
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault()
        if (canReplayRef.current) {
          setReplayMode((prev) => {
            if (!prev) setReplayIndex(0)
            setReplayPlaying(false)
            return !prev
          })
        }
      }
      // Cmd/Ctrl+1-9 — switch sessions
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        const activeSessions = sessions.filter(
          (s) => s.status === "running" || s.status === "idle"
        )
        if (activeSessions[idx]) {
          setSelectedId(activeSessions[idx].id)
          setShowNewForm(false)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedId, sessions, handleCloseSession])

  // --- Render helpers ---

  function renderMessages() {
    const filtered = messages.filter((m) => m.type === "user" || m.type === "assistant")
    const displayMessages = replayMode ? filtered.slice(0, replayIndex + 1) : filtered
    return displayMessages.map((msg, i) => {
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

          return <MessageView key={`user-${i}`} type="user" content={content} />
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

  // --- Main render ---

  return (
    <div className="flex h-[calc(100vh-theme(spacing.12))] -m-6 overflow-hidden">
      {/* Left session panel */}
      <SessionPanel
        sessions={sessions}
        selectedId={selectedId}
        onSelect={handleSelectSession}
        onClose={handleCloseSession}
        onNewSession={() => {
          setShowNewForm(true)
          setSelectedId(null)
        }}
        onRestart={(s) => {
          setProjectDir(s.projectDir)
          const prefs = getProjectPrefs(s.projectDir)
          setCli(prefs.cli)
          setModel(prefs.model)
          setSkipPermissions(prefs.skipPermissions)
          setRemoteControl(prefs.remoteControl)
          setChromeMcp(prefs.chromeMcp)
          setMaxTurns(prefs.maxTurns)
          setSystemPrompt(prefs.systemPrompt)
          setAdditionalFlags(prefs.additionalFlags)
          setShowNewForm(true)
          setSelectedId(null)
        }}
        historySessions={historySessions}
        onLoadMore={() => setHistoryPage((p) => p + 1)}
        hasMore={historyHasMore}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar when session selected */}
        {displaySession && (
          <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            <span className="font-medium">
              {projectName(displaySession.projectDir)}
            </span>
            <Badge variant="outline">{displaySession.model}</Badge>
            <Badge
              variant={
                displaySession.status === "running" ? "default" : "secondary"
              }
            >
              {displaySession.status}
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {messages.length} message{messages.length !== 1 ? "s" : ""}
              </span>
              {canReplay && (
                <button
                  onClick={() => {
                    setReplayMode((prev) => {
                      if (!prev) setReplayIndex(0)
                      setReplayPlaying(false)
                      return !prev
                    })
                  }}
                  className={cn(
                    "rounded p-1 transition-colors",
                    replayMode ? "bg-emerald-600 text-white" : "hover:bg-accent"
                  )}
                  title="Replay (⌘R)"
                >
                  <Play className="size-4" />
                </button>
              )}
              <button
                onClick={() => setDrawerOpen((prev) => !prev)}
                className={cn(
                  "rounded p-1 transition-colors",
                  drawerOpen ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                )}
                title="Toggle details (\u2318I)"
              >
                <PanelRight className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content area */}
        {!displaySession && !showNewForm && (
          /* Empty state */
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center space-y-3">
              <Terminal className="mx-auto size-12 text-muted-foreground/30" />
              <h2 className="text-lg font-medium text-muted-foreground">
                Start a new session
              </h2>
              <p className="text-sm text-muted-foreground/60">
                Press{" "}
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
                  {typeof navigator !== "undefined" &&
                  navigator.platform?.includes("Mac")
                    ? "Cmd"
                    : "Ctrl"}
                  +N
                </kbd>{" "}
                or click the + button to launch a session
              </p>
            </div>
          </div>
        )}

        {showNewForm && !displaySession && (
          /* New session form */
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-lg space-y-4 p-6">
              <h2 className="text-lg font-semibold">New Session</h2>

              {/* Directory picker */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Project Directory
                </label>
                <DirectoryPicker
                  value={projectDir}
                  onChange={(path) => {
                    setProjectDir(path)
                    const prefs = getProjectPrefs(path)
                    setCli(prefs.cli)
                    setModel(prefs.model)
                    setSkipPermissions(prefs.skipPermissions)
                    setRemoteControl(prefs.remoteControl)
                    setChromeMcp(prefs.chromeMcp)
                    setMaxTurns(prefs.maxTurns)
                    setSystemPrompt(prefs.systemPrompt)
                    setAdditionalFlags(prefs.additionalFlags)
                  }}
                />
              </div>

              {/* CLI toggle */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  CLI
                </label>
                <div className="flex gap-2">
                  <Button
                    variant={cli === "claude" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCli("claude")
                      setModel("sonnet")
                    }}
                  >
                    Claude Code
                  </Button>
                  <Button
                    variant={cli === "codex" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setCli("codex")
                      setModel("gpt-5.2-codex")
                    }}
                  >
                    Codex
                  </Button>
                </div>
              </div>

              {/* Model selector */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Model
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(cli === "claude"
                    ? ["sonnet", "opus", "haiku"]
                    : ["gpt-5.2-codex", "gpt-5-codex-mini"]
                  ).map((m) => (
                    <Button
                      key={m}
                      variant={model === m ? "default" : "outline"}
                      size="sm"
                      onClick={() => setModel(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Options drawer */}
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="size-3.5" />
                Options {showOptions ? "\u25B4" : "\u25BE"}
              </button>

              {showOptions && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={skipPermissions}
                      onChange={(e) => setSkipPermissions(e.target.checked)}
                      className="rounded border-border"
                    />
                    Skip permissions
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={remoteControl}
                      onChange={(e) => setRemoteControl(e.target.checked)}
                      className="rounded border-border"
                    />
                    Remote control
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={chromeMcp}
                      onChange={(e) => setChromeMcp(e.target.checked)}
                      className="rounded border-border"
                      disabled
                    />
                    Chrome MCP (coming soon)
                  </label>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                      Max turns
                    </label>
                    <Input
                      value={maxTurns}
                      onChange={(e) => setMaxTurns(e.target.value)}
                      placeholder="unlimited"
                      className="h-7 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                      System prompt
                    </label>
                    <Input
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="h-7 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">
                      Additional flags
                    </label>
                    <Input
                      value={additionalFlags}
                      onChange={(e) => setAdditionalFlags(e.target.value)}
                      placeholder="--verbose --allowedTools Edit,Read"
                      className="h-7 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Prompt textarea */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What do you want to do?"
                  rows={4}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                      handleLaunch()
                  }}
                />
              </div>

              {/* Launch error */}
              {launchError && (
                <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2">
                  <p className="text-xs text-red-400 break-words">
                    {launchError}
                  </p>
                </div>
              )}

              {/* Launch button */}
              <Button
                onClick={handleLaunch}
                disabled={!projectDir || !prompt.trim() || launching}
                className="w-full"
              >
                {launching ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Launching...
                  </>
                ) : (
                  <>
                    Launch Session{" "}
                    <kbd className="ml-2 rounded border border-border/50 bg-muted/50 px-1 py-0.5 text-[10px] font-mono">
                      {typeof navigator !== "undefined" &&
                      navigator.platform?.includes("Mac")
                        ? "\u2318"
                        : "Ctrl"}
                      {"+\u23CE"}
                    </kbd>
                  </>
                )}
              </Button>
            </div>
          </ScrollArea>
        )}

        {displaySession && (
          <>
            {/* Message stream */}
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-1 pb-4">
                {renderMessages()}

                {displaySession.status === "running" &&
                  messages.length === 0 && (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Waiting for output...
                      </span>
                    </div>
                  )}

                {!replayMode && displaySession.status === "error" && (
                  <div className="mt-4 rounded-md border border-red-900 bg-red-950/50 px-4 py-3">
                    <span className="text-sm font-medium">
                      Session ended with error
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Bottom bar — either replay scrubber or input */}
            {replayMode ? (
              <ReplayScrubber
                total={messages.filter((m) => m.type === "user" || m.type === "assistant").length}
                currentIndex={replayIndex}
                onChange={setReplayIndex}
                playing={replayPlaying}
                onPlayPause={() => setReplayPlaying((p) => !p)}
                speed={replaySpeed}
                onSpeedChange={setReplaySpeed}
                onClose={() => {
                  setReplayMode(false)
                  setReplayPlaying(false)
                }}
              />
            ) : (displaySession.status === "running" ||
              displaySession.status === "idle" ||
              displaySession.status === "done") ? (
              <div className="border-t border-border p-3">
                {sendError && (
                  <div className="mb-2 rounded-md border border-red-900 bg-red-950/50 px-3 py-1.5">
                    <p className="text-xs text-red-400">{sendError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder={
                      displaySession.status === "running"
                        ? "Waiting for response..."
                        : "Continue the conversation..."
                    }
                    rows={2}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter")
                        handleSendFollowUp()
                    }}
                    disabled={displaySession.status === "running"}
                  />
                  <Button
                    onClick={handleSendFollowUp}
                    disabled={
                      !followUp.trim() ||
                      sending ||
                      displaySession.status === "running"
                    }
                    size="sm"
                    className="self-end"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Send{" "}
                        <kbd className="ml-1 text-[10px] font-mono opacity-60">
                          {typeof navigator !== "undefined" &&
                          navigator.platform?.includes("Mac")
                            ? "\u2318"
                            : "Ctrl"}
                          {"+\u23CE"}
                        </kbd>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Right detail drawer */}
      <DetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sessionId={selectedId}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages={selectedId ? ((messagesBySession[selectedId] || []) as any[]) : []}
        model={displaySession?.model}
        meta={selectedSessionMeta}
      />
    </div>
  )
}
