"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Terminal, ChevronRight } from "lucide-react"

interface ToolCallViewProps {
  name: string
  input: Record<string, unknown>
  result?: string
}

function truncateJson(obj: Record<string, unknown>, max: number): string {
  const str = JSON.stringify(obj, null, 2)
  if (str.length <= max) return str
  return str.slice(0, max) + "\n..."
}

export function ToolCallView({ name, input, result }: ToolCallViewProps) {
  const [showInput, setShowInput] = useState(false)
  const [showResult, setShowResult] = useState(false)

  return (
    <div className="my-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <Terminal className="size-3.5 text-zinc-500" />
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-300 text-xs font-mono">
          {name}
        </Badge>
        <button
          onClick={() => setShowInput(!showInput)}
          className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-zinc-300 transition-colors"
        >
          <ChevronRight
            className={cn("size-3 transition-transform", showInput && "rotate-90")}
          />
          input
        </button>
        {result !== undefined && (
          <button
            onClick={() => setShowResult(!showResult)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-zinc-300 transition-colors"
          >
            <ChevronRight
              className={cn("size-3 transition-transform", showResult && "rotate-90")}
            />
            result
          </button>
        )}
      </div>

      {showInput && (
        <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-400 leading-relaxed">
          {truncateJson(input, 500)}
        </pre>
      )}

      {showResult && result !== undefined && (
        <pre className="mt-2 overflow-x-auto rounded bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-400 leading-relaxed">
          {result.length > 500 ? result.slice(0, 500) + "\n..." : result}
        </pre>
      )}
    </div>
  )
}
