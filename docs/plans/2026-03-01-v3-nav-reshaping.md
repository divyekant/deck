# Deck v3 Navigation Reshaping — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reshape Deck from 22 nav items to 19 focused items — cut 12 redundant pages, absorb their data into survivors, add Cmd+K search, then build Config/Workspace/Health/Replay features.

**Architecture:** Sequential foundation (V1→V2→V3) restructures nav and cuts pages. Parallel feature slices (V4–V7) add new pages reading local filesystem data via API routes. All new pages follow existing patterns: "use client" pages fetching from `/api/*` routes.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Lucide icons, shadcn/ui components, Bun.

---

## Task 1: Rewrite Sidebar Navigation (V1)

**Files:**
- Modify: `src/components/sidebar.tsx:40-83`

**Step 1: Replace the navSections array**

Replace the entire `navSections` export with the new v3 structure:

```typescript
import {
  BarChart3,
  MessageSquare,
  GitBranch,
  Sparkles,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Radio,
  DollarSign,
  FileDiff,
  Activity,
  Plug,
  Bot,
  Brain,
  Webhook,
  HeartPulse,
  Package,
  Wrench,
  GitCommit,
  Camera,
  BarChart2,
  Clock,
} from "lucide-react"

export const navSections = [
  {
    label: "Overview",
    items: [
      { name: "Home", href: "/", icon: BarChart3 },
    ],
  },
  {
    label: "Monitor",
    items: [
      { name: "Live", href: "/live", icon: Radio, showRunning: true },
      { name: "Sessions", href: "/sessions", icon: MessageSquare },
      { name: "Costs", href: "/costs", icon: DollarSign },
      { name: "Setup", href: "/setup", icon: Wrench },
      { name: "Ports", href: "/ports", icon: Plug },
    ],
  },
  {
    label: "Workspace",
    items: [
      { name: "Repos", href: "/repos", icon: GitBranch },
      { name: "Work Graph", href: "/work-graph", icon: BarChart2 },
      { name: "Repo Pulse", href: "/pulse", icon: Activity },
      { name: "Timeline", href: "/timeline", icon: Clock },
      { name: "Diffs", href: "/diffs", icon: FileDiff },
      { name: "Snapshots", href: "/snapshots", icon: Camera },
    ],
  },
  {
    label: "Config",
    items: [
      { name: "Skills", href: "/skills", icon: Sparkles },
      { name: "Agents", href: "/agents", icon: Bot },
      { name: "Memory", href: "/memory", icon: Brain },
      { name: "Hooks", href: "/hooks", icon: Webhook },
    ],
  },
  {
    label: "Health",
    items: [
      { name: "Hygiene", href: "/hygiene", icon: HeartPulse },
      { name: "Dependencies", href: "/dependencies", icon: Package },
    ],
  },
]
```

**Step 2: Verify sidebar renders correctly**

Run: `bun dev`
Expected: Sidebar shows 5 sections with 19 items. All existing routes (Home, Live, Sessions, Costs, Ports, Repos, Pulse, Diffs, Skills, Settings) work. New routes show Next.js 404.

**Step 3: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(v3): restructure sidebar to 19-item navigation"
```

---

## Task 2: Create Placeholder Pages (V1)

**Files:**
- Create: `src/app/setup/page.tsx`
- Create: `src/app/agents/page.tsx`
- Create: `src/app/memory/page.tsx`
- Create: `src/app/hooks/page.tsx`
- Create: `src/app/hygiene/page.tsx`
- Create: `src/app/dependencies/page.tsx`

Note: `src/app/work-graph/`, `src/app/timeline/`, `src/app/snapshots/` already exist from prior work.

**Step 1: Create placeholder component for each new page**

Each placeholder follows the same pattern:

```typescript
// src/app/setup/page.tsx
export default function SetupPage() {
  return (
    <div className="flex-1 p-6">
      <h1 className="text-2xl font-bold text-zinc-50 mb-2">Setup</h1>
      <p className="text-zinc-400">
        CLAUDE.md viewer, Plugins, and MCP overview. Coming in V4.
      </p>
    </div>
  )
}
```

Create all 6 with appropriate titles:
- Setup: "CLAUDE.md viewer, Plugins, and MCP overview."
- Agents: "Browse agent definitions across all projects."
- Memory: "View MEMORY.md files across all projects."
- Hooks: "View all hooks with event types and source code."
- Hygiene: "Environment health score and actionable issues."
- Dependencies: "Package health and cross-repo dependency graph."

**Step 2: Verify all new routes resolve**

Run: `bun dev`, navigate to each: `/setup`, `/agents`, `/memory`, `/hooks`, `/hygiene`, `/dependencies`
Expected: Each shows placeholder content, no 404s.

**Step 3: Check existing placeholder pages**

Verify `/work-graph`, `/timeline`, `/snapshots` still render. If they have old content, update their descriptions to match the v3 plan.

**Step 4: Commit**

```bash
git add src/app/setup src/app/agents src/app/memory src/app/hooks src/app/hygiene src/app/dependencies
git commit -m "feat(v3): add placeholder pages for new nav items"
```

---

## Task 3: Add Bookmarks Filter to Sessions (V2)

**Files:**
- Modify: `src/app/sessions/page.tsx`

**Step 1: Add bookmarked filter toggle to the toolbar**

In the sessions page, locate the filter bar (where Search, Project dropdown, Model dropdown exist). Add a Bookmarked toggle button after the existing filters:

```typescript
// Add to filter bar, after the model dropdown
<Button
  variant={showBookmarked ? "default" : "outline"}
  size="sm"
  onClick={() => setShowBookmarked(!showBookmarked)}
  className="gap-1"
>
  <Bookmark className="h-3.5 w-3.5" />
  {!collapsed && "Bookmarked"}
</Button>
```

Add state: `const [showBookmarked, setShowBookmarked] = useState(false)`

Add filter logic in the existing `useMemo` that filters sessions:
```typescript
if (showBookmarked) {
  filtered = filtered.filter(s => bookmarkedIds.has(s.id))
}
```

**Step 2: Add Export button to the toolbar**

Move the export logic from the old `/export` page into a toolbar button on Sessions. The existing `export-button.tsx` component can be reused:

```typescript
import ExportButton from "@/components/export-button"
// In toolbar:
<ExportButton sessions={filteredSessions} />
```

**Step 3: Verify**

Run: `bun dev`, go to `/sessions`. Toggle Bookmarked filter — only bookmarked sessions show. Click Export — CSV downloads.

**Step 4: Commit**

```bash
git add src/app/sessions/page.tsx
git commit -m "feat(v3): add bookmarks filter and export button to sessions page"
```

---

## Task 4: Add Tabs to Costs Page (V2)

**Files:**
- Modify: `src/app/costs/page.tsx`
- Read: `src/app/tokens/page.tsx` (extract content)
- Read: `src/app/models/page.tsx` (extract content)

**Step 1: Add tab state and tab bar UI**

Add a tab bar at the top of the Costs page:

```typescript
type CostTab = "overview" | "tokens" | "models"
const [activeTab, setActiveTab] = useState<CostTab>("overview")

// In JSX, before the main content:
<div className="flex gap-1 mb-6 border-b border-zinc-800">
  {(["overview", "tokens", "models"] as const).map(tab => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={cn(
        "px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors",
        activeTab === tab
          ? "border-emerald-500 text-zinc-50"
          : "border-transparent text-zinc-400 hover:text-zinc-200"
      )}
    >
      {tab}
    </button>
  ))}
</div>
```

**Step 2: Extract Tokens page content into a component**

Read `src/app/tokens/page.tsx`. Extract its main content (the token analysis UI) into a section rendered when `activeTab === "tokens"`. Copy the data fetching and rendering logic.

**Step 3: Extract Models page content into a component**

Read `src/app/models/page.tsx`. Extract its main content into a section rendered when `activeTab === "models"`.

**Step 4: Wrap existing costs content in overview tab**

Wrap the current costs page content in `{activeTab === "overview" && (...)}`.

**Step 5: Verify**

Run: `bun dev`, go to `/costs`. Click each tab — Overview shows existing costs, Tokens shows token analysis, Models shows model stats.

**Step 6: Commit**

```bash
git add src/app/costs/page.tsx
git commit -m "feat(v3): add tokens and models tabs to costs page"
```

---

## Task 5: Add About Section to Settings (V2)

**Files:**
- Modify: `src/app/settings/page.tsx`
- Read: `src/app/about/page.tsx` (extract changelog content)

**Step 1: Extract changelog data from About page**

Read `src/app/about/page.tsx` and extract the changelog entries (version history data).

**Step 2: Add About/Changelog section to Settings**

Add a new Card section below the existing settings form:

```typescript
<Card className="bg-zinc-900 border-zinc-800 mt-6">
  <CardHeader>
    <CardTitle className="text-zinc-100 text-lg">About Deck</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-zinc-400 text-sm mb-4">Version 3.0.0</p>
    {/* Render changelog entries here */}
  </CardContent>
</Card>
```

**Step 3: Verify**

Run: `bun dev`, go to `/settings`. Scroll down — see About section with changelog.

**Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(v3): add about/changelog section to settings page"
```

---

## Task 6: Delete Cut Pages (V2)

**Files:**
- Delete: `src/app/search/page.tsx` (and directory)
- Delete: `src/app/notifications/page.tsx` (and directory)
- Delete: `src/app/activity/page.tsx` (and directory)
- Delete: `src/app/bookmarks/page.tsx` (and directory)
- Delete: `src/app/analytics/page.tsx` (and directory)
- Delete: `src/app/tokens/page.tsx` (and directory)
- Delete: `src/app/models/page.tsx` (and directory)
- Delete: `src/app/insights/page.tsx` (and directory)
- Delete: `src/app/commands/page.tsx` (and directory)
- Delete: `src/app/export/page.tsx` (and directory)
- Delete: `src/app/about/page.tsx` (and directory)
- Delete: `src/app/git/page.tsx` (and directory)

**Step 1: Delete all 12 page directories**

```bash
rm -rf src/app/search src/app/notifications src/app/activity src/app/bookmarks
rm -rf src/app/analytics src/app/tokens src/app/models src/app/insights
rm -rf src/app/commands src/app/export src/app/about src/app/git
```

**Step 2: Check for dead imports**

Search for any imports referencing deleted pages:
```bash
grep -r "from.*/(search|notifications|activity|bookmarks|analytics|tokens|models|insights|commands|export|about|git)" src/ --include="*.tsx" --include="*.ts"
```

Fix any broken imports found.

**Step 3: Verify app builds and runs**

Run: `bun dev`
Expected: App loads, no build errors. Navigating to deleted routes shows Next.js 404.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(v3): remove 12 redundant pages, data migrated to surviving pages"
```

---

## Task 7: Redirect Old MCP Route (V2)

**Files:**
- Modify: `src/app/mcp/page.tsx`

**Step 1: Replace MCP page with redirect to Setup**

The MCP content will be part of the Setup page (V4). For now, redirect:

```typescript
import { redirect } from "next/navigation"

export default function MCPPage() {
  redirect("/setup")
}
```

**Step 2: Commit**

```bash
git add src/app/mcp/page.tsx
git commit -m "feat(v3): redirect /mcp to /setup"
```

---

## Task 8: Build Cmd+K Search Overlay (V3)

**Files:**
- Create: `src/components/command-search.tsx`
- Create: `src/app/api/search-all/route.ts`
- Modify: `src/app/layout.tsx`

**Step 1: Create the unified search API endpoint**

```typescript
// src/app/api/search-all/route.ts
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.toLowerCase() || ""

  if (q.length < 2) {
    return NextResponse.json({ sessions: [], repos: [], skills: [] })
  }

  // Search sessions
  const sessionsRes = await fetch(`${req.headers.get("origin") || "http://localhost:3000"}/api/sessions`)
  const sessions = sessionsRes.ok ? await sessionsRes.json() : []
  const matchedSessions = sessions
    .filter((s: any) =>
      s.firstPrompt?.toLowerCase().includes(q) ||
      s.projectName?.toLowerCase().includes(q)
    )
    .slice(0, 5)

  // Search repos
  const reposRes = await fetch(`${req.headers.get("origin") || "http://localhost:3000"}/api/repos`)
  const repos = reposRes.ok ? await reposRes.json() : []
  const matchedRepos = repos
    .filter((r: any) => r.name?.toLowerCase().includes(q))
    .slice(0, 5)

  // Search skills
  const skillsRes = await fetch(`${req.headers.get("origin") || "http://localhost:3000"}/api/skills`)
  const skills = skillsRes.ok ? await skillsRes.json() : []
  const matchedSkills = skills
    .filter((s: any) => s.name?.toLowerCase().includes(q))
    .slice(0, 5)

  return NextResponse.json({
    sessions: matchedSessions,
    repos: matchedRepos,
    skills: matchedSkills,
  })
}
```

**Step 2: Create the search overlay component**

```typescript
// src/components/command-search.tsx
"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, MessageSquare, GitBranch, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchResult {
  sessions: any[]
  repos: any[]
  skills: any[]
}

export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult>({ sessions: [], repos: [], skills: [] })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery("")
      setResults({ sessions: [], repos: [], skills: [] })
      setSelectedIndex(0)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ sessions: [], repos: [], skills: [] })
      return
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/search-all?q=${encodeURIComponent(query)}`)
      if (res.ok) setResults(await res.json())
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const allItems = [
    ...results.sessions.map(s => ({ type: "session" as const, id: s.id, label: s.firstPrompt || s.id, sub: s.projectName, href: `/sessions/${s.id}` })),
    ...results.repos.map(r => ({ type: "repo" as const, id: r.name, label: r.name, sub: r.path, href: `/repos/${encodeURIComponent(r.name)}` })),
    ...results.skills.map(s => ({ type: "skill" as const, id: s.name, label: s.name, sub: s.source || "", href: `/skills` })),
  ]

  const handleSelect = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      handleSelect(allItems[selectedIndex].href)
    }
  }, [allItems, selectedIndex, handleSelect])

  if (!open) return null

  const iconMap = { session: MessageSquare, repo: GitBranch, skill: Sparkles }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search sessions, repos, skills..."
            className="flex-1 bg-transparent text-zinc-50 text-sm outline-none placeholder:text-zinc-500"
          />
          <kbd className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">esc</kbd>
        </div>

        {allItems.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {allItems.map((item, i) => {
              const Icon = iconMap[item.type]
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors",
                    i === selectedIndex ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:bg-zinc-800/50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.label}</div>
                    {item.sub && <div className="text-xs text-zinc-500 truncate">{item.sub}</div>}
                  </div>
                  <span className="text-xs text-zinc-600 capitalize">{item.type}</span>
                </button>
              )
            })}
          </div>
        )}

        {query.length >= 2 && allItems.length === 0 && (
          <div className="p-6 text-center text-zinc-500 text-sm">No results for "{query}"</div>
        )}

        {query.length < 2 && (
          <div className="p-6 text-center text-zinc-500 text-sm">
            Type to search across sessions, repos, and skills
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Mount in layout**

In `src/app/layout.tsx`, import and render the overlay:

```typescript
import { CommandSearch } from "@/components/command-search"
// Inside the layout body, after Sidebar:
<CommandSearch />
```

**Step 4: Verify**

Run: `bun dev`. Press Cmd+K — overlay opens. Type "deck" — see matching sessions and repos. Arrow down, Enter — navigates. Escape — closes.

**Step 5: Commit**

```bash
git add src/components/command-search.tsx src/app/api/search-all/route.ts src/app/layout.tsx
git commit -m "feat(v3): add Cmd+K global search overlay replacing /search page"
```

---

## Tasks 9–15: Feature Slices V4–V7 (Outlines)

These are built after V1–V3 ships. Each gets its own detailed plan when we reach it. Outlines here for scope awareness.

### Task 9–10: Setup Page (V4)
- Read CLAUDE.md (global + project) via API route scanning `~/.claude/` and scan dirs
- Read plugins from `~/.claude/plugins/cache/`
- Absorb MCP content from existing `/mcp` page
- Render: CLAUDE.md (markdown), Plugins list, MCP servers

### Task 11: Agents Page (V4)
- API route: scan all repos for `.claude/agents/*.md`
- Render: per-repo grouping, expandable content viewer

### Task 12: Memory Page (V4)
- API route: scan `~/.claude/projects/*/memory/MEMORY.md`
- Render: per-project cards, line counts, expandable content

### Task 13: Hooks Page (V4)
- API route: scan `~/.claude/hooks/` + per-project hooks
- Render: hook list with event badges, expandable source viewer

### Task 14: Work Graph Page (V5)
- API route: `git log`, `git status`, `git branch` across all scan dirs
- Render: commit activity chart, commits by repo bars, uncommitted work list, feature branches

### Task 15: Timeline Page (V5)
- API route: `git log --format` per repo
- Render: per-repo expandable commit history, color-coded by type

### Task 16: Snapshots Page (V5)
- API route: `git branch --show-current`, `git status --porcelain` per repo
- Render: table of repos with branch, dirty status, ahead/behind

### Task 17: Hygiene Page (V6)
- API route: `ps aux`, `git branch`, `git status`, `find`, file reads
- Scoring engine: base 100, subtract per issue type
- Render: health score gauge, expandable issue sections with action buttons

### Task 18: Dependencies Page (V6)
- API route: `npm outdated --json`, `npm audit --json`, package.json reads
- Render: Health tab (per-repo outdated/vulns), Graph tab (shared deps visualization)

### Task 19: Session Replay Scrubber (V7)
- New component: `src/components/session-replay.tsx`
- Timeline bar with event markers, playhead, play/pause, speed, step controls
- Files panel highlighting edits as playhead advances
- Mounted in `/sessions/[id]/page.tsx`

---

## Summary

| Task | Slice | What | Size |
|------|-------|------|------|
| 1 | V1 | Rewrite sidebar nav | S |
| 2 | V1 | Create 6 placeholder pages | S |
| 3 | V2 | Add bookmarks filter + export to Sessions | S |
| 4 | V2 | Add tabs to Costs (tokens, models) | M |
| 5 | V2 | Add About section to Settings | S |
| 6 | V2 | Delete 12 cut pages | S |
| 7 | V2 | Redirect /mcp to /setup | S |
| 8 | V3 | Build Cmd+K search overlay | M |
| 9–13 | V4 | Config depth (Setup, Agents, Memory, Hooks) | M |
| 14–16 | V5 | Workspace depth (Work Graph, Timeline, Snapshots) | L |
| 17–18 | V6 | Health (Hygiene, Dependencies) | L |
| 19 | V7 | Session Replay scrubber | L |
