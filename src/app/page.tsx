import Link from "next/link"
import { MessageSquare, DollarSign, Cpu, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "@/components/stats-card"
import { SessionCard } from "@/components/session-card"
import { ActivityChart } from "@/components/activity-chart"
import { CostBreakdown } from "@/components/cost-breakdown"
import { WorkHoursChart } from "@/components/work-hours-chart"
import { BudgetWidget } from "@/components/budget-widget"
import { getOverviewStats, getWorkHoursData } from "@/lib/claude/sessions"
import { formatCost } from "@/lib/claude/costs"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default async function Home() {
  const [stats, workHours] = await Promise.all([
    getOverviewStats(),
    getWorkHoursData(),
  ])

  const budget = 500

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {getGreeting()}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You have {stats.totalSessions} sessions across your projects. Total
          spend: {formatCost(stats.totalCost)}.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Sessions"
          value={stats.totalSessions}
          icon={MessageSquare}
        />
        <StatsCard
          title="Total Cost"
          value={formatCost(stats.totalCost)}
          icon={DollarSign}
        />
        <StatsCard
          title="Models Used"
          value={stats.modelBreakdown.length}
          icon={Cpu}
        />
        <StatsCard
          title="Active Days"
          value={`${stats.dailyActivity.length} / 30`}
          icon={Calendar}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column — Activity chart (spans 2 cols on lg) */}
        <div className="lg:col-span-2">
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-300">
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.dailyActivity.length > 0 ? (
                <ActivityChart
                  data={stats.dailyActivity.map((d) => ({
                    date: d.date,
                    count: d.sessionCount,
                    cost: d.cost,
                  }))}
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No activity in the last 30 days.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — Budget + When You Work + Cost by Model */}
        <div className="flex flex-col gap-6">
          {/* Budget */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-300">
                Budget
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetWidget spent={stats.totalCost} budget={budget} />
            </CardContent>
          </Card>

          {/* When You Work */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-300">
                When You Work
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workHours.some((h) => h.count > 0) ? (
                <WorkHoursChart data={workHours} />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No session data yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cost by Model */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-300">
                Cost by Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.modelBreakdown.length > 0 ? (
                <CostBreakdown
                  data={stats.modelBreakdown.map((m) => ({
                    model: m.model,
                    cost: m.totalCost,
                    sessions: m.sessionCount,
                  }))}
                  total={stats.totalCost}
                />
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No model data available.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Sessions */}
      {stats.recentSessions.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-100">
            Recent Sessions
          </h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {stats.recentSessions.map((s) => (
              <Link key={s.id} href={`/sessions/${s.id}`}>
                <SessionCard
                  id={s.id}
                  projectName={s.projectName}
                  firstPrompt={s.firstPrompt}
                  model={s.model}
                  messageCount={s.messageCount}
                  estimatedCost={s.estimatedCost}
                  startTime={s.startTime}
                />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
