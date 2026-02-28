import { promises as fs } from "fs"
import path from "path"
import os from "os"

import type { SessionMeta } from "./claude/types"

const DECK_DIR = path.join(os.homedir(), ".deck")
const NOTIFICATIONS_FILE = path.join(DECK_DIR, "notifications.json")

export interface Notification {
  id: string
  type: "budget" | "long-session" | "cost-spike"
  title: string
  message: string
  severity: "info" | "warning" | "critical"
  timestamp: string
  sessionId?: string
}

// ---- Dismissed state ----

export async function getDismissed(): Promise<string[]> {
  try {
    const raw = await fs.readFile(NOTIFICATIONS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

export async function dismissNotification(id: string): Promise<void> {
  const dismissed = await getDismissed()
  if (!dismissed.includes(id)) {
    dismissed.push(id)
  }
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(NOTIFICATIONS_FILE, JSON.stringify(dismissed, null, 2), "utf-8")
}

// ---- Generation ----

export function generateNotifications(
  sessions: SessionMeta[],
  budget: number,
  periodCost: number
): Notification[] {
  const notifications: Notification[] = []
  const today = new Date().toISOString().slice(0, 10)

  // Budget threshold notifications (mutually exclusive — show the highest)
  if (budget > 0) {
    const pct = periodCost / budget

    if (pct >= 1) {
      notifications.push({
        id: `budget-100-${today}`,
        type: "budget",
        title: "Budget exceeded",
        message: `You've spent $${periodCost.toFixed(2)} of your $${budget.toFixed(2)} budget (${(pct * 100).toFixed(0)}%).`,
        severity: "critical",
        timestamp: new Date().toISOString(),
      })
    } else if (pct >= 0.9) {
      notifications.push({
        id: `budget-90-${today}`,
        type: "budget",
        title: "Budget nearly exhausted",
        message: `You've used $${periodCost.toFixed(2)} of your $${budget.toFixed(2)} budget (${(pct * 100).toFixed(0)}%).`,
        severity: "critical",
        timestamp: new Date().toISOString(),
      })
    } else if (pct >= 0.8) {
      notifications.push({
        id: `budget-80-${today}`,
        type: "budget",
        title: "Budget warning",
        message: `You've used $${periodCost.toFixed(2)} of your $${budget.toFixed(2)} budget (${(pct * 100).toFixed(0)}%).`,
        severity: "warning",
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Long session notifications (> 30 min in last 7 days)
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  for (const session of sessions) {
    const sessionTime = new Date(session.startTime).getTime()
    if (sessionTime >= sevenDaysAgo && session.duration > 1800000) {
      const mins = Math.round(session.duration / 60000)
      notifications.push({
        id: `long-session-${session.id}`,
        type: "long-session",
        title: "Long session detected",
        message: `Session in ${session.projectName} ran for ${mins} minutes ($${session.estimatedCost.toFixed(2)}).`,
        severity: "info",
        timestamp: session.startTime,
        sessionId: session.id,
      })
    }
  }

  // Cost spike: today's cost > 2x average daily cost
  const dailyCostMap = new Map<string, number>()
  for (const session of sessions) {
    const dateKey = new Date(session.startTime).toISOString().slice(0, 10)
    dailyCostMap.set(dateKey, (dailyCostMap.get(dateKey) ?? 0) + session.estimatedCost)
  }

  const todayCost = dailyCostMap.get(today) ?? 0
  const dailyCosts = Array.from(dailyCostMap.values())

  if (dailyCosts.length > 1 && todayCost > 0) {
    // Average excluding today for a fair comparison
    const otherDays = Array.from(dailyCostMap.entries())
      .filter(([date]) => date !== today)
      .map(([, cost]) => cost)

    if (otherDays.length > 0) {
      const avgDaily = otherDays.reduce((a, b) => a + b, 0) / otherDays.length

      if (avgDaily > 0 && todayCost > 2 * avgDaily) {
        notifications.push({
          id: `cost-spike-${today}`,
          type: "cost-spike",
          title: "Spending spike",
          message: `Today's cost ($${todayCost.toFixed(2)}) is ${(todayCost / avgDaily).toFixed(1)}x your daily average ($${avgDaily.toFixed(2)}).`,
          severity: "warning",
          timestamp: new Date().toISOString(),
        })
      }
    }
  }

  return notifications
}
