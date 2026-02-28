import { execFileSync } from "child_process";
import Link from "next/link";
import {
  GitCommitHorizontal,
  Flame,
  GitBranch,
  MessageSquare,
  DollarSign,
  SnowflakeIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatsCard } from "@/components/stats-card";
import { getProjectDirs, listSessions } from "@/lib/claude/sessions";
import { formatCost } from "@/lib/claude/costs";
import { getProjectColor } from "@/lib/project-colors";
import type { SessionMeta } from "@/lib/claude/types";

// --- Data fetching (server-side) ---

interface RepoPulse {
  name: string;
  path: string;
  activityLevel: "hot" | "warm" | "cold";
  commitsThisWeek: number;
  branches: number;
  lastCommitDate: string | null;
  sessions7d: number;
  sessions30d: number;
  cost30d: number;
  sparkline: number[];
  lastSessionDate: string | null;
}

function gitCommand(projectPath: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", projectPath, ...args], {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

async function getPulseData() {
  const [projectDirs, allSessions] = await Promise.all([
    getProjectDirs(),
    listSessions(),
  ]);

  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Group sessions by project name
  const sessionsByProject = new Map<string, SessionMeta[]>();
  for (const session of allSessions) {
    const existing = sessionsByProject.get(session.projectName) ?? [];
    existing.push(session);
    sessionsByProject.set(session.projectName, existing);
  }

  let totalCommitsThisWeek = 0;
  let mostActiveRepo: string | null = null;
  let mostActiveScore = -1;
  let reposWithNoActivity = 0;

  const repos: RepoPulse[] = [];

  for (const project of projectDirs) {
    const commitOutput = gitCommand(
      project.path,
      ["log", "--oneline", "--since=7 days ago"]
    );
    const commitsThisWeek = commitOutput
      ? commitOutput.split("\n").filter(Boolean).length
      : 0;
    totalCommitsThisWeek += commitsThisWeek;

    const branchOutput = gitCommand(project.path, ["branch", "--list"]);
    const branches = branchOutput
      ? branchOutput.split("\n").filter(Boolean).length
      : 0;

    const lastCommitDateStr = gitCommand(project.path, ["log", "-1", "--format=%ci"]);
    const lastCommitDate = lastCommitDateStr || null;

    const projectSessions = sessionsByProject.get(project.name) ?? [];

    const sessions7d = projectSessions.filter(
      (s) => new Date(s.startTime) >= sevenDaysAgo
    ).length;

    const sessions30d = projectSessions.filter(
      (s) => new Date(s.startTime) >= thirtyDaysAgo
    ).length;

    const cost30d = projectSessions
      .filter((s) => new Date(s.startTime) >= thirtyDaysAgo)
      .reduce((sum, s) => sum + s.estimatedCost, 0);

    // Sparkline: sessions per day for last 7 days
    const sparkline: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = projectSessions.filter((s) => {
        const t = new Date(s.startTime);
        return t >= dayStart && t < dayEnd;
      }).length;
      sparkline.push(count);
    }

    const sortedSessions = [...projectSessions].sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    const lastSessionDate =
      sortedSessions.length > 0 ? sortedSessions[0].startTime : null;

    let activityLevel: "hot" | "warm" | "cold";
    if (lastSessionDate && new Date(lastSessionDate) >= threeDaysAgo) {
      activityLevel = "hot";
    } else if (
      lastSessionDate &&
      new Date(lastSessionDate) >= fourteenDaysAgo
    ) {
      activityLevel = "warm";
    } else {
      activityLevel = "cold";
    }

    if (activityLevel === "cold" && commitsThisWeek === 0) {
      reposWithNoActivity++;
    }

    const activityScore = sessions7d * 2 + commitsThisWeek;
    if (activityScore > mostActiveScore) {
      mostActiveScore = activityScore;
      mostActiveRepo = project.name;
    }

    repos.push({
      name: project.name,
      path: project.path,
      activityLevel,
      commitsThisWeek,
      branches,
      lastCommitDate,
      sessions7d,
      sessions30d,
      cost30d,
      sparkline,
      lastSessionDate,
    });
  }

  const levelOrder = { hot: 0, warm: 1, cold: 2 };
  repos.sort((a, b) => {
    const levelDiff =
      levelOrder[a.activityLevel] - levelOrder[b.activityLevel];
    if (levelDiff !== 0) return levelDiff;
    const aTime = a.lastSessionDate
      ? new Date(a.lastSessionDate).getTime()
      : 0;
    const bTime = b.lastSessionDate
      ? new Date(b.lastSessionDate).getTime()
      : 0;
    return bTime - aTime;
  });

  return {
    totalCommitsThisWeek,
    mostActiveRepo,
    reposWithNoActivity,
    repos,
  };
}

// --- Sparkline component (inline SVG) ---

function Sparkline({ data }: { data: number[] }) {
  const width = 80;
  const height = 20;
  const barGap = 2;
  const barCount = data.length;
  const barWidth = (width - barGap * (barCount - 1)) / barCount;
  const maxVal = Math.max(...data, 1);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
    >
      {data.map((value, i) => {
        const barHeight = Math.max((value / maxVal) * (height - 2), value > 0 ? 2 : 0);
        const x = i * (barWidth + barGap);
        const y = height - barHeight;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={1}
            className={value > 0 ? "fill-zinc-400" : "fill-zinc-700"}
          />
        );
      })}
    </svg>
  );
}

// --- Activity badge ---

function ActivityBadge({ level }: { level: "hot" | "warm" | "cold" }) {
  const config = {
    hot: {
      dotClass: "bg-emerald-500",
      textClass: "text-emerald-400",
      bgClass: "bg-emerald-500/10",
      label: "Hot",
    },
    warm: {
      dotClass: "bg-amber-500",
      textClass: "text-amber-400",
      bgClass: "bg-amber-500/10",
      label: "Warm",
    },
    cold: {
      dotClass: "bg-zinc-500",
      textClass: "text-zinc-400",
      bgClass: "bg-zinc-500/10",
      label: "Cold",
    },
  };

  const c = config[level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${c.bgClass} ${c.textClass}`}
    >
      <span className={`size-1.5 rounded-full ${c.dotClass}`} />
      {c.label}
    </span>
  );
}

// --- Page ---

export default async function PulsePage() {
  const data = await getPulseData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Repo Pulse
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activity dashboard across all repositories.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Commits This Week"
          value={data.totalCommitsThisWeek}
          icon={GitCommitHorizontal}
        />
        <StatsCard
          title="Most Active Repo"
          value={data.mostActiveRepo ?? "None"}
          icon={Flame}
        />
        <StatsCard
          title="Inactive Repos"
          value={data.reposWithNoActivity}
          icon={SnowflakeIcon}
        />
      </div>

      {/* Repo Cards Grid */}
      {data.repos.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No repositories found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.repos.map((repo) => {
            const color = getProjectColor(repo.name);
            return (
              <Link
                key={repo.name}
                href={`/repos/${encodeURIComponent(repo.name)}`}
                className="block"
              >
                <Card
                  className={`border-zinc-800 bg-zinc-900 transition-colors hover:border-zinc-700 hover:bg-zinc-800/80 border-t-2 ${color.borderTop}`}
                >
                  <CardContent className="pt-0">
                    {/* Top row: name + activity badge */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-lg font-semibold truncate ${color.text}`}
                        >
                          {repo.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {repo.path}
                        </p>
                      </div>
                      <ActivityBadge level={repo.activityLevel} />
                    </div>

                    {/* Stats row */}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <GitCommitHorizontal className="size-3" />
                        <span className="font-medium text-zinc-300">
                          {repo.commitsThisWeek}
                        </span>
                        <span>commits</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <GitBranch className="size-3" />
                        <span className="font-medium text-zinc-300">
                          {repo.branches}
                        </span>
                        <span>branches</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        <span className="font-medium text-zinc-300">
                          {repo.sessions7d}
                        </span>
                        <span>/ 7d</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        <span className="font-medium text-zinc-300">
                          {repo.sessions30d}
                        </span>
                        <span>/ 30d</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="size-3" />
                        <span className="font-medium text-zinc-300">
                          {formatCost(repo.cost30d)}
                        </span>
                      </span>
                    </div>

                    {/* Bottom row: sparkline + last commit */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkline data={repo.sparkline} />
                        <span className="text-[10px] text-zinc-500">
                          7d sessions
                        </span>
                      </div>
                      {repo.lastCommitDate && (
                        <span className="text-xs text-zinc-500">
                          Last commit {relativeTime(repo.lastCommitDate)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
