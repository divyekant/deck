import { Separator } from "@/components/ui/separator"

interface CostBreakdownProps {
  data: { model: string; cost: number; sessions: number }[]
  total: number
}

const modelColors: Record<string, string> = {
  opus: "bg-orange-500",
  sonnet: "bg-blue-500",
  haiku: "bg-emerald-500",
  gpt: "bg-purple-500",
  o3: "bg-purple-500",
  o4: "bg-purple-500",
  codex: "bg-cyan-500",
}

function getModelColor(model: string): string {
  const lower = model.toLowerCase()
  for (const [key, color] of Object.entries(modelColors)) {
    if (lower.includes(key)) return color
  }
  return "bg-zinc-500"
}

export function CostBreakdown({ data, total }: CostBreakdownProps) {
  const maxCost = Math.max(...data.map((d) => d.cost), 0)

  return (
    <div>
      <div className="space-y-4">
        {data.map((item) => {
          const widthPercent = maxCost > 0 ? (item.cost / maxCost) * 100 : 0
          return (
            <div key={item.model} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">{item.model}</span>
                <span className="text-sm font-medium text-zinc-200">
                  ${item.cost.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-zinc-800">
                  <div
                    className={`h-2 rounded-full ${getModelColor(item.model)}`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.sessions} session{item.sessions !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <Separator className="my-3 bg-zinc-800" />
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-300">Total</span>
        <span className="text-sm font-semibold text-zinc-100">${total.toFixed(2)}</span>
      </div>
    </div>
  )
}
