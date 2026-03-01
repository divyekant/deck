# Architecture

## Overview

Deck is a local-first dashboard for Claude Code, built with Next.js 15 using the App Router. It reads session data directly from `~/.claude/projects/` on the filesystem -- there is no database, no cloud sync, and no telemetry. Everything runs on your machine.

The application serves a single purpose: give you visibility into your Claude Code and Codex usage -- sessions, costs, activity patterns, and the ability to launch new sessions from the browser.

## Data Flow

```
~/.claude/projects/          Filesystem (session JSONL files)
        |
        v
src/lib/claude/              Core data layer: parse, compute costs, detect live sessions
        |
        v
src/app/api/                 API routes: read filesystem, return JSON via NextResponse
        |
        v
src/app/                     Pages: fetch from /api/, render with React components
```

1. Claude Code writes session data as JSONL files under `~/.claude/projects/<project>/sessions/`.
2. The core data layer (`src/lib/claude/`) reads and parses these files, calculates token costs, and detects running sessions via process inspection.
3. API routes under `src/app/api/` expose this data as JSON endpoints.
4. Pages fetch from these API routes on the client side and render the UI.

All data flows in one direction: filesystem to API to UI. The only write path is session launching, which spawns a CLI process.

## Directory Structure

```
src/
  app/                       Pages and API routes (App Router conventions)
    api/                     All API endpoints (/api/sessions, /api/costs, /api/projects, etc.)
    sessions/                Session list and detail pages
    costs/                   Cost analytics page
    repos/                   Per-project breakdown
    live/                    Live session monitoring
    settings/                User preferences
    ...
  components/                Shared UI components
    sidebar.tsx              Fixed 240px collapsible sidebar with navigation
    command-palette.tsx      Cmd+K command palette for quick navigation
    status-bar.tsx           Global status bar (live session count, costs, version)
    mobile-nav.tsx           Bottom navigation for mobile viewports
    message-view.tsx         Conversation message renderer (user, assistant, tool calls)
    tool-call-view.tsx       Expandable tool call detail view
    session-card.tsx         Session summary card with color-coded project dot
    activity-chart.tsx       Activity heatmap and charts
    cost-breakdown.tsx       Cost visualization components
    stats-card.tsx           Metric display card
    ui/                      Base UI primitives (shadcn/ui)
  lib/
    claude/                  Core data layer
      parser.ts              JSONL session file parser
      sessions.ts            Session listing, filtering, and aggregation
      costs.ts               Token cost calculation by model
      process.ts             Live session detection and CLI process spawning
      types.ts               TypeScript type definitions for session data
      export.ts              Session export utilities
    format.ts                Number, date, and duration formatting
    project-colors.ts        Deterministic project-to-color mapping (10-color palette)
    utils.ts                 General utilities
    settings.ts              User preference persistence (~/.deck/)
    ...
```

## Key Architectural Decisions

### No database

All data is read directly from the filesystem. Claude Code already writes structured session files; duplicating that into a database would add complexity, sync issues, and storage overhead for no benefit. The tradeoff is that queries are bounded by filesystem I/O, but for a local dashboard this is more than sufficient.

### No telemetry

Deck collects nothing. No analytics, no crash reporting, no phone-home behavior. Session data stays on your machine.

### Docker deployment

The recommended deployment uses Docker with volume mounts to access the host filesystem. The Docker image includes `node:22-alpine` with Claude Code and Codex CLI tools installed globally, so session launching works from inside the container.

Key volume mounts:
- `~/.claude` (read-only) -- session data
- `~/.codex` (read-only) -- Codex session data
- `~/.deck` (read-write) -- user preferences and bookmarks
- `~/Projects` (read-only) -- project directories for session launching

### Project paths mounted from host

For session launching to work in Docker, the actual project directories must be volume-mounted into the container at the same paths the host uses. This allows the spawned CLI process to operate on the real project files.

## Component Architecture

### Root Layout

The root layout (`src/app/layout.tsx`) establishes the application shell:

```
ThemeProvider
  +-- flex h-screen container
  |     +-- Sidebar (fixed 240px, collapsible)
  |     +-- main (flex-1, scrollable, padded)
  |           +-- {page content}
  +-- StatusBar (fixed bottom bar)
  +-- MobileNav (bottom nav, visible on small screens)
  +-- CommandPalette (Cmd+K overlay)
  +-- KeyboardNav (global keyboard shortcut handler)
```

### Theming

Dark theme by default using the zinc palette. The `ThemeProvider` component wraps the entire application. Colors follow a zinc-based scale for surfaces and borders, with a 10-color accent palette assigned deterministically per project for visual identification.

### Sidebar

Fixed 240px width (`w-60`), collapsible. Contains navigation links to all pages, a favorites bar for pinned sessions, and project filtering. The sidebar is hidden on mobile viewports and replaced by `MobileNav`.

## API Layer

All API routes live under `src/app/api/`. Each route:

1. Reads from `CLAUDE_DIR` (defaults to `~/.claude`) or `DECK_DIR` (defaults to `~/.deck`).
2. Parses the relevant filesystem data using functions from `src/lib/claude/`.
3. Returns `NextResponse.json()` with the result.

There is no authentication layer -- the application is designed to run locally or within a trusted network behind Docker.

Key API route groups:

| Route | Purpose |
|-------|---------|
| `/api/sessions` | List, search, and filter sessions |
| `/api/sessions/[id]` | Single session detail with full conversation |
| `/api/costs` | Cost aggregation and breakdown |
| `/api/projects` | Project listing with stats |
| `/api/stats` | Dashboard summary statistics |
| `/api/live` | Active session detection |
| `/api/repos` | Per-repository analytics |

## Session Launching

Deck can launch new Claude Code or Codex sessions from the browser. The flow:

1. User selects a project and optionally provides a prompt.
2. The API route spawns the CLI (`claude` or `codex`) as a child process using `child_process.spawn()`.
3. stdout/stderr are streamed back to the browser via Server-Sent Events (SSE).
4. The session runs until the CLI process exits or the user terminates it.

In Docker, this requires the CLI tools to be installed in the image (handled by the Dockerfile) and the project directory to be volume-mounted at the expected path.
