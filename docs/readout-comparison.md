# Readout vs Deck — Competitive Analysis

**Date:** 2026-03-01
**Readout version:** v0.0.5 (native macOS, Swift)
**Deck version:** v2.0.0 (web app, Next.js)
**Source:** 37 screenshots of every Readout page + Deck codebase audit

---

## Readout's Full Navigation (21 items)

### Overview
- **Readout** — Dashboard with greeting, stat cards (Repos, Commits Today, Sessions, Est. Cost), Budget tracker, Activity chart (30d), When You Work (hourly distribution), Cost by Model, Recent Sessions

### Monitor (5)
- **Live** — Active sessions with project, model, elapsed time, memory usage. Stat cards: Sessions, MBs, Active count
- **Sessions** — Session list (reads `~/.claude/stats-cache.json` and `~/.claude/history.jsonl`)
- **Costs** — Cost breakdown (was loading/broken in screenshots)
- **Setup** — CLAUDE.md viewer, Plugins list with install status, Hooks list with event types (SessionStart, Stop, etc.)
- **Ports** — Open ports with PID, process command, binding address. Kill button per process

### Workspace (6)
- **Repos** — All repos with session count, model badges, last active, sparkline activity charts. Drill-down shows CLAUDE.md, Skills, Memory per repo
- **Work Graph** — Commit activity (30d bar chart), Commits by Repo (horizontal bars), Uncommitted Work list, Feature Branches list, All Repos
- **Repo Pulse** — Health scan: "X repos scanned, Y need attention, Z clean". Shows dirty files per repo, expandable file lists. Clean/attention categorization
- **Timeline** — Full git commit history per repo with commit hashes, messages, tags, branch labels. Color-coded by type (feat, fix, chore, docs)
- **Diffs** — Sessions with file changes. Stat cards: sessions count, files modified total. Expandable per session showing exact file paths. Drill into Session Replay
- **Snapshots** — Current branch state across ALL repos. Shows branch name, dirty indicators, repo count

### Config (4)
- **Skills** — Searchable skill browser with "Add from folder" button. Tree view: Global → per-project. Full skill content preview with syntax highlighting
- **Agents** — Agent `.md` files per repo (empty state: "Agents live in each repo's .claude/agents/ folder")
- **Memory** — MEMORY.md content per project. Expandable, shows full text. "X lines of context across Y projects"
- **Hooks** — All hooks with event type badges (SessionStart, Stop, etc.), file paths, expandable source code viewer

### Health (5)
- **Hygiene** — Health score circle (0-100) with Critical/Warning/Info counts. Categories: Zombie Processes (with Kill button), Stale Branches (Delete button), Uncommitted Changes, Diverged from Remote, Disk Usage, Dirty Worktrees. **"Diagnose with Claude"** button (Brief/Detailed/Copy)
- **Deps** — Two views: Health (outdated/major/vulns per repo) + Graph (dependency flow between repos, cross-repo links). Shows package manager per repo
- **Worktrees** — Active worktrees per repo with file counts, uncommitted status, worktree paths
- **Env** — Env files across repos. Issues panel flagging secrets NOT in .gitignore. Shows variable count per file, .gitignore status badges
- **Lint** — CLAUDE.md/config linter. Issues count, lines/size per file. Expandable showing actual content with issue highlights

### Settings
- Scan Directories (which folders to monitor)
- Launch at login toggle
- Background monitoring alerts toggle
- Check for updates automatically
- Cost Budget (Daily/Monthly slider)

---

## Deck's Full Navigation (22 items + New Session)

### Overview (5)
- **Home** — Dashboard with greeting, stats, charts, budget, streak, highlights, digest, favorites
- **Search** — Full-text session search
- **Notifications** — Alert center
- **Activity** — Activity feed
- **Bookmarks** — Starred sessions

### Monitor (8)
- **Live** — Active sessions
- **Sessions** — Session table with filters, grouping, bulk actions, keyboard nav
- **Costs** — Cost breakdown with forecast, optimization tips
- **Analytics** — Heatmap, tag analytics, efficiency tables, duration trends
- **Tokens** — Token consumption analysis
- **Models** — Model statistics, monthly trends
- **Insights** — AI-generated insights
- **Commands** — Command history

### Workspace (4)
- **Repos** — Per-project cards
- **Pulse** — Project health metrics
- **Diffs** — File changes
- **Git** — Git analytics

### Config (5)
- **MCP Servers** — MCP management
- **Ports** — Port monitoring
- **Skills** — Skills catalog
- **Export** — Data export
- **About** — Changelog

### Other
- **Settings** — Budget, theme
- **New Session** — Session launcher

---

## Head-to-Head Feature Comparison

### Where They Overlap (Core Features)
| Feature | Readout | Deck |
|---------|---------|------|
| Dashboard overview | Yes | Yes |
| Live session monitoring | Yes | Yes |
| Session list | Yes | Yes |
| Cost tracking | Yes | Yes |
| Repos | Yes (richer) | Yes |
| Diffs | Yes | Yes |
| Skills viewer | Yes (richer) | Yes |
| Ports | Yes | Yes |
| Settings/Budget | Yes | Yes |

### What Readout Has That Deck Doesn't

| Feature | What It Does | Why It Matters |
|---------|-------------|----------------|
| **Setup** | CLAUDE.md viewer, Plugins, Hooks | See your CC config at a glance — no terminal needed |
| **Work Graph** | Commits by repo, uncommitted work, feature branches | Cross-repo awareness. "What's in flight across all my projects?" |
| **Repo Pulse** | Health scan with attention/clean categorization | Actionable: tells you which repos need cleanup |
| **Git Timeline** | Full commit history per repo with tags/branches | Visual git log across all repos in one place |
| **Snapshots** | Current branch state across all repos | "Where did I leave each project?" at a glance |
| **Session Replay** | Timeline scrubber with playback, speed control, file highlights | Killer UX for reviewing what CC did — Deck has detail but no scrubber |
| **Agents viewer** | Agent .md files per repo | Visibility into agent configs |
| **Memory viewer** | MEMORY.md per project | See what CC remembers without opening files |
| **Hooks viewer** | All hooks with source code | Debug hook problems visually |
| **Hygiene** | Health score + zombie processes, stale branches, uncommitted, diverged, disk, dirty worktrees | **Entire category Deck is missing.** Actively maintains your environment |
| **Dependencies** | Health (outdated/vulns) + Graph (cross-repo flow) | Package health across all projects |
| **Worktrees** | Active worktrees with file counts | Manage CC-created worktrees that accumulate |
| **Env** | Env file scanner, .gitignore warnings, secret exposure | Security: finds leaked secrets |
| **Lint** | CLAUDE.md/config quality checker | Catches config issues (line truncation, missing sections) |
| **Diagnose with Claude** | AI button on Hygiene page | Smart context-aware diagnostics |
| **Repo drill-down** | CLAUDE.md + Skills + Memory per repo | Rich per-project detail view |

**That's 16 features Readout has that Deck doesn't.** The entire **Health** section (5 pages) and most of the **Config** section depth are absent from Deck.

### What Deck Has That Readout Doesn't

| Feature | Assessment |
|---------|-----------|
| **Search** (dedicated page) | Readout has Cmd+K global search instead — arguably better UX |
| **Notifications** | No clear use case. Readout doesn't need it |
| **Activity** (page) | Dashboard covers this. Unnecessary as standalone page |
| **Bookmarks** (page) | Should be a filter on Sessions, not a page |
| **Analytics** (page) | Dashboard widgets cover this. Readout chose not to split |
| **Tokens** (page) | Subset of Costs. Redundant |
| **Models** (page) | Dashboard widget. Doesn't need a page |
| **Insights** (page) | Readout's "Diagnose with Claude" is more focused/useful |
| **Commands** (page) | Niche. Most users won't revisit command history |
| **MCP Servers** (page) | Readout may fold this into Setup or a future update |
| **Export** (page) | Should be a button/action, not a nav item |
| **About** (page) | Readout shows version in Settings footer |
| **New Session** | Readout is read-only/monitoring. Deck adds session launching |
| **Session annotations** | Tags, notes, bookmarks on sessions. Readout doesn't have |
| **Bulk operations** | Multi-select, batch tag, batch export. Readout doesn't have |
| **Keyboard shortcuts** | Vim-style nav, command palette. Readout is mouse-native |
| **Cost forecasting** | Projects future spend. Readout doesn't forecast |

---

## Key Insights

### 1. Philosophy Divergence

**Readout** organizes around **awareness and health:**
- "Is my environment healthy?" → Hygiene, Deps, Env, Lint
- "What's happening now?" → Live, Ports
- "What's changed?" → Diffs, Timeline, Snapshots, Work Graph
- "How am I configured?" → Setup, Skills, Agents, Memory, Hooks

**Deck** organizes around **analytics and slicing:**
- "How much did I spend?" → Costs, Tokens, Models, Analytics
- "What patterns exist?" → Insights, Activity, Heatmaps
- "What sessions matter?" → Bookmarks, Search, Commands

Readout answers: "Is everything OK?" → then shows you what to fix.
Deck answers: "Here are your numbers" → in 8 different views.

### 2. Deck's Biggest Gaps

**The entire Health section is missing.** Readout has 5 pages dedicated to environment health:
- Hygiene (score + actionable issues)
- Dependencies (outdated packages, vulnerability scanning)
- Worktrees (visibility into accumulated worktrees)
- Env (secret exposure warnings)
- Lint (config quality)

This is arguably the most *useful* section of Readout — it helps developers **maintain** their environment, not just **observe** it.

**Config depth is shallow.** Deck shows Skills but not Agents, Memory, Hooks, or a unified Setup view. Readout makes the entire CC config browsable.

**Repo drill-down is thin.** Readout's repo detail shows CLAUDE.md + Skills + Memory for each project. Deck shows sessions and costs per project but not the config layer.

### 3. Deck's Over-Engineering (What to Cut)

These Deck pages don't earn their nav slot:

| Page | Verdict | Action |
|------|---------|--------|
| **Tokens** | Redundant with Costs | Merge into Costs as a tab |
| **Models** | Dashboard widget, not a page | Merge into Costs or remove |
| **Analytics** | Overlaps with Home dashboard | Merge key charts into Home |
| **Insights** | Vague without real AI processing | Replace with Hygiene-style actionable checks |
| **Commands** | Low-frequency use | Remove or fold into Sessions |
| **Notifications** | No clear trigger source | Remove entirely |
| **Activity** (page) | Dashboard covers it | Remove — keep dashboard widget |
| **Bookmarks** (page) | Should be a filter | Make it a toggle on Sessions |
| **Export** (page) | Should be a button | Move to Sessions toolbar |
| **About** | Low traffic | Move into Settings |
| **Git** (separate page) | Overlaps with Repos | Merge into Repos detail |

**That's 11 pages to cut or merge.** Deck would go from 22 nav items to ~11.

### 4. What Deck Should Build Instead

Priority order based on Readout's strengths and Deck's gaps:

1. **Hygiene / Health Score** — The #1 missing feature. A health dashboard showing zombie processes, stale branches, uncommitted changes, env issues. Actionable, not just observational.

2. **Session Replay with Timeline Scrubber** — Deck has session detail but no playback controls. Readout's scrubber with speed control and file highlight is a killer feature.

3. **Config Visibility** (Setup page) — Show CLAUDE.md, Plugins, Hooks in one view. Users shouldn't need to open a terminal to see their config.

4. **Memory/Agents/Hooks Viewers** — Browse CC's memory, agents, and hooks across projects. High-value, low-effort reads of files that already exist on disk.

5. **Work Graph** — Cross-repo commit activity, uncommitted work, feature branches. "What's in flight?" across all projects.

6. **Snapshots** — Current branch state across all repos. Quick "where did I leave things?" view.

7. **Dependencies Health + Graph** — Package health scanning with cross-repo dependency flow visualization.

8. **Env Scanner** — Find .env files not in .gitignore. Security feature that actively protects the user.

---

## Proposed Deck v3 Navigation (after cuts + additions)

```
Overview
  Readout (dashboard — merge Activity, Analytics widgets here)

Monitor
  Live
  Sessions (absorb Bookmarks as filter, Export as button)
  Costs (absorb Tokens, Models as tabs)
  Setup (NEW — CLAUDE.md, Plugins, Hooks viewer)
  Ports

Workspace
  Repos (absorb Git, repo drill-down with CLAUDE.md/Skills/Memory)
  Work Graph (NEW)
  Repo Pulse
  Timeline (NEW — git history across repos)
  Diffs (with Session Replay scrubber)
  Snapshots (NEW)

Config
  Skills
  Agents (NEW)
  Memory (NEW)
  Hooks (NEW)

Health (NEW section)
  Hygiene (NEW — health score + actionable issues)
  Deps (NEW — package health + dependency graph)
  Worktrees (NEW)
  Env (NEW — secret exposure scanner)
  Lint (NEW — config quality checker)

Settings
```

**Result:** 22 items, but now every single one earns its place with a unique, actionable purpose. No redundancy. Adds the entire Health section and Config depth that Readout has proven valuable.

---

## Summary

| Metric | Readout | Deck |
|--------|---------|------|
| Nav items | 21 | 22 |
| Redundant pages | 0 | ~11 |
| Health/maintenance features | 5 pages | 0 pages |
| Config visibility | Deep (Skills, Agents, Memory, Hooks) | Shallow (Skills only) |
| Session replay | Timeline scrubber with playback | Static conversation view |
| Git visibility | Timeline + Work Graph + Snapshots | Basic "Git" page |
| Analytics depth | Dashboard widgets (focused) | 4+ pages (scattered) |
| Form factor | Native macOS (Swift) | Web app (Next.js) |
| Data source | Local files only | Local files only |
| Price | Free | Self-hosted |

**Bottom line:** Deck has more pages but less substance. Readout has fewer pages but each one is deeply useful. Deck over-invested in analytics slicing (Tokens, Models, Insights, Analytics, Commands) and under-invested in environment health, config visibility, and git awareness. The path forward is to cut the redundant analytics pages and build the Health section + Config depth that Readout proves developers actually want.
