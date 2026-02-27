"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, BarChart3, MessageSquare, GitBranch, Puzzle, Plus, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const navSections = [
  {
    label: "Overview",
    items: [
      { name: "Home", href: "/", icon: BarChart3 },
    ],
  },
  {
    label: "Monitor",
    items: [
      { name: "Sessions", href: "/sessions", icon: MessageSquare, showRunning: true },
    ],
  },
  {
    label: "Workspace",
    items: [
      { name: "Repos", href: "/repos", icon: GitBranch },
    ],
  },
  {
    label: "Config",
    items: [
      { name: "MCP Servers", href: "/mcp", icon: Puzzle },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [runningCount, setRunningCount] = useState(0)

  useEffect(() => {
    let active = true

    async function fetchRunning() {
      try {
        const res = await fetch("/api/sessions/running")
        if (!res.ok) return
        const data = await res.json()
        if (active) setRunningCount(Array.isArray(data) ? data.length : 0)
      } catch {
        // silently ignore fetch errors
      }
    }

    fetchRunning()
    const interval = setInterval(fetchRunning, 10000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 px-5 py-5">
        <LayoutDashboard className="size-5 text-zinc-400" />
        <span className="text-lg font-semibold tracking-tight text-zinc-100">Deck</span>
      </div>

      <Separator className="bg-zinc-800" />

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navSections.map((section, sIdx) => (
          <div key={section.label} className={cn(sIdx > 0 && "mt-4")}>
            <span className="mb-1 block px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {section.label}
            </span>
            {section.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)

              const hasRunning =
                "showRunning" in item && item.showRunning && runningCount > 0

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  )}
                >
                  <item.icon className="size-4" />
                  {item.name}

                  {hasRunning && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                      </span>
                      <span className="text-[10px] font-medium text-emerald-400">
                        {runningCount}
                      </span>
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
        {/* Settings — pushed to bottom */}
        <div className="mt-auto space-y-1">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
              pathname === "/settings"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </div>
      </nav>

      <div className="px-3 pb-4">
        <Button asChild className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
          <Link href="/sessions/new">
            <Plus className="size-4" />
            New Session
          </Link>
        </Button>
      </div>
    </aside>
  )
}
