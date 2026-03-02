import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface BudgetWidgetProps {
  spent: number
  budget: number
  periodStart?: string // ISO date string
}

export function BudgetWidget({ spent, budget, periodStart }: BudgetWidgetProps) {
  const pct = budget > 0 ? (spent / budget) * 100 : 0
  const clampedPct = Math.min(pct, 100)

  const barColor =
    pct > 90
      ? "bg-red-500"
      : pct > 70
        ? "bg-amber-500"
        : "bg-emerald-500"

  const textColor =
    pct > 90
      ? "text-red-400"
      : pct > 70
        ? "text-amber-400"
        : "text-emerald-400"

  // Projection calculation
  let projectedTotal: number | null = null
  let dailyBurn: number | null = null

  if (periodStart) {
    const start = new Date(periodStart)
    const now = new Date()
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

    // Days in the current month-long period
    const periodEnd = new Date(start)
    periodEnd.setMonth(periodEnd.getMonth() + 1)
    const daysInPeriod = Math.floor((periodEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    dailyBurn = spent / daysElapsed
    projectedTotal = dailyBurn * daysInPeriod
  }

  const projectionColor = projectedTotal !== null
    ? projectedTotal > budget * 1.5
      ? "text-red-500"
      : projectedTotal > budget
        ? "text-amber-500"
        : "text-muted-foreground"
    : "text-muted-foreground"

  const showWarning = projectedTotal !== null && projectedTotal > budget

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs">
        <span className={cn("font-medium", textColor)}>
          ${spent.toFixed(2)} spent
        </span>
        <span className="text-muted-foreground">
          ${budget.toFixed(2)} budget
        </span>
      </div>

      {/* Projection & Daily Burn */}
      {projectedTotal !== null && dailyBurn !== null && (
        <div className="flex items-center justify-between text-xs pt-1">
          <span className={cn("flex items-center gap-1", projectionColor)}>
            {showWarning && <AlertTriangle className="size-3" />}
            Projected: ${projectedTotal.toFixed(2)}
          </span>
          <span className="text-muted-foreground">
            ~${dailyBurn.toFixed(2)}/day
          </span>
        </div>
      )}
    </div>
  )
}
