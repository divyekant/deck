"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { MessageSquare, GitBranch, LayoutDashboard, X, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface Favorite {
  id: string
  type: "session" | "project" | "page"
  targetId: string
  label: string
  addedAt: string
}

const typeIcon = {
  session: MessageSquare,
  project: GitBranch,
  page: LayoutDashboard,
} as const

function targetUrl(type: Favorite["type"], targetId: string): string {
  switch (type) {
    case "session":
      return `/sessions/${targetId}`
    case "project":
      return `/repos/${targetId}`
    case "page":
      return targetId
  }
}

export function FavoritesBar() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [removing, setRemoving] = useState<string | null>(null)
  const router = useRouter()

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch("/api/favorites")
      if (!res.ok) return
      const data = await res.json()
      setFavorites(data.favorites ?? [])
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  async function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    e.preventDefault()
    setRemoving(id)
    try {
      const res = await fetch(`/api/favorites?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setFavorites((prev) => prev.filter((f) => f.id !== id))
      }
    } catch {
      // silently ignore
    } finally {
      setRemoving(null)
    }
  }

  if (favorites.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Star className="size-3.5 text-zinc-500" />
        <span className="text-xs font-medium text-zinc-500">Favorites</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-700">
        {favorites.map((fav) => {
          const Icon = typeIcon[fav.type]
          return (
            <button
              key={fav.id}
              onClick={() => router.push(targetUrl(fav.type, fav.targetId))}
              className={cn(
                "group relative flex min-w-[150px] max-w-[180px] shrink-0 items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/80",
                removing === fav.id && "opacity-50 pointer-events-none"
              )}
            >
              <Icon className="size-4 shrink-0 text-zinc-500" />
              <span className="truncate text-sm text-zinc-300">
                {fav.label}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleRemove(e, fav.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleRemove(e as unknown as React.MouseEvent, fav.id)
                  }
                }}
                className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 group-hover:flex"
              >
                <X className="size-3" />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
