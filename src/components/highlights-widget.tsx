import { MessageSquare, DollarSign, GitBranch, Cpu } from "lucide-react"
import type { SessionMeta } from "@/lib/claude/types"
import { formatCost } from "@/lib/claude/costs"

interface HighlightsWidgetProps {
  sessions: SessionMeta[]
  totalCost: number
}

interface HighlightItem {
  icon: React.ReactNode
  text: string
}

export function HighlightsWidget({ sessions }: HighlightsWidgetProps) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  // Filter to today's sessions
  let targetSessions = sessions.filter((s) => s.startTime.slice(0, 10) === todayStr)
  let label = "Today's Highlights"

  // Fall back to yesterday if no sessions today
  if (targetSessions.length === 0) {
    targetSessions = sessions.filter((s) => s.startTime.slice(0, 10) === yesterdayStr)
    label = "Yesterday's Highlights"
  }

  // No data at all
  if (targetSessions.length === 0) {
    return (
      <div>
        <p className="text-sm text-zinc-500">No recent activity</p>
      </div>
    )
  }

  // Calculate stats
  const sessionCount = targetSessions.length
  const costToday = targetSessions.reduce((sum, s) => sum + s.estimatedCost, 0)

  const projectSet = new Set(targetSessions.map((s) => s.projectName))
  const projectCount = projectSet.size

  // Most used model
  const modelCounts = new Map<string, number>()
  for (const s of targetSessions) {
    modelCounts.set(s.model, (modelCounts.get(s.model) ?? 0) + 1)
  }
  let topModel = ""
  let topModelCount = 0
  for (const [model, count] of modelCounts) {
    if (count > topModelCount) {
      topModelCount = count
      topModel = model
    }
  }

  const iconClass = "size-4 text-zinc-500"

  const highlights: HighlightItem[] = [
    {
      icon: <MessageSquare className={iconClass} />,
      text: `${sessionCount} session${sessionCount !== 1 ? "s" : ""}`,
    },
    {
      icon: <DollarSign className={iconClass} />,
      text: `${formatCost(costToday)} spent`,
    },
    {
      icon: <GitBranch className={iconClass} />,
      text: `${projectCount} project${projectCount !== 1 ? "s" : ""}`,
    },
    {
      icon: <Cpu className={iconClass} />,
      text: `Top model: ${topModel}`,
    },
  ]

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="space-y-2.5">
        {highlights.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {item.icon}
            <span className="text-sm text-zinc-300">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
