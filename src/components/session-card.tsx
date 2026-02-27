import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, DollarSign, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface SessionCardProps {
  id: string
  source?: 'claude-code' | 'codex'
  projectName: string
  firstPrompt: string
  model: string
  messageCount: number
  estimatedCost: number
  startTime: string
  onClick?: () => void
}

function truncate(str: string, max: number) {
  if (str.length <= max) return str
  return str.slice(0, max).trimEnd() + "..."
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function SessionCard({
  id,
  source = 'claude-code',
  projectName,
  firstPrompt,
  model,
  messageCount,
  estimatedCost,
  startTime,
  onClick,
}: SessionCardProps) {
  const isCodex = source === 'codex'
  return (
    <Card
      className={cn(
        "cursor-pointer border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="pt-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px]",
                  isCodex
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-zinc-800 text-zinc-300"
                )}
              >
                {isCodex ? "Codex" : "CC"}
              </Badge>
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                {projectName}
              </Badge>
              <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px]">
                {model}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
              {truncate(firstPrompt, 80)}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3" />
            {messageCount}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="size-3" />
            ${estimatedCost.toFixed(2)}
          </span>
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="size-3" />
            {relativeTime(startTime)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
