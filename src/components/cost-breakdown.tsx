import { Separator } from "@/components/ui/separator"

interface CostBreakdownProps {
  data: { model: string; cost: number; sessions: number }[]
  total: number
}

const modelColors: Record<string, string> = {
  opus: "bg-orange-500",
  sonnet: "bg-blue-500",
  haiku: "bg-emerald-500",
}

function getModelColor(model: string): string {
  const lower = model.toLowerCase()
  for (const [key, color] of Object.entries(modelColors)) {
    if (lower.includes(key)) return color
  }
  return "bg-zinc-500"
}

export function CostBreakdown({ data, total }: CostBreakdownProps) {
  return (
    <div>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.model} className="flex items-center gap-3">
            <span className={`size-2.5 shrink-0 rounded-full ${getModelColor(item.model)}`} />
            <span className="flex-1 text-sm text-zinc-300">{item.model}</span>
            <span className="text-xs text-muted-foreground">
              {item.sessions} session{item.sessions !== 1 ? "s" : ""}
            </span>
            <span className="w-20 text-right text-sm font-medium text-zinc-200">
              ${item.cost.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <Separator className="my-3 bg-zinc-800" />
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">Total</span>
        <span className="text-sm font-semibold text-zinc-100">${total.toFixed(2)}</span>
      </div>
    </div>
  )
}
