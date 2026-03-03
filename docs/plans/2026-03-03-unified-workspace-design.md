# Unified Session Workspace Design

**Date:** 2026-03-03
**Status:** Approved
**Approach:** C — Conversation + Drawer (full-width conversation, slide-out metadata drawer)

## Problem

Session workflows are split across three screens:
- **Workspace** (`/workspace`) — launch and monitor live sessions
- **Session Detail** (`/sessions/{id}`) — review completed sessions (annotations, files, context window)
- **Replay** (`/sessions/{id}/replay`) — step-through playback with timeline

Users juggle between screens to go from "monitor a live session" to "annotate and review it." The old resume API creates new sessions instead of true multi-turn. Dead code from the pre-workspace flow still exists.

## Solution

Consolidate all session interaction into the **Workspace page**. The workspace becomes the single screen for launching, monitoring, reviewing, annotating, and replaying sessions. A slide-out **Detail Drawer** provides metadata, annotations, and file changes without cluttering the conversation.

## Layout

```
┌──────────┬────────────────┬──────────────────────────┬──────────────┐
│ Deck     │ Session Panel  │ Conversation Pane        │ Detail       │
│ Sidebar  │ (220px)        │ (flex)                   │ Drawer       │
│ (240px)  │                │                          │ (280px)      │
│          │ Active         │ Header: project·model·$  │ optional,    │
│          │ Recent         │ Messages (scrollable)    │ toggle ⌘I    │
│          │ History        │ Input bar (sticky)       │              │
│          │                │                          │ Tags         │
│          │ [search]       │  — or in replay mode —   │ Notes        │
│          │                │ Timeline scrubber bar    │ Files        │
└──────────┴────────────────┴──────────────────────────┴──────────────┘
```

## Session Panel Changes

The panel currently shows Active and Recent sections. Add a **History** section:

**Active** — running/idle sessions (green/yellow dot)
**Recent** — last ~5 completed sessions from current browser session
**History** — paginated list from `/api/sessions`, scrollable

Add a search/filter input at the top of the panel to filter across all sections by project name or prompt text.

Clicking any session (active, recent, or historical) loads it in the main pane. No navigation — everything stays in the workspace.

## Detail Drawer (280px, right side)

Toggled via `⌘I` keyboard shortcut or a button in the header bar. Slides in from the right. Contains:

### Tags
- Same tag system as current detail page
- Suggested tags: bug-fix, feature, refactor, exploration, review
- Click to add/remove, saved via `/api/annotations`

### Notes
- Free-form text field
- Auto-saves on blur/debounce via `/api/annotations`

### Files Changed
- Extracted from tool_use blocks (Write/Edit/Bash commands)
- Shows created/edited/modified badges per file
- Fetched from `/api/sessions/{id}/diffs`

### Context Window
- Token usage visualization chart
- Cumulative in/out tokens across messages

### Session Meta
- Session ID (copyable)
- Start time, duration
- Model, CLI tool
- Cost breakdown (input/output/cache tokens)

## Replay Mode (Inline)

Instead of navigating to `/sessions/{id}/replay`, replay becomes an inline mode in the conversation pane:

1. Header bar gains a **Replay** toggle button (visible for completed sessions)
2. When activated:
   - Input bar is replaced by a **timeline scrubber bar**
   - Scrubber shows event markers (blue=user, gray=assistant, amber=tool)
   - Drag to scrub, arrow keys to step, click to seek
   - Speed controls: 1x / 2x / 5x
   - Play/Pause button
3. Messages render progressively up to the scrubber position
4. Detail Drawer shows "Files at this point" filtered by replay index
5. Exiting replay mode restores the input bar

## Conversation Pane Behavior

### Live sessions (running/idle)
- SSE stream connection, real-time message rendering
- Input bar active, `⌘⏎` to send follow-up
- Auto-scroll to latest message

### Completed sessions (done/error)
- Full conversation loaded from `/api/sessions/{id}`
- Input bar shows "Session ended" with a "Restart with same settings" button
- Replay toggle available in header

### Historical sessions (from History section)
- Same as completed — load full conversation, drawer available for annotations

## Dead Code Removal

### Delete
- `src/app/api/sessions/resume/route.ts` — replaced by `/api/sessions/{id}/message`
- Resume panel logic in session detail page

### Convert to Redirects
- `src/app/sessions/[id]/page.tsx` → redirect to `/workspace?session={id}`
- `src/app/sessions/[id]/replay/page.tsx` → redirect to `/workspace?session={id}&replay=true`

### Keep As-Is
- `src/app/sessions/page.tsx` — sessions list stays as power-user analytics view (bulk ops, CSV export, advanced filtering, grouping)
- All existing APIs (list, detail, diffs, annotations, stream, message, start, stop)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘N` | New session |
| `⌘W` | Close current session |
| `⌘1-9` | Switch to session by position |
| `⌘I` | Toggle detail drawer |
| `⌘⏎` | Send message / Launch session |
| `⌘R` | Toggle replay mode (completed sessions) |
| `/` | Focus search in session panel |

## Navigation & Routing

### URL Structure
- `/workspace` — empty state, new session form
- `/workspace?session={id}` — load specific session
- `/workspace?session={id}&replay=true` — load session in replay mode

### Redirects
- `/sessions/new` → `/workspace` (existing)
- `/sessions/{id}` → `/workspace?session={id}` (new)
- `/sessions/{id}/replay` → `/workspace?session={id}&replay=true` (new)

### Sidebar Nav
No changes — Workspace and Sessions entries remain. Sessions list stays as the analytics/bulk-ops view.

## What Stays Unchanged

- `/sessions` list page (filters, search, grouping, bulk actions, exports)
- All annotation and export APIs
- SSE streaming infrastructure
- Multi-turn process management (stdin-based follow-ups)
- Per-project workspace preferences (localStorage)
