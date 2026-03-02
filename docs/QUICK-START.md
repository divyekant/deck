# Quick Start

## Prerequisites

- **Docker** (recommended) or **Node.js 22+** with **Bun**
- You must have used **Claude Code** at least once, so that `~/.claude/projects/` exists on your machine. Deck reads session data from this directory -- if it does not exist, there is nothing to display.

## Docker (Recommended)

### 1. Clone the repository

```bash
git clone https://github.com/divyekant/deck.git
cd deck
```

### 2. Configure environment and volume mounts

Open `docker-compose.yml` and adjust two things:

**a) Projects volume mount** — change the path to match your setup:

```yaml
volumes:
  - ~/.claude:/home/node/.claude
  - ~/.claude.json:/home/node/.claude.json
  - ~/.codex:/home/node/.codex:ro
  - ~/.deck:/home/node/.deck
  - ~/Projects:/Users/yourname/Projects:ro   # <-- CHANGE THIS
```

The left side is your host path, the right side must match the absolute path Claude Code recorded in session files.

Examples:

```yaml
# macOS
- ~/Projects:/Users/yourname/Projects:ro

# Linux
- ~/projects:/home/yourname/projects:ro
```

**b) API key for session launching** (optional) — if you want to launch new Claude Code sessions from the Docker container, set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without an API key, Deck works fully for viewing sessions, analytics, and all dashboard features. The API key is only needed for the "New Session" launcher.

### 3. Start the container

```bash
docker compose up -d
```

The first run will build the image, which takes a few minutes. Subsequent starts are fast.

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/divyekant/deck.git
cd deck
```

### 2. Install dependencies

```bash
bun install
```

### 3. Start the dev server

```bash
bun dev
```

The development server runs on port 3001 by default.

## Verifying It Works

Open [http://localhost:3001](http://localhost:3001) in your browser. You should see:

- A sidebar with navigation links
- Your Claude Code sessions listed on the main page
- Cost and usage statistics if you have session history

If the page loads but shows no data, see Troubleshooting below.

## Troubleshooting

### No sessions showing

Check that `~/.claude/projects/` exists and contains subdirectories with session files:

```bash
ls ~/.claude/projects/
```

If this directory is empty or does not exist, you need to use Claude Code at least once to generate session data.

### Docker: sessions not appearing

Verify your volume mounts are correct. The `~/.claude` mount must point to your actual Claude config directory:

```bash
docker exec deck ls /home/node/.claude/projects/
```

If this returns nothing, the volume mount is misconfigured. Check that `~/.claude` exists on your host and that Docker has permission to access it.

### Docker: session launching fails

Session launching requires two things:

1. **An API key** — set `ANTHROPIC_API_KEY` in your environment or `.env` file. OAuth login from the host cannot be shared with the container.
2. **Project paths mounted correctly** — the project directory must be mounted at the same absolute path that Claude Code recorded in your session files.

If you see "Not logged in" errors, you need to set the API key. If you see path-related errors, check your Projects volume mount.

### Port conflict

If port 3001 is already in use, change the port mapping in `docker-compose.yml`:

```yaml
ports:
  - "3002:3001"   # Use port 3002 on the host instead
```

Then visit [http://localhost:3002](http://localhost:3002).
