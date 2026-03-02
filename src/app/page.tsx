import { execFileSync } from "child_process"
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
import { DailyDigest } from "@/components/daily-digest"
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
      const output = execFileSync(
        "git",
        ["-C", project.path, "log", "--oneline", "--since=midnight"],
        { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
      ).trim()
      commitsToday += output ? output.split("\n").filter(Boolean).length : 0
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {getGreeting()}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You have <span className="font-medium text-foreground">{stats.totalSessions}</span> sessions
          across <span className="font-medium text-foreground">{projectCount}</span> projects.
          {topProject && <> <span className="font-medium text-foreground">{topProject.name}</span> has the most activity.</>}
          {commitsToday > 0 && <> You&apos;ve landed <span className="font-medium text-foreground">{commitsToday}</span> commits today.</>}
          {" "}Total spend: <span className="font-medium text-foreground">{formatCost(stats.totalCost)}</span>.
        </p>
      </div>

      {/* Favorites */}
      <FavoritesBar />

      {/* Daily Digest */}
      <DailyDigest sessions={allSessions} />

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
        {/* Row 1: Activity + Budget */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetWidget spent={periodCost} budget={budget} periodStart={periodStartISO} />
          </CardContent>
        </Card>

        {/* Row 2: Cost Trend + When You Work */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cost Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostTrendChart data={costTrend} days={30} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
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

        {/* Row 3: Three equal columns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Coding Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StreakWidget dailyActivity={stats.dailyActivity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HighlightsWidget sessions={allSessions} totalCost={stats.totalCost} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      {stats.recentSessions.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
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
