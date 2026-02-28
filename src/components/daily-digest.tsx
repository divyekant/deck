import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCost } from "@/lib/claude/costs"
import type { SessionMeta } from "@/lib/claude/types"

interface DailyDigestProps {
  sessions: SessionMeta[]
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

export function DailyDigest({ sessions }: DailyDigestProps) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  // Filter to yesterday's sessions first
  let targetSessions = sessions.filter(
    (s) => s.startTime.slice(0, 10) === yesterdayStr
  )
  let heading = "Yesterday's Digest"

  // If yesterday has no sessions but today does, show today
  if (targetSessions.length === 0) {
    const todaySessions = sessions.filter(
      (s) => s.startTime.slice(0, 10) === todayStr
    )
    if (todaySessions.length > 0) {
      targetSessions = todaySessions
      heading = "Today So Far"
    }
  }

  // No data
  if (targetSessions.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-300">
            Yesterday&apos;s Digest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">No sessions yesterday.</p>
        </CardContent>
      </Card>
    )
  }

  // Compute stats
  const sessionCount = targetSessions.length
  const totalCost = targetSessions.reduce((sum, s) => sum + s.estimatedCost, 0)
  const uniqueProjects = new Set(targetSessions.map((s) => s.projectName))
  const projectCount = uniqueProjects.size

  // Most used model
  const modelCounts = new Map<string, number>()
  for (const s of targetSessions) {
    modelCounts.set(s.model, (modelCounts.get(s.model) ?? 0) + 1)
  }
  let topModel = ""
  let topModelCount = 0
  for (const [model, count] of modelCounts) {
    if (count > topModelCount) {
      topModelCount = count
      topModel = model
    }
  }

  // Cache hit rate
  const totalCacheRead = targetSessions.reduce(
    (sum, s) => sum + s.cacheReadTokens,
    0
  )
  const totalInput = targetSessions.reduce(
    (sum, s) => sum + s.totalInputTokens,
    0
  )
  const cacheTotal = totalCacheRead + totalInput
  const cacheHitRate = cacheTotal > 0 ? (totalCacheRead / cacheTotal) * 100 : 0

  // Top project by cost
  const projectCostMap = new Map<string, number>()
  for (const s of targetSessions) {
    projectCostMap.set(
      s.projectName,
      (projectCostMap.get(s.projectName) ?? 0) + s.estimatedCost
    )
  }
  let topProject = ""
  let topProjectCost = 0
  for (const [proj, cost] of projectCostMap) {
    if (cost > topProjectCost) {
      topProjectCost = cost
      topProject = proj
    }
  }

  // Daily average (last 30 days)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const activeDays = new Set<string>()
  let last30Cost = 0
  for (const s of sessions) {
    const sessionDate = new Date(s.startTime)
    if (sessionDate >= thirtyDaysAgo) {
      const dateKey = s.startTime.slice(0, 10)
      activeDays.add(dateKey)
      last30Cost += s.estimatedCost
    }
  }
  const activeDayCount = Math.max(activeDays.size, 1)
  const dailyAverage = last30Cost / activeDayCount
  const isAboveAverage = totalCost > dailyAverage

  // Longest session
  let longestSession: SessionMeta | null = null
  for (const s of targetSessions) {
    if (!longestSession || s.duration > longestSession.duration) {
      longestSession = s
    }
  }

  // Total duration
  const totalDuration = targetSessions.reduce((sum, s) => sum + s.duration, 0)

  // Project session counts for details
  const projectSessionCounts = new Map<string, number>()
  for (const s of targetSessions) {
    projectSessionCounts.set(
      s.projectName,
      (projectSessionCounts.get(s.projectName) ?? 0) + 1
    )
  }

  // Model breakdown for details
  const modelBreakdown = Array.from(modelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([model, count]) => ({ model, count }))

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-zinc-300">
          {heading}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Natural language summary */}
        <p className="text-sm text-zinc-400 leading-relaxed">
          You had{" "}
          <span className="text-zinc-200 font-medium">{sessionCount}</span>{" "}
          session{sessionCount !== 1 ? "s" : ""} across{" "}
          <span className="text-zinc-200 font-medium">{projectCount}</span>{" "}
          project{projectCount !== 1 ? "s" : ""}. You spent{" "}
          <span className="text-zinc-200 font-medium">
            {formatCost(totalCost)}
          </span>
          {projectCount > 1 && (
            <>
              , mostly on{" "}
              <span className="text-zinc-200 font-medium">{topProject}</span>
            </>
          )}
          . Cache hit rate was{" "}
          <span className="text-zinc-200 font-medium">
            {cacheHitRate.toFixed(0)}%
          </span>
          .
        </p>

        {/* Comparison badge */}
        <div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isAboveAverage
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            }`}
          >
            {isAboveAverage ? "Above average" : "Below average"} vs daily mean (
            {formatCost(dailyAverage)}/day)
          </span>
        </div>

        {/* Expandable details */}
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-400 transition-colors list-none flex items-center gap-1">
            <svg
              className="size-3 transition-transform group-open:rotate-90"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            Details
          </summary>

          <div className="mt-3 space-y-3 text-sm">
            {/* Projects */}
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-1.5">
                Projects
              </p>
              <div className="space-y-1">
                {Array.from(projectSessionCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([project, count]) => (
                    <div
                      key={project}
                      className="flex items-center justify-between text-zinc-400"
                    >
                      <span>{project}</span>
                      <span className="text-zinc-500">
                        {count} session{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Models */}
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Models</p>
              <div className="space-y-1">
                {modelBreakdown.map(({ model, count }) => (
                  <div
                    key={model}
                    className="flex items-center justify-between text-zinc-400"
                  >
                    <span>{model}</span>
                    <span className="text-zinc-500">
                      {count} session{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Longest session */}
            {longestSession && (
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">
                  Longest Session
                </p>
                <p className="text-zinc-400">
                  {longestSession.projectName} &mdash;{" "}
                  {formatDuration(longestSession.duration)}
                </p>
              </div>
            )}

            {/* Total duration */}
            <div>
              <p className="text-xs font-medium text-zinc-500 mb-1">
                Total Duration
              </p>
              <p className="text-zinc-400">{formatDuration(totalDuration)}</p>
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
