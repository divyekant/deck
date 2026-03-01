"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  MessageSquare,
  DollarSign,
  Radio,
  Menu,
  X,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { navSections } from "@/components/sidebar"

const primaryItems = [
  { name: "Home", href: "/", icon: BarChart3 },
  { name: "Sessions", href: "/sessions", icon: MessageSquare },
  { name: "Costs", href: "/costs", icon: DollarSign },
  { name: "Live", href: "/live", icon: Radio },
]

export function MobileNav() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Close sheet on route change
  useEffect(() => {
    setSheetOpen(false)
  }, [pathname])

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [sheetOpen])

  const toggleSheet = useCallback(() => {
    setSheetOpen((prev) => !prev)
  }, [])

  const closeSheet = useCallback(() => {
    setSheetOpen(false)
  }, [])

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  // Check if "More" should appear active — when current route isn't one of the primary items
  const isPrimaryRoute = primaryItems.some((item) => isActive(item.href))

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="flex h-16 items-stretch">
          {primaryItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors",
                  active ? "text-emerald-400" : "text-zinc-500"
                )}
              >
                <item.icon className="size-5" />
                <span>{item.name}</span>
              </Link>
            )
          })}

          {/* More button */}
          <button
            onClick={toggleSheet}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors",
              sheetOpen || !isPrimaryRoute
                ? "text-emerald-400"
                : "text-zinc-500"
            )}
          >
            <Menu className="size-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* Overlay */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSheet}
        />
      )}

      {/* More Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900 transition-transform duration-300 ease-out lg:hidden",
          sheetOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Sheet header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
          <span className="text-sm font-medium text-zinc-200">Navigation</span>
          <button
            onClick={closeSheet}
            className="flex size-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Sheet content — all nav sections */}
        <div className="px-4 py-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
                {section.label}
              </span>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeSheet}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-zinc-800 text-emerald-400"
                          : "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100"
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Settings */}
          <div className="mb-4">
            <div className="space-y-0.5">
              <Link
                href="/settings"
                onClick={closeSheet}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive("/settings")
                    ? "bg-zinc-800 text-emerald-400"
                    : "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100"
                )}
              >
                <Settings className="size-4 shrink-0" />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
