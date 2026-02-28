import { NextRequest, NextResponse } from "next/server"
import { listSessions, getPeriodCost } from "@/lib/claude/sessions"
import { getSettings } from "@/lib/settings"
import {
  generateNotifications,
  getDismissed,
  dismissNotification,
} from "@/lib/notifications"

function getBudgetPeriodStart(resetDay: number): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // If we haven't reached the reset day this month, period started last month
  if (now.getDate() < resetDay) {
    const start = new Date(year, month - 1, resetDay)
    return start.toISOString()
  }
  return new Date(year, month, resetDay).toISOString()
}

export async function GET() {
  try {
    const [sessions, settings, dismissed] = await Promise.all([
      listSessions(),
      getSettings(),
      getDismissed(),
    ])

    const periodStart = getBudgetPeriodStart(settings.budgetResetDay)
    const periodCost = await getPeriodCost(periodStart)

    const all = generateNotifications(sessions, settings.budget, periodCost)
    const active = all.filter((n) => !dismissed.includes(n.id))

    return NextResponse.json({
      notifications: active,
      unreadCount: active.length,
    })
  } catch (error) {
    console.error("Failed to generate notifications:", error)
    return NextResponse.json(
      { error: "Failed to generate notifications" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required and must be a string" },
        { status: 400 }
      )
    }

    await dismissNotification(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to dismiss notification:", error)
    return NextResponse.json(
      { error: "Failed to dismiss notification" },
      { status: 500 }
    )
  }
}
