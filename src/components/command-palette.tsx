"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Home,
  MessageSquare,
  GitBranch,
  Clock,
  Puzzle,
  Settings,
  Plus,
  ArrowRight,
  Search,
  Radio,
  DollarSign,
  Activity,
  Network,
  Camera,
  Plug,
  Scale,
  Coins,
  BookOpen,
} from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "radix-ui"
import type { SessionMeta } from "@/lib/claude/types"

interface PaletteItem {
  id: string
  label: string
  section: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string
}

const PAGES: PaletteItem[] = [
  { id: "home", label: "Home", section: "Pages", href: "/", icon: Home },
  { id: "search", label: "Search", section: "Pages", href: "/search", icon: Search },
  { id: "live", label: "Live Sessions", section: "Pages", href: "/live", icon: Radio },
  { id: "sessions", label: "Sessions", section: "Pages", href: "/sessions", icon: MessageSquare },
  { id: "costs", label: "Costs", section: "Pages", href: "/costs", icon: DollarSign },
  { id: "repos", label: "Repos", section: "Pages", href: "/repos", icon: GitBranch },
  { id: "timeline", label: "Timeline", section: "Pages", href: "/timeline", icon: Clock },
  { id: "pulse", label: "Repo Pulse", section: "Pages", href: "/pulse", icon: Activity },
  { id: "snapshots", label: "Snapshots", section: "Pages", href: "/snapshots", icon: Camera },
  { id: "work-graph", label: "Work Graph", section: "Pages", href: "/work-graph", icon: Network },
  { id: "tokens", label: "Token Analytics", section: "Pages", href: "/tokens", icon: Coins },
  { id: "ports", label: "Ports", section: "Pages", href: "/ports", icon: Plug },
  { id: "compare", label: "Compare Sessions", section: "Pages", href: "/compare", icon: Scale },
  { id: "prompts", label: "Prompt Library", section: "Pages", href: "/prompts", icon: BookOpen },
  { id: "mcp", label: "MCP Servers", section: "Pages", href: "/mcp", icon: Puzzle },
  { id: "settings", label: "Settings", section: "Pages", href: "/settings", icon: Settings },
]

const ACTIONS: PaletteItem[] = [
  { id: "new-session", label: "New Session", section: "Actions", href: "/sessions/new", icon: Plus },
]

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + "..."
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentSessions, setRecentSessions] = useState<PaletteItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Global keyboard listener: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Fetch recent sessions when opened
  useEffect(() => {
    if (!open) return
    setQuery("")
    setActiveIndex(0)

    async function fetchRecent() {
      try {
        const res = await fetch("/api/sessions?limit=5")
        if (!res.ok) return
        const json = await res.json()
        const data: SessionMeta[] = json.sessions || []
        const items: PaletteItem[] = data.slice(0, 5).map((s) => ({
          id: `session-${s.id}`,
          label: truncate(s.firstPrompt, 60) || "Untitled session",
          section: "Recent Sessions",
          href: `/sessions/${s.id}`,
          icon: ArrowRight,
          keywords: s.firstPrompt,
        }))
        setRecentSessions(items)
      } catch {
        // ignore
      }
    }
    fetchRecent()
  }, [open])

  // Build filtered list
  const allItems = [...PAGES, ...ACTIONS, ...recentSessions]
  const lowerQuery = query.toLowerCase()
  const filtered = lowerQuery
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(lowerQuery) ||
          (item.keywords && item.keywords.toLowerCase().includes(lowerQuery))
      )
    : allItems

  // Group by section
  const sections: { name: string; items: PaletteItem[] }[] = []
  const sectionOrder = ["Pages", "Actions", "Recent Sessions"]
  for (const name of sectionOrder) {
    const items = filtered.filter((i) => i.section === name)
    if (items.length > 0) sections.push({ name, items })
  }

  // Flat list for keyboard navigation
  const flatItems = sections.flatMap((s) => s.items)

  // Clamp active index
  useEffect(() => {
    if (activeIndex >= flatItems.length) {
      setActiveIndex(Math.max(0, flatItems.length - 1))
    }
  }, [flatItems.length, activeIndex])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${activeIndex}"]`)
    activeEl?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = flatItems[activeIndex]
      if (item) navigate(item.href)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 p-0 sm:max-w-lg border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <VisuallyHidden.Root>
          <DialogTitle>Command Palette</DialogTitle>
        </VisuallyHidden.Root>
        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-zinc-700 px-3">
          <Search className="size-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent py-3 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[320px] overflow-y-auto px-1.5 pb-1.5">
          {flatItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-500">
              No results found.
            </div>
          ) : (
            sections.map((section) => {
              return (
                <div key={section.name} className="mt-1">
                  <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    {section.name}
                  </div>
                  {section.items.map((item) => {
                    const globalIdx = flatItems.indexOf(item)
                    const isActive = globalIdx === activeIndex
                    return (
                      <button
                        key={item.id}
                        data-index={globalIdx}
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors ${
                          isActive
                            ? "bg-zinc-800 text-zinc-100"
                            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                        }`}
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-3 border-t border-zinc-700 px-3 py-2 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5">
              &uarr;&darr;
            </kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5">
              &crarr;
            </kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5">
              esc
            </kbd>
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
