---
shaping: true
---

# Deck v3 Navigation Reshaping

## Source

> Readout competitive analysis (2026-03-01): After installing and screenshotting all 37 pages of Readout v0.0.5, comparison revealed Deck has ~11 redundant/low-value pages while missing Readout's entire Health section (5 pages), Config depth (Agents, Memory, Hooks), and key Workspace features (Work Graph, Snapshots, Timeline, Session Replay scrubber).
>
> User observation: "the app they have created is pretty smooth, ours is too, but can be better and little less cluttered and smoother nav"
>
> Full analysis: docs/readout-comparison.md

---

## Problem

Deck v2 over-invested in analytics slicing (Tokens, Models, Insights, Analytics, Commands — 5 pages that reframe the same cost/session data differently) and under-invested in environment health, config visibility, and git awareness. The result is 22 nav items where ~11 don't earn their slot, while genuinely useful features that Readout proves developers want are completely absent.

## Outcome

Deck v3 has a focused, non-redundant navigation where every page serves a unique, actionable purpose. The app shifts from "here are your numbers in 8 views" to "is your environment healthy, what changed, and how are you configured?" — matching the developer awareness posture that Readout validates.

---

## Requirements (R)

| ID | Requirement | Status |
|----|-------------|--------|
| R0 | Every nav item must serve a unique, actionable purpose — no redundant pages that reframe the same data | Core goal |
| R1 | Environment health monitoring: surface zombie processes, stale branches, uncommitted changes, dirty worktrees, secret exposure, dependency health | Must-have |
| R2 | Config visibility: browse Skills, Agents, Memory, Hooks across all projects without opening a terminal | Must-have |
| R3 | Git/workspace awareness: cross-repo commit activity, current branch state, uncommitted work, feature branches | Must-have |
| R4 | Session replay with timeline scrubber and playback controls (not just static conversation view) | Must-have |
| R5 | Preserve Deck's unique strengths that Readout lacks: session annotations, bulk operations, keyboard shortcuts, cost forecasting, session launcher | Must-have |
| R6 | Nav item count stays at ~20 or fewer (no net bloat from adding features) | Must-have |
| R7 | Migration path: existing users don't lose access to data currently shown in cut pages — data moves to surviving pages | Must-have |
| R8 | Setup/config page: CLAUDE.md viewer, Plugins list, Hooks overview in one place | Must-have |

---

## CURRENT: Deck v2 Navigation (22 items)

| Part | Mechanism |
|------|-----------|
| **Overview (5)** | Home, Search, Notifications, Activity, Bookmarks |
| **Monitor (8)** | Live, Sessions, Costs, Analytics, Tokens, Models, Insights, Commands |
| **Workspace (4)** | Repos, Pulse, Diffs, Git |
| **Config (5)** | MCP Servers, Ports, Skills, Export, About |
| **Other** | Settings, New Session |

**Problems with CURRENT:**
- Tokens, Models, Analytics, Insights = 4 pages slicing the same cost/session data
- Commands = low-frequency, niche use
- Notifications = no clear trigger source for a local tool
- Activity (page) = dashboard widget, not a page
- Bookmarks (page) = should be a Sessions filter
- Export (page) = should be a toolbar action
- About (page) = belongs in Settings
- Git (page) = overlaps with Repos
- No Health section at all
- Config shows Skills only — no Agents, Memory, Hooks visibility

---

## Shapes Considered

### A: Minimal Trim

Just cut redundant pages, merge data into surviving pages. No new features.

| Part | Mechanism |
|------|-----------|
| A1 | Cut 11 pages (Tokens, Models, Analytics, Insights, Commands, Notifications, Activity, Bookmarks, Export, About, Git) |
| A2 | Merge token/model data into Costs as tabs |
| A3 | Merge Bookmarks as Sessions filter, Export as Sessions toolbar action |
| A4 | Move About into Settings, merge Git into Repos |

**Result:** ~11 nav items. Leaner but still no Health, no Config depth, no git awareness.

### B: Readout Mirror

Cut redundant + add all Readout features 1:1 (5 Health pages, full Config, all Workspace features).

| Part | Mechanism |
|------|-----------|
| B1 | All cuts from A |
| B2 | Add 5 Health pages: Hygiene, Deps, Worktrees, Env, Lint |
| B3 | Add Config: Agents, Memory, Hooks, Setup |
| B4 | Add Workspace: Work Graph, Timeline, Snapshots |
| B5 | Add Session Replay scrubber to Diffs/Session Detail |

**Result:** ~22 nav items. Every page earns its slot but Health section is too granular for a web app (5 pages that could be 2).

### C: Focused Rebuild (Selected)

Cut redundant + add Health and Config depth, but consolidate Readout's granular pages into fewer, richer views. Web app can show tabs/sections that a native app splits across pages.

| Part | Mechanism |
|------|-----------|
| **C1** | **Cut 12 pages**: Search (page), Notifications, Activity (page), Bookmarks (page), Analytics, Tokens, Models, Insights, Commands, Export (page), About (page), Git (page) |
| **C2** | **Absorb cut data into survivors**: Tokens/Models → Costs tabs, Bookmarks → Sessions filter, Export → Sessions toolbar, About → Settings section, Analytics heatmap → Home dashboard, Git → Repos detail, Search → Cmd+K overlay, Commands → remove (low value) |
| **C3** | **Add Health section (2 pages)**: Hygiene (consolidated health score + zombie processes, stale branches, uncommitted changes, diverged from remote, disk usage, dirty worktrees, env exposure, lint issues) + Dependencies (package health + cross-repo dependency graph) |
| **C4** | **Deepen Config (3 new pages)**: Agents viewer, Memory viewer, Hooks viewer — browse across all projects |
| **C5** | **Add Setup page**: CLAUDE.md viewer, Plugins list, Hooks overview in Monitor section |
| **C6** | **Add Workspace features (3 new pages)**: Work Graph (commit activity, uncommitted work, feature branches), Timeline (git history per repo), Snapshots (current branch state across repos) |
| **C7** | **Session Replay scrubber**: Add timeline scrubber with playback controls to Session Detail page |
| **C8** | **Global search overlay**: Replace Search page with Cmd+K spotlight-style search across sessions, repos, skills, agents |
| **C9** | **Preserve Deck originals**: Session annotations, bulk operations, keyboard shortcuts (j/k/Enter), cost forecasting, New Session launcher all stay |

---

## Shape C: Final Navigation (19 items)

```
Overview (1)
  Home              dashboard with greeting, stats, activity, budget,
                    cost by model, when you work, streak, recent sessions
                    (absorbs Analytics heatmap, Activity feed)

Monitor (5)
  Live              active sessions with project, model, elapsed time
  Sessions          session table + filters + Bookmarks toggle + Export button
                    + bulk operations + keyboard nav + annotations
  Costs             cost breakdown + Tokens tab + Models tab + forecasting
  Setup             CLAUDE.md viewer, Plugins, MCP servers overview
  Ports             open ports with process info

Workspace (6)
  Repos             per-project cards + drill-down (CLAUDE.md, Skills, Memory per repo)
  Work Graph        commit activity across repos, uncommitted work, feature branches
  Repo Pulse        health scan: attention/clean categorization, file counts
  Timeline          git commit history per repo with tags, branches, messages
  Diffs             sessions with file changes + Session Replay scrubber
  Snapshots         current branch state across all repos

Config (4)
  Skills            searchable skill browser, global + per-project, content preview
  Agents            agent .md files per repo
  Memory            MEMORY.md per project, expandable
  Hooks             all hooks with event types, source code viewer

Health (2)
  Hygiene           health score + zombie processes, stale branches, uncommitted
                    changes, diverged from remote, disk usage, dirty worktrees,
                    env file exposure, config lint issues
  Dependencies      package health (outdated/vulns) + cross-repo dependency graph

Bottom
  Settings          budget, theme, scan dirs, About/changelog section
  New Session       session launcher (Deck exclusive)
```

**Total: 19 nav items** (down from 22, with 7 genuinely new features replacing 12 cut)

---

## Cut Pages — Migration Map

| Cut Page | Where Data Goes |
|----------|----------------|
| Search (page) | Cmd+K global overlay |
| Notifications | Removed entirely (no use case) |
| Activity (page) | Home dashboard activity widget |
| Bookmarks (page) | Sessions page filter toggle |
| Analytics | Home dashboard (heatmap) + Costs page (efficiency tables) |
| Tokens | Costs page "Tokens" tab |
| Models | Costs page "Models" tab |
| Insights | Hygiene page health diagnostics |
| Commands | Removed (low value) |
| Export (page) | Sessions page toolbar button |
| About | Settings page section |
| Git | Repos drill-down + Timeline page |

---

## Fit Check: R x C

| Req | Requirement | Status | C |
|-----|-------------|--------|---|
| R0 | Every nav item serves unique, actionable purpose | Core goal | ✅ |
| R1 | Environment health monitoring (zombies, stale branches, secrets, deps) | Must-have | ✅ |
| R2 | Config visibility (Skills, Agents, Memory, Hooks browsable) | Must-have | ✅ |
| R3 | Git/workspace awareness (cross-repo commits, branches, uncommitted) | Must-have | ✅ |
| R4 | Session replay with timeline scrubber | Must-have | ✅ |
| R5 | Preserve Deck strengths (annotations, bulk ops, kbd, forecast, launcher) | Must-have | ✅ |
| R6 | Nav count ~20 or fewer | Must-have | ✅ |
| R7 | Migration path for cut pages | Must-have | ✅ |
| R8 | Setup page (CLAUDE.md, Plugins, Hooks overview) | Must-have | ✅ |

**Notes:**
- R0: 19 items, each unique. Tokens/Models/Analytics/Insights consolidated into Costs tabs + Home widgets. No page overlaps.
- R1: Hygiene page consolidates what Readout splits across 5 pages (Hygiene, Worktrees, Env, Lint) into one rich view. Dependencies page handles package health + graph.
- R2: 4 Config pages (Skills, Agents, Memory, Hooks) give full CC config visibility.
- R3: Work Graph + Timeline + Snapshots + Repo Pulse = 4 workspace views covering all git awareness.
- R4: C7 adds timeline scrubber to Session Detail (reached via Diffs or Sessions).
- R5: C9 explicitly preserves all Deck originals. Sessions page keeps annotations, bulk ops, keyboard nav. Costs keeps forecasting. New Session stays.
- R6: 19 items (under 20 target).
- R7: Migration map covers all 12 cut pages with explicit destinations.
- R8: Setup page in Monitor section shows CLAUDE.md + Plugins + MCP overview.

All requirements pass. Shape C selected.

---

## What's New vs What's Changed vs What's Kept

### New Pages (7)
1. Setup (Monitor)
2. Work Graph (Workspace)
3. Timeline (Workspace)
4. Snapshots (Workspace)
5. Agents (Config)
6. Memory (Config)
7. Hooks (Config)
8. Hygiene (Health)
9. Dependencies (Health)

*Note: 9 new pages but 12 cut, net -3*

### Changed Pages (5)
1. **Home** — absorbs Analytics heatmap, Activity feed
2. **Sessions** — gains Bookmarks filter toggle, Export toolbar button
3. **Costs** — gains Tokens tab, Models tab (keeps forecasting)
4. **Repos** — gains rich drill-down (CLAUDE.md, Skills, Memory per repo), absorbs Git data
5. **Diffs** — gains Session Replay scrubber on detail view

### Kept As-Is (5)
1. Live
2. Ports
3. Skills
4. Repo Pulse
5. Settings (gains About section) + New Session

### Search UX Change
- **Before**: Dedicated /search page
- **After**: Cmd+K global overlay searching sessions, repos, skills, agents (like Readout's instant search)
