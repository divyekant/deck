"use client"

import { useMemo } from "react"
import { Lightbulb } from "lucide-react"
import { formatCost } from "@/lib/claude/costs"

interface SessionData {
  model: string
  messageCount: number
  estimatedCost: number
  startTime: string
  projectName: string
  cacheReadTokens: number
  totalInputTokens: number
}

interface Tip {
  text: string
  badge: string
  badgeColor: string
}

export default function CostTips({ sessions }: { sessions: SessionData[] }) {
  const tips = useMemo(() => {
    if (sessions.length === 0) return []

    const result: Tip[] = []

    // 1. Haiku savings: sessions using opus/sonnet with <10 messages
    const shortExpensive = sessions.filter((s) => {
      const m = s.model.toLowerCase()
      return (
        (m.includes("opus") || m.includes("sonnet")) &&
        s.messageCount < 10
      )
    })
    if (shortExpensive.length > 0) {
      const currentCost = shortExpensive.reduce(
        (sum, s) => sum + s.estimatedCost,
        0
      )
      // Haiku is roughly 10x cheaper
      const potentialSavings = currentCost * 0.9
      if (potentialSavings > 0.5) {
        result.push({
          text: `You could save ~${formatCost(potentialSavings)}/mo by using Haiku for short sessions (<10 messages)`,
          badge: formatCost(potentialSavings),
          badgeColor: "bg-emerald-900/60 text-emerald-300",
        })
      }
    }

    // 2. Cache hit rate
    const totalCacheRead = sessions.reduce(
      (sum, s) => sum + s.cacheReadTokens,
      0
    )
    const totalInput = sessions.reduce(
      (sum, s) => sum + s.totalInputTokens,
      0
    )
    if (totalInput > 0) {
      const cacheRate = Math.round((totalCacheRead / totalInput) * 100)
      if (cacheRate < 50) {
        result.push({
          text: `Your cache hit rate is ${cacheRate}%. Longer sessions with consistent context improve cache efficiency.`,
          badge: `${cacheRate}%`,
          badgeColor: "bg-amber-900/60 text-amber-300",
        })
      }
    }

    // 3. Peak hour
    const hourCosts = new Map<number, number>()
    for (const s of sessions) {
      const hour = new Date(s.startTime).getHours()
      hourCosts.set(hour, (hourCosts.get(hour) ?? 0) + s.estimatedCost)
    }
    if (hourCosts.size > 0) {
      let peakHour = 0
      let peakCost = 0
      for (const [hour, cost] of hourCosts) {
        if (cost > peakCost) {
          peakHour = hour
          peakCost = cost
        }
      }
      if (peakCost > 1) {
        const label =
          peakHour === 0
            ? "12am"
            : peakHour < 12
              ? `${peakHour}am`
              : peakHour === 12
                ? "12pm"
                : `${peakHour - 12}pm`
        result.push({
          text: `Your most expensive hour is ${label} with ${formatCost(peakCost)} spent`,
          badge: label,
          badgeColor: "bg-blue-900/60 text-blue-300",
        })
      }
    }

    // 4. Project concentration
    const totalCost = sessions.reduce(
      (sum, s) => sum + s.estimatedCost,
      0
    )
    if (totalCost > 0) {
      const projectCosts = new Map<string, number>()
      for (const s of sessions) {
        projectCosts.set(
          s.projectName,
          (projectCosts.get(s.projectName) ?? 0) + s.estimatedCost
        )
      }
      for (const [project, cost] of projectCosts) {
        const pct = Math.round((cost / totalCost) * 100)
        if (pct > 40) {
          result.push({
            text: `${pct}% of your spend goes to ${project} \u2014 consider optimizing its sessions`,
            badge: `${pct}%`,
            badgeColor: "bg-violet-900/60 text-violet-300",
          })
          break // only show for the top project
        }
      }
    }

    // 5. Short session waste
    const shortSessions = sessions.filter((s) => s.messageCount < 3)
    if (shortSessions.length >= 3) {
      result.push({
        text: `${shortSessions.length} sessions had fewer than 3 messages \u2014 batching these could reduce overhead`,
        badge: `${shortSessions.length}`,
        badgeColor: "bg-orange-900/60 text-orange-300",
      })
    }

    return result
  }, [sessions])

  if (tips.length === 0) return null

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-4 text-sm font-medium text-zinc-300">
        Optimization Insights
      </h2>
      <div className="space-y-3">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-md border border-zinc-800/50 bg-zinc-950/50 px-4 py-3"
          >
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="flex-1 text-sm text-zinc-300">{tip.text}</p>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tip.badgeColor}`}
            >
              {tip.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
