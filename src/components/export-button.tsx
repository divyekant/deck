"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { sessionToMarkdown } from "@/lib/claude/export"
import type { SessionDetail } from "@/lib/claude/types"

interface ExportButtonProps {
  sessionId: string
}

export function ExportButton({ sessionId }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (!res.ok) throw new Error("Failed to fetch session")
      const detail: SessionDetail = await res.json()

      const markdown = sessionToMarkdown(detail)
      const blob = new Blob([markdown], { type: "text/markdown" })
      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = url
      a.download = `session-${sessionId.slice(0, 8)}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className="gap-1.5 text-zinc-400 hover:text-zinc-200"
    >
      {exporting ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5" />
      )}
      Export
    </Button>
  )
}
