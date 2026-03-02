"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface ActivityChartProps {
  data: { date: string; count: number; cost: number }[]
  label?: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function ActivityChart({ data, label }: ActivityChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div>
      {label && (
        <p className="mb-3 text-sm font-medium text-muted-foreground">{label}</p>
      )}
      <div className="relative">
        <div className="flex items-end gap-[3px]" style={{ height: 160 }}>
          {data.slice(-30).map((item, i) => {
            const heightPct = (item.count / maxCount) * 100
            const isHovered = hovered === i

            return (
              <div
                key={item.date}
                className="relative flex flex-1 flex-col items-center justify-end"
                style={{ height: "100%" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {isHovered && (
                  <div className="absolute -top-14 z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-lg whitespace-nowrap">
                    <p className="font-medium text-popover-foreground">{item.count} sessions</p>
                    <p className="text-muted-foreground">${item.cost.toFixed(2)}</p>
                  </div>
                )}
                <div
                  className={cn(
                    "w-full min-h-[2px] rounded-sm transition-colors",
                    isHovered ? "bg-foreground/50" : "bg-muted-foreground/40"
                  )}
                  style={{ height: `${Math.max(heightPct, 1.5)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex gap-[3px]">
          {data.slice(-30).map((item, i) => (
            <div key={item.date} className="flex-1 text-center">
              {i % Math.ceil(data.slice(-30).length / 7) === 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {formatDate(item.date)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
