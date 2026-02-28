import {
  LayoutDashboard,
  ExternalLink,
  Sparkles,
  Code2,
  Wrench,
} from "lucide-react"

const changelog = [
  {
    version: "v2.0",
    title: "About & Changelog",
    features: [
      "About & changelog page",
      "Onboarding experience",
      "Global status bar",
    ],
  },
  {
    version: "v1.9",
    title: "Session Insights",
    features: [
      "Session insights",
      "Focus mode",
      "Command history",
    ],
  },
  {
    version: "v1.8",
    title: "Enhanced Search",
    features: [
      "Enhanced search",
      "Session grouping",
      "Cost forecasting",
    ],
  },
  {
    version: "v1.7",
    title: "Dashboard Customization",
    features: [
      "Dashboard customization",
      "Data export",
      "Session annotations",
    ],
  },
  {
    version: "v1.6",
    title: "Activity Feed",
    features: [
      "Activity feed",
      "Bookmarks",
      "Git dashboard",
    ],
  },
  {
    version: "v1.5",
    title: "Notifications",
    features: [
      "Notifications",
      "Daily digest",
      "Session templates",
    ],
  },
  {
    version: "v1.4",
    title: "Project Health",
    features: [
      "Project health",
      "Reports",
      "Favorites",
    ],
  },
  {
    version: "v1.3",
    title: "Session Chains",
    features: [
      "Session chains",
      "Model comparison",
      "Mobile nav",
    ],
  },
  {
    version: "v1.2",
    title: "Session Replay",
    features: [
      "Session replay",
      "Prompt library",
      "Tags analytics",
    ],
  },
  {
    version: "v1.1",
    title: "Token Analytics",
    features: [
      "Token analytics",
      "Cost tips",
      "Session heatmap",
    ],
  },
  {
    version: "v1.0",
    title: "Keyboard Navigation",
    features: [
      "Keyboard navigation",
      "Streak/highlights widgets",
      "Session polish",
    ],
  },
  {
    version: "v0.9",
    title: "Ports Monitor",
    features: [
      "Ports monitor",
      "Session compare",
      "Context window viz",
    ],
  },
  {
    version: "v0.8",
    title: "Repo Pulse",
    features: [
      "Repo pulse",
      "Work graph",
      "Snapshots",
    ],
  },
  {
    version: "v0.7",
    title: "Timeline",
    features: [
      "Timeline",
      "Diffs",
      "Skills browser",
    ],
  },
  {
    version: "v0.6",
    title: "Search & Analytics",
    features: [
      "Search",
      "Analytics page",
    ],
  },
  {
    version: "v0.5",
    title: "Session New",
    features: [
      "Session new",
      "Live sessions",
    ],
  },
  {
    version: "v0.4",
    title: "Session Detail",
    features: [
      "Session detail",
      "Cost tracking",
    ],
  },
  {
    version: "v0.3",
    title: "Repos & Settings",
    features: [
      "Repos page",
      "Settings",
    ],
  },
  {
    version: "v0.2",
    title: "Sessions List",
    features: [
      "Sessions list",
      "MCP servers",
    ],
  },
  {
    version: "v0.1",
    title: "Initial Release",
    features: [
      "Home dashboard",
      "Sidebar",
      "Initial layout",
    ],
  },
]

const techStack = [
  "Next.js 15",
  "React 19",
  "TypeScript",
  "Docker",
  "Tailwind CSS",
  "Inline SVG Charts",
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800">
            <LayoutDashboard className="h-6 w-6 text-zinc-100" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
              Deck
            </h1>
            <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
              v2.0
            </span>
          </div>
        </div>
        <p className="text-lg leading-relaxed text-zinc-400">
          A local-first dashboard for Claude Code analytics
        </p>
        <p className="text-sm leading-relaxed text-zinc-500">
          Deck reads your Claude Code session data from{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
            ~/.claude/projects/
          </code>{" "}
          and provides rich analytics, insights, and tools — all running locally
          on your machine.
        </p>
      </div>

      {/* Changelog */}
      <div className="space-y-5">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-zinc-400" />
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
            Changelog
          </h2>
        </div>

        <div className="space-y-3">
          {changelog.map((entry) => (
            <div
              key={entry.version}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-200">
                  {entry.version}
                </span>
                <h3 className="text-sm font-medium text-zinc-300">
                  {entry.title}
                </h3>
              </div>
              <ul className="mt-2.5 space-y-1 pl-1">
                {entry.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm text-zinc-500"
                  >
                    <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Wrench className="h-5 w-5 text-zinc-400" />
          <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
            Tech Stack
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {techStack.map((tech) => (
            <span
              key={tech}
              className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-300"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* GitHub Link */}
      <div>
        <a
          href="https://github.com/divyekant/deck"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Code2 className="h-4 w-4" />
          View on GitHub
          <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
        </a>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 pt-6">
        <p className="text-center text-xs text-zinc-600">
          Built with Claude Code
        </p>
      </div>
    </div>
  )
}
