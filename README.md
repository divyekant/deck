# Deck

A local-first dashboard for Claude Code analytics. Reads directly from `~/.claude/projects/` to surface session data, costs, project health, and configuration — no cloud, no telemetry.

**v2.3.0**

## Features

### Monitor
- **Sessions** — searchable table with filters, cost tracking, model breakdowns, token usage
- **Session Replay** — conversation replay with play/pause/speed controls and thinking block expansion
- **Costs** — three-tab breakdown: Overview, Tokens, Models
- **Live** — active session detection and monitoring
- **Ports** — port usage tracking across projects
- **Diffs** — file change tracking

### Workspace
- **Repos** — per-project breakdown with color-coded accent system
- **Skills** — skill browser across projects
- **Work Graph** — task and dependency visualization
- **Timeline** — chronological project activity
- **Snapshots** — point-in-time project state capture
- **New Session** — browser-based Claude Code session launcher

### Config
- **Setup** — three-tab inspector: CLAUDE.md viewer, Plugins browser, MCP Servers
- **Agents** — global and per-project agent browser
- **Memory** — memory file viewer across projects
- **Hooks** — global and per-project hooks inspector (settings.json)

### Health
- **Hygiene** — project hygiene scoring across 5 dimensions
- **Dependencies** — version mismatch detection and dependency viewer

### Utilities
- **Command Palette** (Cmd+K) — fuzzy search across all pages and actions

## Tech Stack

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react
- Bun (package manager)
- Docker (OrbStack)

## Quick Start

### Local development

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
bun run build
bun start
```

Runs on [http://localhost:3001](http://localhost:3001).

### Docker (OrbStack)

```bash
# Build and run
docker compose up -d

# Rebuild after changes
bun run build && docker compose up -d --build
```

The container mounts `~/.claude` (read-only) and `~/.codex` (read-only) into the container, and persists its own state at `~/.deck`.

## Navigation Structure

| Section     | Pages                                              |
|-------------|-----------------------------------------------------|
| Overview    | Home                                                |
| Monitor     | Sessions, Costs, Live, Ports, Diffs                 |
| Workspace   | Repos, Skills, Work Graph, Timeline, Snapshots, New Session |
| Config      | Setup, Agents, Memory, Hooks                        |
| Health      | Hygiene, Dependencies                               |

5 sections, 19 pages total.

## Data Source

Deck reads from your local Claude Code data directory (`~/.claude/projects/`). No data leaves your machine. All analytics are computed client-side from JSONL session files.

## License

Private.
