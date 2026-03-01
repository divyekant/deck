---
shaping: true
---

# Deck v3 — Implementation Slices

Parent: [v3-reshaping.md](./v3-reshaping.md) (Shape C selected)

---

## Slice Summary

| # | Slice | What Ships | Demo |
|---|-------|-----------|------|
| V1 | Sidebar + Routes | New 19-item sidebar, all routes resolve, placeholder pages for new items | "New nav works, click every item" |
| V2 | Cuts + Absorptions | Delete 12 pages, migrate data into surviving pages | "All data accessible, no loss" |
| V3 | Cmd+K Search | Replace /search page with global overlay | "Cmd+K, type 'auth', see sessions + repos + skills" |
| V4 | Config Depth | Setup, Agents, Memory, Hooks pages | "Browse MEMORY.md across projects, see hook source code" |
| V5 | Workspace Depth | Work Graph, Timeline, Snapshots pages | "See uncommitted work across all repos at a glance" |
| V6 | Health Section | Hygiene + Dependencies pages | "Health score 72, 3 stale branches, 1 secret exposed" |
| V7 | Session Replay | Timeline scrubber on session detail | "Scrub through session, watch files light up" |

---

## V1: Sidebar + Routes

**Goal:** Ship the new navigation structure. Every nav item resolves. New pages show placeholder content. No functionality changes yet.

### What Changes

**New sidebar layout (19 items):**

```
Overview
  Home                    /                   (existing)

Monitor
  Live                    /live               (existing)
  Sessions                /sessions           (existing)
  Costs                   /costs              (existing)
  Setup                   /setup              (NEW — placeholder)
  Ports                   /ports              (existing)

Workspace
  Repos                   /repos              (existing)
  Work Graph              /work-graph         (NEW — placeholder)
  Repo Pulse              /pulse              (existing)
  Timeline                /timeline           (NEW — placeholder)
  Diffs                   /diffs              (existing)
  Snapshots               /snapshots          (NEW — placeholder)

Config
  Skills                  /skills             (existing)
  Agents                  /agents             (NEW — placeholder)
  Memory                  /memory             (NEW — placeholder)
  Hooks                   /hooks              (NEW — placeholder)

Health
  Hygiene                 /hygiene            (NEW — placeholder)
  Dependencies            /dependencies       (NEW — placeholder)

Bottom
  Settings                /settings           (existing)
  New Session             (existing button)
```

**Removed from sidebar (but pages still exist until V2):**
Search, Notifications, Activity, Bookmarks, Analytics, Tokens, Models, Insights, Commands, Export, About, Git

### Files to Create
- `src/app/setup/page.tsx` — placeholder
- `src/app/work-graph/page.tsx` — placeholder
- `src/app/timeline/page.tsx` — placeholder
- `src/app/snapshots/page.tsx` — placeholder
- `src/app/agents/page.tsx` — placeholder
- `src/app/memory/page.tsx` — placeholder
- `src/app/hooks/page.tsx` — placeholder
- `src/app/hygiene/page.tsx` — placeholder
- `src/app/dependencies/page.tsx` — placeholder

### Files to Modify
- `src/components/sidebar.tsx` — new nav structure with 5 sections

### Demo
Click every sidebar item. All 19 routes resolve. New pages show "Coming in V4/V5/V6" placeholders with the page name and description.

---

## V2: Cuts + Absorptions

**Goal:** Delete 12 pages. Migrate their data/UI into surviving pages. Zero data loss.

### Migration Map

| Cut Page | Destination | What Moves |
|----------|-------------|------------|
| `/search` | Cmd+K (V3) | Route removed, redirect to / |
| `/notifications` | Deleted | No data to migrate |
| `/activity` | Home dashboard | Activity feed widget already exists on Home |
| `/bookmarks` | `/sessions` | Add "Bookmarked" toggle filter to session table toolbar |
| `/analytics` | Home + `/costs` | Heatmap → Home widget. Efficiency tables → Costs |
| `/tokens` | `/costs` | Add "Tokens" tab to Costs page |
| `/models` | `/costs` | Add "Models" tab to Costs page |
| `/insights` | `/hygiene` (V6) | Concept moves to Health diagnostics |
| `/commands` | Deleted | Low-value, no migration needed |
| `/export` | `/sessions` | Add Export button to Sessions toolbar |
| `/about` | `/settings` | Add About/Changelog section to Settings |
| `/git` | `/repos` + `/timeline` (V5) | Git data → Repos drill-down + Timeline page |

### Changes to Existing Pages

**Sessions page gains:**
- Bookmarked filter toggle in toolbar (was separate /bookmarks page)
- Export button in toolbar (was separate /export page)
- Both use existing data — bookmarks from localStorage, export from existing export logic

**Costs page gains:**
- Tab bar: "Overview" | "Tokens" | "Models"
- Overview tab = current costs page content
- Tokens tab = content from /tokens page
- Models tab = content from /models page

**Home dashboard gains:**
- Analytics heatmap widget (from /analytics, if not already present)
- Activity feed stays as-is (already a dashboard widget)

**Settings page gains:**
- "About" section at bottom with changelog (from /about page)

### Files to Delete
- `src/app/search/page.tsx`
- `src/app/notifications/page.tsx`
- `src/app/activity/page.tsx`
- `src/app/bookmarks/page.tsx`
- `src/app/analytics/page.tsx`
- `src/app/tokens/page.tsx`
- `src/app/models/page.tsx`
- `src/app/insights/page.tsx`
- `src/app/commands/page.tsx`
- `src/app/export/page.tsx`
- `src/app/about/page.tsx`
- `src/app/git/page.tsx`

### Files to Modify
- `src/app/sessions/page.tsx` — add Bookmarks toggle + Export button
- `src/app/costs/page.tsx` — add tab bar (Overview/Tokens/Models)
- `src/app/settings/page.tsx` — add About section
- `src/app/page.tsx` (Home) — verify analytics widgets present

### Demo
Navigate the full app. All 12 old routes return 404 or redirect. Sessions has bookmark filter + export. Costs has three tabs. Settings shows changelog. No data lost.

---

## V3: Cmd+K Search

**Goal:** Replace the dedicated /search page with a global Cmd+K search overlay (like Readout's instant search).

### Affordances

| # | Affordance | Control | Behavior |
|---|------------|---------|----------|
| U1 | Cmd+K trigger | keyboard | Opens overlay |
| U2 | Search input | type | Debounced search across all data |
| U3 | Result categories | render | Sessions, Repos, Skills, Agents grouped |
| U4 | Result row | click | Navigate to item |
| U5 | Escape / click-outside | keyboard/click | Close overlay |
| N1 | searchAll() | call | Queries sessions, repos, skills, agents in parallel |
| N2 | Keyboard nav | j/k/Enter | Navigate and select results |

### Behavior
- Opens as a centered modal overlay (blocks interaction behind — it's a Place)
- Searches: sessions (by first prompt), repos (by name), skills (by name), agents (by name)
- Results grouped by category with icons
- Arrow keys or j/k to navigate, Enter to select
- Recent searches shown when input empty

### Files to Create
- `src/components/command-search.tsx` — the overlay component
- `src/app/api/search-all/route.ts` — unified search endpoint

### Files to Modify
- `src/components/keyboard-nav.tsx` — add Cmd+K handler
- `src/app/layout.tsx` — mount search overlay

### Demo
Press Cmd+K from any page. Type "auth". See sessions containing "auth" + repos + skills. Arrow down, press Enter, navigate to result.

---

## V4: Config Depth

**Goal:** Ship 4 new pages that make CC config fully browsable.

### Setup Page (`/setup`)

Reads and displays:
- **CLAUDE.md** — rendered markdown from project root + global
- **Plugins** — list installed plugins from `~/.claude/plugins/`
- **MCP Servers** — existing MCP page content moves here (replaces old /mcp route)

Data sources: filesystem reads via API routes

### Agents Page (`/agents`)

Reads and displays:
- Scan all repos for `.claude/agents/*.md` files
- Show per-repo grouping (like Readout: "apollo > agents > ...")
- Expandable to read agent file content

Data source: `find` across scan directories for `.claude/agents/`

### Memory Page (`/memory`)

Reads and displays:
- Scan all repos for `.claude/projects/*/memory/MEMORY.md`
- Show per-project with line count and expandable content
- Highlight which project has the most context

Data source: filesystem reads of MEMORY.md files

### Hooks Page (`/hooks`)

Reads and displays:
- Scan `~/.claude/hooks/` and per-project hooks directories
- Show hook name, event type (SessionStart, Stop, etc.), file path
- Expandable source code viewer with syntax highlighting
- Health indicator: 0 errors = healthy

Data source: filesystem + hook config files

### Files to Create
- `src/app/setup/page.tsx` — replace placeholder
- `src/app/agents/page.tsx` — replace placeholder
- `src/app/memory/page.tsx` — replace placeholder
- `src/app/hooks/page.tsx` — replace placeholder
- `src/app/api/setup/route.ts`
- `src/app/api/agents/route.ts`
- `src/app/api/memory/route.ts`
- `src/app/api/hooks/route.ts`

### Files to Modify
- `src/app/mcp/page.tsx` — content moves to Setup page, route redirects

### Demo
Open Setup — see CLAUDE.md rendered, plugins listed. Open Memory — see all MEMORY.md files across 10+ projects with content. Open Hooks — see 8 hooks with event types, expand one to see source code.

---

## V5: Workspace Depth

**Goal:** Ship 3 new pages for cross-repo git awareness.

### Work Graph Page (`/work-graph`)

Displays:
- **Stat cards**: Total repos, active (with commits in 30d), dormant, total commits
- **Commit Activity** (30d bar chart) — aggregate across all repos
- **Commits by Repo** — horizontal bar chart showing which repos are most active
- **Uncommitted Work** — list of repos with dirty working trees + file count
- **Feature Branches** — list of non-main branches across repos

Data source: `git log`, `git status`, `git branch` across scan directories

### Timeline Page (`/timeline`)

Displays:
- Per-repo expandable sections
- Full commit history with: hash, message, author, date, tags, branch
- Color-coded by conventional commit type (feat=green, fix=red, chore=grey, docs=blue)
- Filter by repo dropdown

Data source: `git log --format` across repos

### Snapshots Page (`/snapshots`)

Displays:
- **Stat cards**: Total repos, on feature branches, dirty count
- **Current Branches** table: repo name, current branch, dirty indicator, ahead/behind remote
- Quick view of "where did I leave each project?"

Data source: `git branch --show-current`, `git status --porcelain`, `git rev-list --count`

### Files to Create
- `src/app/work-graph/page.tsx` — replace placeholder
- `src/app/timeline/page.tsx` — replace placeholder
- `src/app/snapshots/page.tsx` — replace placeholder
- `src/app/api/work-graph/route.ts`
- `src/app/api/timeline/route.ts`
- `src/app/api/snapshots/route.ts`

### Demo
Open Work Graph — see 16 repos, 6 active in 30d, commit chart shows kai dominates. Uncommitted work shows 3 repos with dirty files. Open Snapshots — see all 16 repos with current branches, 2 on feature branches, 4 dirty.

---

## V6: Health Section

**Goal:** Ship 2 new pages that actively monitor environment health.

### Hygiene Page (`/hygiene`)

Displays:
- **Health Score** — circular gauge (0-100) based on weighted issues
- **Issue counts**: Critical (red), Warning (yellow), Info (blue)
- **Sections** (expandable, each with count badge):
  - Zombie Processes — orphaned node/python processes with Kill button
  - Stale Branches — worktree-agent branches older than 7d with Delete button
  - Uncommitted Changes — repos with dirty working trees
  - Diverged from Remote — repos ahead/behind origin
  - Disk Usage — large `.claude/` directories
  - Dirty Worktrees — `.claude/worktrees/` with uncommitted changes
  - Env Exposure — `.env` files NOT in `.gitignore`
  - Config Lint — CLAUDE.md issues (line truncation at 200, missing sections)

Scoring:
- Zombie process: -10 per process (Critical)
- Stale branch: -3 per branch (Warning)
- Uncommitted changes: -2 per repo (Warning)
- Diverged: -2 per repo (Warning)
- Env exposure: -15 per file (Critical)
- Config lint issue: -1 per issue (Info)
- Base: 100

Data sources: `ps aux`, `git branch`, `git status`, `git rev-list`, `du -sh`, `find`, file reads

### Dependencies Page (`/dependencies`)

Two tabs:
- **Health** — Scan repos with package.json/pyproject.toml. Show outdated/major/vulns per repo
- **Graph** — Cross-repo dependency visualization (which repos share dependencies)

Data sources: `npm outdated --json`, `npm audit --json`, package.json reads

### Files to Create
- `src/app/hygiene/page.tsx` — replace placeholder
- `src/app/dependencies/page.tsx` — replace placeholder
- `src/app/api/hygiene/route.ts`
- `src/app/api/dependencies/route.ts`

### Demo
Open Hygiene — health score 68. 2 Critical (zombie process, exposed .env). 5 Warnings (stale branches). Click Kill on zombie process — score improves. Open Dependencies — all packages current, graph shows HiveBuild and deck share 3 deps.

---

## V7: Session Replay Scrubber

**Goal:** Add timeline scrubber with playback controls to the session detail page.

### Affordances

| # | Affordance | Control | Behavior |
|---|------------|---------|----------|
| U1 | Timeline bar | render | Visual timeline of all events in session |
| U2 | Event markers | render | Ticks on timeline for each prompt/tool-call/file-change |
| U3 | Playhead | drag | Scrub to any point in session |
| U4 | Play/Pause | click | Auto-advance through events |
| U5 | Speed control | click | 1x, 2x, 4x playback speed |
| U6 | Step forward/back | click | Move one event at a time |
| U7 | Files panel | render | Files modified, light up as playhead passes their edit |
| U8 | Event counter | render | "Event 47 / 138" |
| N1 | Timeline state | store | Current position, playing, speed |
| N2 | Auto-advance timer | interval | Moves playhead based on speed |
| N3 | Event index | computed | Maps position to conversation messages |

### Behavior
- Timeline shows full session duration with markers for each event
- Events: user messages (blue), assistant messages (green), tool calls (yellow), file edits (orange)
- Dragging playhead scrolls conversation to that point
- Files panel shows modified files; they highlight as the playhead passes their edit event
- Play auto-advances, pausing at each event for (baseDuration / speed) seconds
- Conversation below scrolls to match playhead position

### Integration
- Added to existing `/sessions/[id]/page.tsx`
- Timeline sits between session header and conversation
- Can be collapsed to return to static view

### Files to Create
- `src/components/session-replay.tsx` — timeline + playback controls
- `src/components/replay-files-panel.tsx` — file highlight panel

### Files to Modify
- `src/app/sessions/[id]/page.tsx` — mount replay component

### Demo
Open any session detail. See timeline bar with event markers. Click Play — conversation auto-scrolls, files light up as edits happen. Drag playhead to middle — jump to that point. Click 4x — fast forward. Step through one event at a time.

---

## Build Order & Dependencies

```
V1 (Sidebar + Routes)
 ↓
V2 (Cuts + Absorptions)  ←  depends on V1 (new sidebar must exist before cutting old pages)
 ↓
V3 (Cmd+K Search)        ←  depends on V2 (search page deleted, overlay replaces it)
 ↓ (parallel from here)
V4 (Config Depth)         ←  independent, replaces placeholders
V5 (Workspace Depth)      ←  independent, replaces placeholders
V6 (Health Section)       ←  independent, replaces placeholders
V7 (Session Replay)       ←  independent, enhances existing page
```

V1 → V2 → V3 are sequential. V4, V5, V6, V7 can be built in parallel after V3.

---

## Effort Estimate (Relative)

| Slice | Size | Notes |
|-------|------|-------|
| V1 | S | Mostly sidebar.tsx changes + 9 placeholder pages |
| V2 | M | 12 deletions + 4 page modifications (tabs, filters, sections) |
| V3 | M | New overlay component + unified search API |
| V4 | M | 4 new pages + 4 API routes, all reading local files |
| V5 | L | 3 new pages + 3 API routes, git command orchestration |
| V6 | L | 2 new pages + 2 API routes, process scanning + scoring logic |
| V7 | L | Complex UI component with timeline, playback, file tracking |
