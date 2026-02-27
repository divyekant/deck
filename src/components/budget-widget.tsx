import { cn } from "@/lib/utils"

interface BudgetWidgetProps {
  spent: number
  budget: number
}

export function BudgetWidget({ spent, budget }: BudgetWidgetProps) {
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

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
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
    </div>
  )
}
