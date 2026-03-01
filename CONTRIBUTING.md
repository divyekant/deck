# Contributing to Deck

Deck is a local-first dashboard for Claude Code analytics. It reads your session data from disk and surfaces usage stats, cost breakdowns, session replay, and more.

## Getting Started

1. Fork the repo and clone your fork:

```bash
git clone https://github.com/<your-username>/deck.git
cd deck
```

2. Install dependencies with Bun:

```bash
bun install
```

3. Start the dev server:

```bash
bun dev
```

The app runs at `http://localhost:3000` by default. Production mode uses port 3001.

## Project Structure

```
src/
  app/                  # Pages (Next.js App Router)
    page.tsx            # Overview / home
    sessions/           # Sessions list, detail, replay, new
    repos/              # Per-project breakdown
    costs/              # Cost analytics
    live/               # Live session monitoring
    ...
    api/                # API routes (one directory per resource)
  components/           # Shared UI components
    sidebar.tsx         # Main navigation sidebar
    command-palette.tsx # Cmd+K command palette
    ...
  lib/                  # Utilities and data access layer
    claude/             # Claude session file readers/parsers
    utils.ts            # General helpers
    format.ts           # Formatting utilities
    project-colors.ts   # Per-project color assignment
    ...
docs/                   # Design specs, decisions, plans
  decisions/            # Architecture decision records
  plans/                # Release planning
tests/                  # Test files
```

## Development

### Run locally

```bash
bun dev          # Start dev server with hot reload
```

### Build

```bash
bun run build    # Production build
bun start        # Serve production build on port 3001
```

### Lint

```bash
bun run lint     # Run ESLint
```

### Test

```bash
bun test         # Run tests with Vitest
```

## Code Style

- **TypeScript strict** -- no `any` unless absolutely necessary.
- **Tailwind CSS v4** for all styling. Dark theme with the zinc palette (`bg-zinc-950`, `text-zinc-50`, etc.).
- **shadcn/ui** for UI primitives (buttons, dialogs, cards, etc.).
- **Lucide React** for icons. Import from `lucide-react`.
- **Minimal comments** -- code should be self-explanatory. Only add comments for non-obvious logic.
- **Conventional commits** -- prefix every commit message:
  - `feat:` new feature
  - `fix:` bug fix
  - `chore:` maintenance, deps, tooling
  - `refactor:` code restructuring without behavior change
  - `docs:` documentation only
  - `test:` adding or updating tests

## Adding a New Page

1. Create `src/app/<name>/page.tsx` with a default export.
2. If the page needs server data, add an API route at `src/app/api/<name>/route.ts`.
3. Add a navigation entry in `src/components/sidebar.tsx`.
4. Add the page to the command palette in `src/components/command-palette.tsx`.
5. Update `CHANGELOG.md` with a line under the `[Unreleased]` section.

## Pull Requests

- Branch from `main`. Use a descriptive branch name (`feat/cost-export`, `fix/session-parse-error`).
- Keep commits focused. One logical change per commit.
- Use conventional commit messages.
- In the PR description, explain what changed and why.
- If the change is visual, include a screenshot.
- Make sure `bun run build` and `bun run lint` pass before opening the PR.

## Issues

- Use GitHub Issues for bugs, feature requests, and questions.
- For bugs, include:
  - Steps to reproduce
  - Expected vs. actual behavior
  - OS and Node/Bun version
  - Relevant error output or screenshots
- For feature requests, describe the use case before proposing a solution.

## Docker

The project includes a `Dockerfile` and `docker-compose.yml` for containerized testing.

### Build and run with Docker Compose

```bash
# Build the Next.js app first
bun run build

# Build and start the container
docker compose up --build
```

The container exposes port 3001. It expects a pre-built `.next` directory (the Dockerfile copies it in rather than building inside the container).

### Build the image directly

```bash
bun run build
docker build -t deck .
docker run -p 3001:3001 deck
```

If you use OrbStack, make sure its Docker CLI is on your PATH (`~/.orbstack/bin/docker`).
