# Changelog

All notable changes to Deck will be documented in this file.

## [2.2.0] - 2026-03-01

### Added
- Agents page: browse global and per-project agent definitions
- Memory page: view MEMORY.md files across all projects
- Hooks page: inspect Claude Code hooks from settings.json (global + per-project)
- Setup page enhanced with 3 tabs: CLAUDE.md viewer, Plugins browser, MCP Servers
- API routes: /api/agents, /api/memory, /api/hooks, /api/claude-md, /api/plugins

## [2.1.0] - 2026-03-01

### Added
- Costs page now has tabbed interface (Overview | Tokens | Models)
- About section and changelog embedded in Settings page
- MCP server management moved to /setup with redirect from /mcp

### Changed
- Sidebar restructured: 22 items → 19 items across 5 sections (Overview, Monitor, Workspace, Config, Health)
- Command palette updated with v3 routes and keywords
- Mobile nav updated to match new navigation structure

### Removed
- 19 standalone pages consolidated or removed: about, activity, analytics, bookmarks, chains, commands, compare, export, focus, git, health, insights, notifications, prompts, reports, search, templates, tokens, models
