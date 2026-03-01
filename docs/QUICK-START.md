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

### 2. Configure volume mounts

Open `docker-compose.yml` and adjust the Projects volume mount to match your local projects path:

```yaml
services:
  deck:
    build: .
    container_name: deck
    ports:
      - "3001:3001"
    volumes:
      - ~/.claude:/home/node/.claude:ro
      - ~/.codex:/home/node/.codex:ro
      - ~/.deck:/home/node/.deck
      - ~/Projects:/Users/divyekant/Projects:ro   # <-- CHANGE THIS
    environment:
      - HOME=/home/node
    restart: unless-stopped
```

**IMPORTANT:** You must change the Projects volume mount to match your own setup. The left side is the path on your host machine. The right side is where it appears inside the container -- this must match the absolute path that Claude Code recorded in your session files.

Examples:

```yaml
# macOS -- your projects are in ~/Projects, Claude Code recorded paths as /Users/yourname/Projects
- ~/Projects:/Users/yourname/Projects:ro

# Linux -- your projects are in ~/projects, Claude Code recorded paths as /home/yourname/projects
- ~/projects:/home/yourname/projects:ro
```

The `:ro` suffix mounts the directory as read-only. Deck only reads project files; it does not modify them.

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

Session launching requires the project directory to be mounted inside the container at the same absolute path that Claude Code recorded. If you see path-related errors when launching a session, check that your Projects volume mount maps to the correct container path.

### Port conflict

If port 3001 is already in use, change the port mapping in `docker-compose.yml`:

```yaml
ports:
  - "3002:3001"   # Use port 3002 on the host instead
```

Then visit [http://localhost:3002](http://localhost:3002).
