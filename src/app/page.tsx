import { execSync } from "child_process"
import Link from "next/link"
import { MessageSquare, DollarSign, Cpu, Calendar, GitCommitHorizontal } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatsCard } from "@/components/stats-card"
import { SessionCard } from "@/components/session-card"
import { ActivityChart } from "@/components/activity-chart"
import { CostTrendChart } from "@/components/cost-trend-chart"
import { CostBreakdown } from "@/components/cost-breakdown"
import { WorkHoursChart } from "@/components/work-hours-chart"
import { BudgetWidget } from "@/components/budget-widget"
import { StreakWidget } from "@/components/streak-widget"
import { HighlightsWidget } from "@/components/highlights-widget"
import { FavoritesBar } from "@/components/favorites-bar"
import { getOverviewStats, getWorkHoursData, getCostTrend, getPeriodCost, getProjectDirs, listSessions } from "@/lib/claude/sessions"
import { formatCost } from "@/lib/claude/costs"
import { getSettings } from "@/lib/settings"

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default async function Home() {
  const [stats, workHours, settings, costTrend, projectDirs, allSessions] = await Promise.all([
    getOverviewStats(),
    getWorkHoursData(),
    getSettings(),
    getCostTrend(90),
    getProjectDirs(),
    listSessions(),
  ])

  // Count today's commits across all projects
  let commitsToday = 0
  for (const project of projectDirs) {
    try {
      const output = execSync(
        `git -C "${project.path}" log --oneline --since="midnight" 2>/dev/null | wc -l`,
        { encoding: "utf-8", timeout: 5000 }
      )
      commitsToday += parseInt(output.trim(), 10) || 0
    } catch {
      // Not a git repo or git failed — skip
    }
  }

  // Find project with most sessions
  const projectCounts = new Map<string, number>()
  for (const session of allSessions) {
    const count = projectCounts.get(session.projectName) ?? 0
    projectCounts.set(session.projectName, count + 1)
  }
  let topProject: { name: string; sessions: number } | null = null
  let maxCount = 0
  for (const [name, count] of projectCounts) {
    if (count > maxCount) {
      maxCount = count
      topProject = { name, sessions: count }
    }
  }

  const projectCount = projectDirs.length

  const budget = settings.budget

  // Calculate current budget period start based on settings.budgetResetDay
  const now = new Date()
  const resetDay = settings.budgetResetDay
  let periodStart: Date
  if (now.getDate() >= resetDay) {
    periodStart = new Date(now.getFullYear(), now.getMonth(), resetDay)
  } else {
    periodStart = new Date(now.getFullYear(), now.getMonth() - 1, resetDay)
  }
  const periodStartISO = periodStart.toISOString()

  // Cost scoped to current budget period (not all-time)
  const periodCost = await getPeriodCost(periodStartISO)

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          {getGreeting()}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You have <span className="text-zinc-300 font-medium">{stats.totalSessions}</span> sessions
          across <span className="text-zinc-300 font-medium">{projectCount}</span> projects.
          {topProject && <> <span className="text-zinc-300 font-medium">{topProject.name}</span> has the most activity.</>}
          {commitsToday > 0 && <> You&apos;ve landed <span className="text-zinc-300 font-medium">{commitsToday}</span> commits today.</>}
          {" "}Total spend: <span className="text-zinc-300 font-medium">{formatCost(stats.totalCost)}</span>.
        </p>
      </div>

      {/* Favorites */}
      <FavoritesBar />

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          title="Commits Today"
          value={commitsToday}
          icon={GitCommitHorizontal}
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
        {/* Left column — Activity chart + Cost Trend (spans 2 cols on lg) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
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

          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-300">
                Cost Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CostTrendChart data={costTrend} days={30} />
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
              <BudgetWidget spent={periodCost} budget={budget} periodStart={periodStartISO} />
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

          {/* Coding Streak */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-300">
                Coding Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StreakWidget dailyActivity={stats.dailyActivity} />
            </CardContent>
          </Card>

          {/* Highlights */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-300">
                Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <HighlightsWidget sessions={allSessions} totalCost={stats.totalCost} />
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
                  source={s.source}
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
