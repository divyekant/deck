# Unified Session Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all session interaction (live, review, annotate, replay) into the Workspace page with a conversation + drawer layout, and remove dead code.

**Architecture:** Workspace main pane gains a toggleable Detail Drawer (280px right) for annotations/files/context. Session Panel gains a History section for browsing completed sessions. Replay mode replaces the input bar with a timeline scrubber inline. Session detail and replay pages become redirects.

**Tech Stack:** Next.js App Router, React, Tailwind, SSE streaming, existing annotation/diffs APIs

**Design doc:** `docs/plans/2026-03-03-unified-workspace-design.md`

---

## Task 1: Delete resume API and dead resume code

Remove the deprecated resume endpoint and resume-related code from the session detail page.

**Files:**
- Delete: `src/app/api/sessions/resume/route.ts`
- Modify: `src/app/sessions/[id]/page.tsx:78-85,230-343,470-498,701-733,762-814`
- Modify: `src/lib/claude/process.ts` (remove `resumeSession` export if exists)

**Step 1: Delete the resume API route**

```bash
rm src/app/api/sessions/resume/route.ts
```

**Step 2: Remove resume state variables from session detail page**

In `src/app/sessions/[id]/page.tsx`, remove these state declarations (lines ~78-85):
```typescript
// DELETE these lines:
const [showResume, setShowResume] = useState(false)
const [resumePrompt, setResumePrompt] = useState("")
const [resuming, setResuming] = useState(false)
const [streaming, setStreaming] = useState(false)
const [streamDone, setStreamDone] = useState(false)
const [streamExitCode, setStreamExitCode] = useState<number | null>(null)
const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([])
const [resumeError, setResumeError] = useState<string | null>(null)
```

**Step 3: Remove resume handler functions**

Delete `handleResume` (lines ~230-324), `handleStopResume` (lines ~326-336), `handleResumeKeyDown` (lines ~338-343).

**Step 4: Remove resume UI sections**

Delete the resume action buttons (lines ~470-498), resume output rendering (lines ~701-733), and the resume prompt panel (lines ~762-814).

**Step 5: Check for `resumeSession` in process.ts**

Search `src/lib/claude/process.ts` for `resumeSession`. If it exists, remove the export. Keep `sendMessage` — that's the multi-turn replacement.

**Step 6: Verify the app still builds**

Run: `bunx next build 2>&1 | head -30`
Expected: Build succeeds (or only unrelated warnings)

**Step 7: Commit**

```bash
git add -A
git commit -m "fix: remove deprecated resume API and dead resume code"
```

---

## Task 2: Detail Drawer component

Create the slide-out drawer that shows tags, notes, files changed, context window, and session metadata.

**Files:**
- Create: `src/components/workspace/detail-drawer.tsx`
- Test: `tests/unit/detail-drawer.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/detail-drawer.test.ts
import { describe, it, expect } from "vitest"

describe("DetailDrawer", () => {
  it("should be importable", async () => {
    const mod = await import("@/components/workspace/detail-drawer")
    expect(mod.DetailDrawer).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/detail-drawer.test.ts`
Expected: FAIL — module not found

**Step 3: Implement DetailDrawer**

Create `src/components/workspace/detail-drawer.tsx`:

```typescript
"use client"

import { useState, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ContextWindowChart } from "@/components/context-window-chart"

interface FileChange {
  path: string
  action: string
  count: number
}

interface SessionAnnotation {
  tags: string[]
  note: string
}

interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  sessionId: string | null
  messages: any[]
  model?: string
  meta?: {
    sessionId: string
    startedAt: string
    duration?: number
    model: string
    cli?: string
    totalCost?: number
    inputTokens?: number
    outputTokens?: number
    cacheReadTokens?: number
  }
}

const SUGGESTED_TAGS = ["bug-fix", "feature", "refactor", "exploration", "review"]

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  "bug-fix": { bg: "bg-red-500/10", text: "text-red-400" },
  feature: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  refactor: { bg: "bg-blue-500/10", text: "text-blue-400" },
  exploration: { bg: "bg-amber-500/10", text: "text-amber-400" },
  review: { bg: "bg-violet-500/10", text: "text-violet-400" },
}

export function DetailDrawer({
  open,
  onClose,
  sessionId,
  messages,
  model,
  meta,
}: DetailDrawerProps) {
  const [annotation, setAnnotation] = useState<SessionAnnotation>({ tags: [], note: "" })
  const [files, setFiles] = useState<FileChange[]>([])
  const [noteValue, setNoteValue] = useState("")

  // Fetch annotation when session changes
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/annotations?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        const ann = data.annotation || { tags: [], note: "" }
        setAnnotation(ann)
        setNoteValue(ann.note || "")
      })
      .catch(() => {})
  }, [sessionId])

  // Fetch file diffs when session changes
  useEffect(() => {
    if (!sessionId) return
    fetch(`/api/sessions/${sessionId}/diffs`)
      .then((r) => r.json())
      .then((data) => setFiles(data.files || []))
      .catch(() => setFiles([]))
  }, [sessionId])

  const toggleTag = useCallback(
    async (tag: string) => {
      if (!sessionId) return
      const hasTag = annotation.tags.includes(tag)
      const action = hasTag ? "removeTag" : "addTag"
      await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action, tag }),
      })
      setAnnotation((prev) => ({
        ...prev,
        tags: hasTag ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      }))
    },
    [sessionId, annotation.tags]
  )

  const saveNote = useCallback(async () => {
    if (!sessionId) return
    await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "addNote", note: noteValue }),
    })
    setAnnotation((prev) => ({ ...prev, note: noteValue }))
  }, [sessionId, noteValue])

  if (!open) return null

  const actionColors: Record<string, string> = {
    created: "bg-emerald-500/10 text-emerald-400",
    edited: "bg-amber-500/10 text-amber-400",
    modified: "bg-blue-500/10 text-blue-400",
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-l border-border bg-zinc-950/50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">Details</span>
        <button onClick={onClose} className="rounded p-1 hover:bg-accent">
          <X className="size-3.5" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 p-4">
          {/* Tags */}
          <section>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tags
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((tag) => {
                const active = annotation.tags.includes(tag)
                const colors = TAG_COLORS[tag] || { bg: "bg-zinc-500/10", text: "text-zinc-400" }
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs transition-opacity",
                      active ? `${colors.bg} ${colors.text}` : "bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Notes */}
          <section>
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Notes
            </h4>
            <textarea
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              onBlur={saveNote}
              placeholder="Add a note..."
              rows={3}
              className="w-full rounded-md border border-border bg-zinc-900 p-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </section>

          {/* Files Changed */}
          {files.length > 0 && (
            <section>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Files Changed ({files.length})
              </h4>
              <div className="flex flex-col gap-1">
                {files.map((f) => (
                  <div
                    key={f.path}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs bg-zinc-900"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 text-[10px] font-medium",
                        actionColors[f.action] || "bg-zinc-800 text-zinc-400"
                      )}
                    >
                      {f.action[0].toUpperCase()}
                    </span>
                    <span className="truncate text-zinc-400">
                      {f.path.split("/").pop()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Context Window */}
          {messages.length > 0 && (
            <section>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Context Window
              </h4>
              <ContextWindowChart messages={messages} model={model} />
            </section>
          )}

          {/* Session Meta */}
          {meta && (
            <section>
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Session Info
              </h4>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-zinc-500">ID</dt>
                <dd className="truncate text-zinc-400 font-mono">{meta.sessionId?.slice(0, 8)}</dd>
                <dt className="text-zinc-500">Model</dt>
                <dd className="text-zinc-400">{meta.model}</dd>
                {meta.totalCost != null && (
                  <>
                    <dt className="text-zinc-500">Cost</dt>
                    <dd className="text-zinc-400">${meta.totalCost.toFixed(4)}</dd>
                  </>
                )}
                {meta.inputTokens != null && (
                  <>
                    <dt className="text-zinc-500">Tokens</dt>
                    <dd className="text-zinc-400">
                      {(meta.inputTokens / 1000).toFixed(1)}k in / {((meta.outputTokens || 0) / 1000).toFixed(1)}k out
                    </dd>
                  </>
                )}
              </dl>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/detail-drawer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/workspace/detail-drawer.tsx tests/unit/detail-drawer.test.ts
git commit -m "feat: add DetailDrawer component for workspace metadata panel"
```

---

## Task 3: Session Panel — add History section with search

Extend the session panel to show historical sessions from the API and add a search filter.

**Files:**
- Modify: `src/components/workspace/session-panel.tsx:8-15,26-133`

**Step 1: Write the failing test**

```typescript
// tests/unit/session-panel-history.test.ts
import { describe, it, expect } from "vitest"

describe("SessionPanel", () => {
  it("should accept onLoadHistory and searchQuery props", async () => {
    const mod = await import("@/components/workspace/session-panel")
    expect(mod.SessionPanel).toBeDefined()
    // Props type check happens at compile time
  })
})
```

**Step 2: Run test to verify it passes (existing component)**

Run: `bunx vitest run tests/unit/session-panel-history.test.ts`
Expected: PASS

**Step 3: Extend SessionPanel**

In `src/components/workspace/session-panel.tsx`:

1. Add new props to `SessionPanelProps`:
```typescript
interface SessionPanelProps {
  sessions: WorkspaceSession[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNewSession: () => void
  onRestart?: (session: WorkspaceSession) => void
  // NEW:
  historySessions?: HistorySession[]
  onLoadMore?: () => void
  hasMore?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export interface HistorySession {
  id: string
  projectDir: string
  model: string
  prompt: string
  startedAt: string
  cost?: number
}
```

2. Add a search input at the top of the panel (below the header).

3. Add a "History" section below "Recent" that renders `historySessions` with gray dots. Each item shows project name, model, and relative time. Add a "Load more" button at the bottom if `hasMore` is true.

4. Filter all sections by `searchQuery` (match project name or prompt text).

**Step 4: Verify build**

Run: `bunx next build 2>&1 | head -30`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/workspace/session-panel.tsx tests/unit/session-panel-history.test.ts
git commit -m "feat: session panel — add history section and search filter"
```

---

## Task 4: Wire drawer and history into Workspace page

Connect the DetailDrawer to the workspace page, load historical sessions, and add `⌘I` keyboard shortcut.

**Files:**
- Modify: `src/app/workspace/page.tsx:25-30,67-159,404-427`

**Step 1: Add state for drawer and history**

At the top of the workspace component (near line 25), add:
```typescript
const [drawerOpen, setDrawerOpen] = useState(false)
const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
const [historyPage, setHistoryPage] = useState(0)
const [historyHasMore, setHistoryHasMore] = useState(true)
const [searchQuery, setSearchQuery] = useState("")
const [selectedSessionMeta, setSelectedSessionMeta] = useState<any>(null)
```

**Step 2: Add history loading effect**

```typescript
// Load history sessions from API
useEffect(() => {
  fetch(`/api/sessions?limit=20&offset=${historyPage * 20}`)
    .then((r) => r.json())
    .then((data) => {
      const mapped = (data.sessions || []).map((s: any) => ({
        id: s.meta?.sessionId || s.id,
        projectDir: s.meta?.projectDir || "",
        model: s.meta?.model || "",
        prompt: s.messages?.[0]?.content || "",
        startedAt: s.meta?.startedAt || "",
        cost: s.meta?.totalCost,
      }))
      setHistorySessions((prev) =>
        historyPage === 0 ? mapped : [...prev, ...mapped]
      )
      setHistoryHasMore(mapped.length === 20)
    })
    .catch(() => {})
}, [historyPage])
```

**Step 3: Load session detail when selecting a historical session**

When a historical session is selected (not in the active `sessions` list), fetch its full messages from `/api/sessions/{id}` and populate `messagesBySession`:

```typescript
const handleSelectSession = async (id: string) => {
  setSelectedId(id)
  // If not an active session, load from API
  const isActive = sessions.some((s) => s.id === id)
  if (!isActive) {
    const res = await fetch(`/api/sessions/${id}`)
    const data = await res.json()
    if (data.messages) {
      setMessagesBySession((prev) => ({ ...prev, [id]: data.messages }))
    }
    if (data.meta) {
      setSelectedSessionMeta(data.meta)
    }
  }
}
```

**Step 4: Add `⌘I` keyboard shortcut**

In the existing keyboard handler, add:
```typescript
if ((e.metaKey || e.ctrlKey) && e.key === "i") {
  e.preventDefault()
  setDrawerOpen((prev) => !prev)
}
```

**Step 5: Wire drawer into the JSX**

After the main conversation pane, render:
```typescript
<DetailDrawer
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  sessionId={selectedId}
  messages={selectedId ? (messagesBySession[selectedId] || []) : []}
  model={currentSession?.model}
  meta={selectedSessionMeta}
/>
```

**Step 6: Add drawer toggle button in the header bar**

Add an icon button (e.g., `PanelRight` from lucide) to toggle `drawerOpen`.

**Step 7: Pass history props to SessionPanel**

```typescript
<SessionPanel
  sessions={sessions}
  selectedId={selectedId}
  onSelect={handleSelectSession}
  onClose={handleCloseSession}
  onNewSession={...}
  onRestart={...}
  historySessions={historySessions}
  onLoadMore={() => setHistoryPage((p) => p + 1)}
  hasMore={historyHasMore}
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
/>
```

**Step 8: Verify the app works**

Run: `bun dev` and manually verify:
- `⌘I` toggles the drawer
- Drawer shows tags, notes, files for the selected session
- History section loads in session panel
- Clicking a history session loads its conversation

**Step 9: Commit**

```bash
git add src/app/workspace/page.tsx
git commit -m "feat: wire detail drawer, history, and ⌘I shortcut into workspace"
```

---

## Task 5: Inline Replay Mode

Replace the separate replay page with inline replay in the workspace conversation pane.

**Files:**
- Modify: `src/app/workspace/page.tsx` (add replay state and scrubber)
- Create: `src/components/workspace/replay-scrubber.tsx`
- Test: `tests/unit/replay-scrubber.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/replay-scrubber.test.ts
import { describe, it, expect } from "vitest"

describe("ReplayScrubber", () => {
  it("should be importable", async () => {
    const mod = await import("@/components/workspace/replay-scrubber")
    expect(mod.ReplayScrubber).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/replay-scrubber.test.ts`
Expected: FAIL

**Step 3: Implement ReplayScrubber**

Create `src/components/workspace/replay-scrubber.tsx`:

A horizontal bar with:
- Play/Pause button
- Skip back / Skip forward buttons
- Speed selector (1x/2x/5x)
- Timeline track with event markers (colored dots: blue=user, gray=assistant, amber=tool)
- Draggable playhead
- Progress percentage
- `currentIndex` and `total` display

Props:
```typescript
interface ReplayScrubberProps {
  total: number
  currentIndex: number
  onChange: (index: number) => void
  playing: boolean
  onPlayPause: () => void
  speed: number
  onSpeedChange: (speed: number) => void
  markers: { index: number; type: "user" | "assistant" | "tool" }[]
}
```

Port the timeline/scrubber logic from `src/app/sessions/[id]/replay/page.tsx` lines 454-545.

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/replay-scrubber.test.ts`
Expected: PASS

**Step 5: Add replay state to workspace page**

In `src/app/workspace/page.tsx`, add state:
```typescript
const [replayMode, setReplayMode] = useState(false)
const [replayIndex, setReplayIndex] = useState(0)
const [replayPlaying, setReplayPlaying] = useState(false)
const [replaySpeed, setReplaySpeed] = useState(1)
```

**Step 6: Conditional rendering — input bar vs scrubber**

When `replayMode` is true, render `<ReplayScrubber>` instead of the input bar. When false, render the normal input bar.

**Step 7: Add `⌘R` keyboard shortcut and header toggle**

Add a "Replay" button in the header (visible only for completed sessions). `⌘R` toggles replay mode. When entering replay mode, set `replayIndex` to 0.

**Step 8: Filter messages by replay index**

When `replayMode` is active, only render messages up to `replayIndex`. The `DetailDrawer` also gets `replayIndex` prop to filter "Files at this point."

**Step 9: Playback timer**

When `replayPlaying` is true, advance `replayIndex` on an interval scaled by `replaySpeed` (base: 1 message per second at 1x).

**Step 10: Commit**

```bash
git add src/components/workspace/replay-scrubber.tsx tests/unit/replay-scrubber.test.ts src/app/workspace/page.tsx
git commit -m "feat: inline replay mode with timeline scrubber in workspace"
```

---

## Task 6: Convert detail and replay pages to redirects

Turn `/sessions/{id}` and `/sessions/{id}/replay` into redirects to workspace.

**Files:**
- Modify: `src/app/sessions/[id]/page.tsx` (replace with redirect)
- Modify: `src/app/sessions/[id]/replay/page.tsx` (replace with redirect)

**Step 1: Replace session detail page with redirect**

Replace `src/app/sessions/[id]/page.tsx` entirely:
```typescript
import { redirect } from "next/navigation"

export default async function SessionDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/workspace?session=${id}`)
}
```

**Step 2: Replace replay page with redirect**

Replace `src/app/sessions/[id]/replay/page.tsx` entirely:
```typescript
import { redirect } from "next/navigation"

export default async function SessionReplayRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/workspace?session=${id}&replay=true`)
}
```

**Step 3: Update workspace to handle URL params**

In `src/app/workspace/page.tsx`, read `searchParams` for `session` and `replay`:
```typescript
// On mount, check URL params
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get("session")
  const replay = params.get("replay")
  if (sessionId) {
    handleSelectSession(sessionId)
    if (replay === "true") {
      setReplayMode(true)
    }
  }
}, [])
```

**Step 4: Verify redirects work**

Run: `bun dev` and verify:
- `/sessions/abc-123` → redirects to `/workspace?session=abc-123`
- `/sessions/abc-123/replay` → redirects to `/workspace?session=abc-123&replay=true`

**Step 5: Commit**

```bash
git add src/app/sessions/[id]/page.tsx src/app/sessions/[id]/replay/page.tsx src/app/workspace/page.tsx
git commit -m "feat: convert session detail and replay pages to workspace redirects"
```

---

## Task 7: Cleanup — remove unused imports and dead components

Now that detail/replay pages are redirects, remove orphaned code.

**Files:**
- Modify: `src/app/sessions/[id]/page.tsx` (already replaced — remove old imports file if separate)
- Check: `src/components/export-button.tsx` — still used by sessions list page? Keep if yes.
- Check: `src/components/replay-files-panel.tsx` — replay logic moved to drawer. Can be removed if not imported elsewhere.

**Step 1: Search for orphaned imports**

```bash
grep -r "replay-files-panel" src/ --include="*.tsx" --include="*.ts"
grep -r "context-window-chart" src/ --include="*.tsx" --include="*.ts"
```

If `replay-files-panel` is only imported by the old replay page (now a redirect), delete it. `context-window-chart` is now used by `DetailDrawer`, so keep it.

**Step 2: Remove orphaned files**

Delete any files that are no longer imported anywhere.

**Step 3: Verify build**

Run: `bunx next build 2>&1 | head -30`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: remove orphaned imports and dead components"
```

---

## Task 8: Smoke test and final polish

End-to-end verification.

**Checklist:**

1. Navigate to `/workspace` — session panel shows Active, Recent, History sections
2. Search in session panel — filters across all sections
3. Click a history session — conversation loads in main pane
4. Press `⌘I` — drawer slides in with tags, notes, files, context chart
5. Click tags to toggle — saved via API
6. Type a note, blur — saved via API
7. Press `⌘I` again — drawer closes
8. Launch a new session — streams in main pane
9. Session appears in panel with green dot, turns yellow when idle
10. Send a follow-up — same session continues
11. Session completes — "Restart" button appears
12. Press `⌘R` — replay mode activates with scrubber
13. Drag scrubber — messages render progressively
14. Press Play — auto-advance through messages
15. Press `⌘R` again — exits replay mode
16. Navigate to `/sessions/{id}` — redirects to workspace
17. Navigate to `/sessions/{id}/replay` — redirects to workspace in replay mode
18. Navigate to `/sessions` — list page still works with all features
19. Press `⌘N` — new session form appears
20. Keyboard shortcuts work: `⌘1-9`, `⌘W`, `⌘I`, `⌘R`, `/`

**Fix any issues found, then commit:**

```bash
git add -A
git commit -m "feat(v2.9): unified workspace — drawer, history, inline replay"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Delete resume API + dead code | Delete API route, clean detail page |
| 2 | DetailDrawer component | New component: tags, notes, files, context, meta |
| 3 | Session Panel — history + search | Extend existing component |
| 4 | Wire drawer + history into workspace | Connect components, `⌘I` shortcut |
| 5 | Inline replay mode | ReplayScrubber component, `⌘R` shortcut |
| 6 | Convert detail/replay to redirects | Replace pages with redirect stubs |
| 7 | Cleanup orphaned code | Remove dead imports and files |
| 8 | Smoke test + polish | Full end-to-end verification |
