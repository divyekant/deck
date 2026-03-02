"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  BarChart3,
  BarChart2,
  MessageSquare,
  GitBranch,
  Sparkles,
  Plus,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
  DollarSign,
  FileDiff,
  Activity,
  Plug,
  Wrench,
  Clock,
  Camera,
  Bot,
  Brain,
  Webhook,
  HeartPulse,
  Package,
  GitFork,
  Shield,
  FileCheck,
  Sun,
  Moon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useTheme } from "@/components/theme-provider"

const STORAGE_KEY = "deck-sidebar-collapsed"

export const navSections = [
  {
    label: "Overview",
    items: [
      { name: "Home", href: "/", icon: BarChart3 },
    ],
  },
  {
    label: "Monitor",
    items: [
      { name: "Live", href: "/live", icon: Radio, showRunning: true },
      { name: "Sessions", href: "/sessions", icon: MessageSquare },
      { name: "Costs", href: "/costs", icon: DollarSign },
      { name: "Setup", href: "/setup", icon: Wrench },
      { name: "Ports", href: "/ports", icon: Plug },
    ],
  },
  {
    label: "Workspace",
    items: [
      { name: "Repos", href: "/repos", icon: GitBranch },
      { name: "Work Graph", href: "/work-graph", icon: BarChart2 },
      { name: "Repo Pulse", href: "/pulse", icon: Activity },
      { name: "Timeline", href: "/timeline", icon: Clock },
      { name: "Diffs", href: "/diffs", icon: FileDiff },
      { name: "Snapshots", href: "/snapshots", icon: Camera },
    ],
  },
  {
    label: "Config",
    items: [
      { name: "Skills", href: "/skills", icon: Sparkles },
      { name: "Agents", href: "/agents", icon: Bot },
      { name: "Memory", href: "/memory", icon: Brain },
      { name: "Hooks", href: "/hooks", icon: Webhook },
    ],
  },
  {
    label: "Health",
    items: [
      { name: "Hygiene", href: "/hygiene", icon: HeartPulse },
      { name: "Dependencies", href: "/dependencies", icon: Package },
      { name: "Worktrees", href: "/worktrees", icon: GitFork },
      { name: "Env Scanner", href: "/env", icon: Shield },
      { name: "Lint", href: "/lint", icon: FileCheck },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
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
    const interval = setInterval(fetchRunning, 30000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <aside
      className={cn(
        "hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 lg:flex",
        collapsed ? "w-16" : "w-60"
      )}
      // Prevent layout shift before hydration by hiding until ready
      style={hydrated ? undefined : { width: 240 }}
    >
      {/* Logo + Theme + Collapse Toggle */}
      <div className="flex items-center gap-2 px-3 py-5">
        <div className={cn("flex items-center gap-2", collapsed ? "px-1" : "px-2")}>
          <LayoutDashboard className="size-5 shrink-0 text-muted-foreground" />
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
              Deck
            </span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
        )}
        <button
          onClick={toggleCollapsed}
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
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

      <Separator className="bg-sidebar-border" />

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
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
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
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
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Settings className="size-4 shrink-0" />
            {!collapsed && "Settings"}
          </Link>
        </div>
      </nav>

      <div className="shrink-0 px-3 pb-12">
        {collapsed ? (
          <Button
            asChild
            size="icon"
            title="New Session"
          >
            <Link href="/sessions/new">
              <Plus className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
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
