import { Flame } from "lucide-react"
import type { DailyActivity } from "@/lib/claude/types"

interface StreakWidgetProps {
  dailyActivity: DailyActivity[]
}

export function StreakWidget({ dailyActivity }: StreakWidgetProps) {
  // Build a Set of dates that have sessions
  const activeDates = new Set(dailyActivity.map((d) => d.date))

  // Generate last 30 days as YYYY-MM-DD strings (today first, then backwards)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const last30: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    last30.push(d.toISOString().slice(0, 10))
  }

  // Current streak: consecutive days with sessions going backwards from today
  let currentStreak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    if (activeDates.has(dateStr)) {
      currentStreak++
    } else {
      break
    }
  }

  // Longest streak: find the longest consecutive run in the data
  // Build a sorted list of all dates in range, check consecutive runs
  const allDates = Array.from(activeDates).sort()
  let longestStreak = 0
  let runLength = 0

  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) {
      runLength = 1
    } else {
      const prev = new Date(allDates[i - 1])
      const curr = new Date(allDates[i])
      const diffMs = curr.getTime() - prev.getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays === 1) {
        runLength++
      } else {
        runLength = 1
      }
    }
    longestStreak = Math.max(longestStreak, runLength)
  }

  return (
    <div className="space-y-4">
      {/* Big streak number */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">
          {currentStreak}
        </span>
        <span className="text-sm text-muted-foreground">days</span>
        {currentStreak > 0 && (
          <Flame className="size-5 text-orange-500" />
        )}
      </div>

      {/* Substat */}
      <p className="text-xs text-muted-foreground">
        Longest: {longestStreak} days
      </p>

      {/* Calendar grid — last 30 days */}
      <div className="flex flex-wrap gap-1.5">
        {last30.map((date) => {
          const isActive = activeDates.has(date)
          const isToday = date === todayStr
          return (
            <div
              key={date}
              className={`size-3 rounded-full ${
                isActive ? "bg-emerald-500" : "bg-muted"
              } ${isToday ? "ring-1 ring-ring ring-offset-1 ring-offset-background" : ""}`}
              title={date}
            />
          )
        })}
      </div>
    </div>
  )
}
