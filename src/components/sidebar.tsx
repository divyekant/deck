"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  GitBranch,
  Puzzle,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const STORAGE_KEY = "deck-sidebar-collapsed"

const navSections = [
  {
    label: "Overview",
    items: [
      { name: "Home", href: "/", icon: BarChart3 },
      { name: "Search", href: "/search", icon: Search },
    ],
  },
  {
    label: "Monitor",
    items: [
      { name: "Sessions", href: "/sessions", icon: MessageSquare, showRunning: true },
      { name: "Analytics", href: "/analytics", icon: TrendingUp },
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
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Read initial collapsed state from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setCollapsed(true)
    } catch {
      // localStorage unavailable
    }
    setHydrated(true)
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // localStorage unavailable
      }
      return next
    })
  }, [])

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
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
      // Prevent layout shift before hydration by hiding until ready
      style={hydrated ? undefined : { width: 240 }}
    >
      {/* Logo + Collapse Toggle */}
      <div className="flex items-center gap-2 px-3 py-5">
        <div className={cn("flex items-center gap-2", collapsed ? "px-1" : "px-2")}>
          <LayoutDashboard className="size-5 shrink-0 text-zinc-400" />
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight text-zinc-100">
              Deck
            </span>
          )}
        </div>
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300",
            collapsed ? "ml-auto mr-0" : "ml-auto"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      <Separator className="bg-zinc-800" />

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navSections.map((section, sIdx) => (
          <div key={section.label} className={cn(sIdx > 0 && "mt-4")}>
            {!collapsed && (
              <span className="mb-1 block px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </span>
            )}
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
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
                    collapsed ? "justify-center" : "gap-2.5",
                    isActive
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed && item.name}

                  {hasRunning && !collapsed && (
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

                  {hasRunning && collapsed && (
                    <span className="absolute right-1 top-0.5 flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
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
            title={collapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
              collapsed ? "justify-center" : "gap-2.5",
              pathname === "/settings"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
            )}
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed && "Settings"}
          </Link>
        </div>
      </nav>

      <div className="px-3 pb-4">
        {collapsed ? (
          <Button
            asChild
            size="icon"
            className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            title="New Session"
          >
            <Link href="/sessions/new">
              <Plus className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button asChild className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
            <Link href="/sessions/new">
              <Plus className="size-4" />
              New Session
            </Link>
          </Button>
        )}
      </div>
    </aside>
  )
}
