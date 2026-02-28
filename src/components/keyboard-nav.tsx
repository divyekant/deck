"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ShortcutsModal } from "@/components/shortcuts-modal"

const GOTO_ROUTES: Record<string, string> = {
  h: "/",
  s: "/sessions",
  a: "/analytics",
  c: "/costs",
  l: "/live",
  r: "/repos",
  t: "/timeline",
  p: "/pulse",
  d: "/diffs",
  k: "/skills",
  w: "/work-graph",
  n: "/snapshots",
  o: "/ports",
  m: "/compare",
}

const GOTO_TIMEOUT = 1500

function isEditableTarget(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if ((e.target as HTMLElement)?.isContentEditable) return true
  return false
}

export function KeyboardNav() {
  const router = useRouter()
  const [gotoMode, setGotoMode] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearGotoTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const exitGotoMode = useCallback(() => {
    clearGotoTimeout()
    setGotoMode(false)
  }, [clearGotoTimeout])

  const enterGotoMode = useCallback(() => {
    clearGotoTimeout()
    setGotoMode(true)
    timeoutRef.current = setTimeout(() => {
      setGotoMode(false)
    }, GOTO_TIMEOUT)
  }, [clearGotoTimeout])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in form elements
      if (isEditableTarget(e)) return

      // Don't interfere with Cmd+K or other modifier combos
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // ? (Shift+/) opens help
      if (e.key === "?" && e.shiftKey) {
        e.preventDefault()
        setShowHelp(true)
        return
      }

      // Escape closes goto mode
      if (e.key === "Escape") {
        if (gotoMode) {
          e.preventDefault()
          exitGotoMode()
        }
        return
      }

      // In goto mode, check for second key
      if (gotoMode) {
        const route = GOTO_ROUTES[e.key.toLowerCase()]
        if (route) {
          e.preventDefault()
          exitGotoMode()
          router.push(route)
        } else {
          // Invalid second key — exit goto mode
          exitGotoMode()
        }
        return
      }

      // First press of g enters goto mode
      if (e.key === "g" && !e.shiftKey) {
        e.preventDefault()
        enterGotoMode()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [gotoMode, exitGotoMode, enterGotoMode, router])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearGotoTimeout()
  }, [clearGotoTimeout])

  return (
    <>
      {/* Goto mode indicator */}
      {gotoMode && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 shadow-lg">
            <kbd className="inline-flex items-center rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-zinc-300">
              g
            </kbd>
            <span className="text-sm text-zinc-400">Go to...</span>
          </div>
        </div>
      )}

      {/* Shortcuts help modal */}
      <ShortcutsModal open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  )
}
