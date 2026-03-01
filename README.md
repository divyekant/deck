# Deck

**A local-first dashboard for Claude Code and Codex CLI analytics.**

Deck reads directly from `~/.claude/projects/` and `~/.codex/` to surface session data, costs, project health, and configuration. No cloud. No database. No telemetry. Everything stays on your machine.

**v2.5.0** | [Changelog](CHANGELOG.md)

<!-- Screenshot placeholder: add a screenshot of the Deck dashboard here -->

---

## Features

### Overview

The home dashboard displays aggregate statistics, budget tracking, recent activity, and project-level breakdowns at a glance.

### Monitor

| Page | Description |
|------|-------------|
| Live | Real-time detection and monitoring of active Claude Code / Codex sessions |
| Sessions | Searchable, filterable session table with cost tracking, model breakdowns, and token usage |
| Session Detail | Full conversation replay with play/pause/speed controls, timeline scrubber, and thinking block expansion |
| Costs | Three-tab cost breakdown: Overview, Tokens, Models |
| Setup | Three-tab inspector: CLAUDE.md viewer, Plugins browser, MCP Servers |
| Ports | Port usage tracking across projects |

### Workspace

| Page | Description |
|------|-------------|
| Repos | Per-project breakdown with color-coded accent system |
| Work Graph | Task and dependency visualization |
| Repo Pulse | Activity heatmap and commit-level pulse view |
| Timeline | Chronological project activity feed |
| Diffs | File change tracking across sessions |
| Snapshots | Point-in-time project state captures |

### Config

| Page | Description |
|------|-------------|
| Skills | Skill browser across all projects |
| Agents | Global and per-project agent definitions |
| Memory | MEMORY.md file viewer across projects |
| Hooks | Global and per-project hooks inspector (settings.json) |

### Health

| Page | Description |
|------|-------------|
| Hygiene | Per-project health scoring across 5 dimensions with diagnostic report generation |
| Dependencies | Package version mismatch detection with cross-project shared dependency graph |
| Worktrees | Active git worktree browser across all projects |
| Env Scanner | Finds .env files and flags exposed secrets not in .gitignore |
| Config Lint | CLAUDE.md and settings.json quality checker with actionable issues |

### Session Launcher

Launch Claude Code or Codex CLI sessions directly from the browser. Includes CLI-aware model selection, project picker, and prompt input. Available via the "New Session" button in the sidebar.

---

## Quick Start

### Docker (recommended)

```bash
docker compose up -d --build
```

Open [http://localhost:3001](http://localhost:3001).

### Local development

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

You can also use npm instead of bun:

```bash
npm install
npm run dev
```

### Production build (local)

```bash
bun run build
bun start
```

Runs on [http://localhost:3001](http://localhost:3001).

---

## Docker Setup

The `docker-compose.yml` mounts your local configuration directories into the container:

| Host Path | Container Path | Mode |
|-----------|---------------|------|
| `~/.claude` | `/home/node/.claude` | Read-only |
| `~/.codex` | `/home/node/.codex` | Read-only |
| `~/.deck` | `/home/node/.deck` | Read-write |
| `~/Projects` | `/Users/divyekant/Projects` | Read-only |

**Important:** The projects mount path (`~/Projects:/Users/divyekant/Projects:ro`) is specific to the default configuration. Update it to match your own projects directory:

```yaml
# docker-compose.yml
volumes:
  - ~/.claude:/home/node/.claude:ro
  - ~/.codex:/home/node/.codex:ro
  - ~/.deck:/home/node/.deck
  - ~/your-projects-dir:/Users/yourname/your-projects-dir:ro
```

The Docker image is based on `node:22-alpine` and includes `claude` and `codex` CLI tools pre-installed globally, enabling the session launcher to start new sessions from within the container.

---

## Navigation

22 sidebar items across 5 sections, plus Settings and New Session.

| Section | Icon | Page | Route |
|---------|------|------|-------|
| Overview | BarChart3 | Home | `/` |
| Monitor | Radio | Live | `/live` |
| Monitor | MessageSquare | Sessions | `/sessions` |
| Monitor | DollarSign | Costs | `/costs` |
| Monitor | Wrench | Setup | `/setup` |
| Monitor | Plug | Ports | `/ports` |
| Workspace | GitBranch | Repos | `/repos` |
| Workspace | BarChart2 | Work Graph | `/work-graph` |
| Workspace | Activity | Repo Pulse | `/pulse` |
| Workspace | Clock | Timeline | `/timeline` |
| Workspace | FileDiff | Diffs | `/diffs` |
| Workspace | Camera | Snapshots | `/snapshots` |
| Config | Sparkles | Skills | `/skills` |
| Config | Bot | Agents | `/agents` |
| Config | Brain | Memory | `/memory` |
| Config | Webhook | Hooks | `/hooks` |
| Health | HeartPulse | Hygiene | `/hygiene` |
| Health | Package | Dependencies | `/dependencies` |
| Health | GitFork | Worktrees | `/worktrees` |
| Health | Shield | Env Scanner | `/env` |
| Health | FileCheck | Lint | `/lint` |
| -- | Settings | Settings | `/settings` |
| -- | Plus | New Session | `/sessions/new` |

Additional routes: `/sessions/[id]` (session detail), `/sessions/[id]/replay` (session replay), `/repos/[name]` (repo detail).

---

## API Routes

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions with metadata |
| GET | `/api/sessions/[id]` | Get single session detail |
| GET | `/api/sessions/[id]/diffs` | Get file diffs for a session |
| GET | `/api/sessions/[id]/stream` | Stream session events (SSE) |
| GET | `/api/sessions/running` | List currently active sessions |
| POST | `/api/sessions/start` | Launch a new CLI session |
| POST | `/api/sessions/resume` | Resume an existing session |
| POST | `/api/sessions/[id]/stop` | Stop a running session |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics` | Aggregate analytics data |
| GET | `/api/stats` | Summary statistics |
| GET | `/api/costs` | Cost breakdowns |
| GET | `/api/tokens` | Token usage data |
| GET | `/api/models` | Model usage data |
| GET | `/api/activity` | Activity feed |
| GET | `/api/insights` | AI-generated insights |

### Projects and Repos

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/[name]` | Project-level data |
| GET | `/api/pulse` | Repo pulse / activity heatmap |
| GET | `/api/work-graph` | Work graph data |
| GET | `/api/git` | Git metadata |
| GET | `/api/snapshots` | Project snapshots |
| GET | `/api/ports` | Port usage |
| GET | `/api/repos/[name]/config` | Per-repo configuration |

### Config

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | Skills data |
| GET | `/api/agents` | Agent definitions |
| GET | `/api/memory` | Memory files |
| GET | `/api/hooks` | Hooks configuration |
| GET | `/api/claude-md` | CLAUDE.md contents |
| GET | `/api/plugins` | Plugin data |
| GET | `/api/mcp` | MCP server data |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hygiene` | Project hygiene scores |
| GET | `/api/dependencies` | Dependency data |
| GET | `/api/dependencies/graph` | Cross-project dependency graph |
| GET | `/api/worktrees` | Git worktree data |
| GET | `/api/env` | Environment file scan |
| GET | `/api/lint` | Config lint results |

### Utilities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | App health check |
| GET | `/api/search` | Global search |
| GET | `/api/prompts` | Prompt data |
| GET | `/api/chains` | Chain data |
| GET | `/api/commands` | Command data |
| GET/POST | `/api/settings` | App settings |
| GET/POST | `/api/favorites` | Favorites |
| GET/POST | `/api/bookmarks` | Bookmarks |
| GET/POST | `/api/annotations` | Annotations |
| GET/POST | `/api/dashboard-prefs` | Dashboard preferences |
| GET/POST | `/api/notifications` | Notifications |
| GET | `/api/templates` | Templates |
| GET | `/api/reports` | Reports |
| GET | `/api/export` | Data export |

---

## Architecture

Deck is a Next.js application using the App Router. All data is read from the local filesystem at runtime.

- **Data source**: `~/.claude/projects/` (JSONL session files, CLAUDE.md, settings.json, MEMORY.md, etc.) and `~/.codex/`
- **Compute**: Analytics are computed server-side from raw JSONL files on each request. No database, no caching layer, no background workers.
- **State**: User preferences (favorites, bookmarks, annotations, dashboard layout) are stored in `~/.deck/` as JSON files.
- **Telemetry**: None. No data leaves your machine.
- **Deployment**: Docker container (recommended) or local Node.js / Bun dev server.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui, Radix UI |
| Icons | lucide-react |
| Package Manager | Bun (or npm) |
| Runtime | Node.js 22 |
| Container | Docker (Alpine) |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on setting up the development environment, running tests, and submitting pull requests.

---

## License

MIT

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a full list of changes across all versions.
