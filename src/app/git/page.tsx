"use client";

import { useEffect, useState, useCallback } from "react";
import { GitBranch, GitCommitHorizontal, FolderGit2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCard } from "@/components/stats-card";

interface GitCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

interface GitProject {
  name: string;
  path: string;
  recentCommits: GitCommit[];
  branches: string[];
  commitDates: string[];
}

interface GitData {
  projects: GitProject[];
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

/** Build daily commit counts for last 30 days across all projects */
function buildDailyCommits(
  projects: GitProject[]
): { date: string; count: number }[] {
  const now = new Date();
  const dailyMap = new Map<string, number>();

  // Initialize all 30 days with 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }

  // Count commits per day from all projects
  for (const project of projects) {
    for (const dateStr of project.commitDates) {
      const key = new Date(dateStr).toISOString().slice(0, 10);
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1);
      }
    }
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/** Inline SVG bar chart for commit frequency */
function CommitFrequencyChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const width = 720;
  const height = 120;
  const padding = { top: 8, right: 4, bottom: 20, left: 4 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barGap = 2;
  const barCount = data.length;
  const barWidth = (chartWidth - barGap * (barCount - 1)) / barCount;
  const maxVal = Math.max(...data.map((d) => d.count), 1);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
    >
      {data.map((d, i) => {
        const barHeight = Math.max(
          (d.count / maxVal) * chartHeight,
          d.count > 0 ? 2 : 0
        );
        const x = padding.left + i * (barWidth + barGap);
        const y = padding.top + chartHeight - barHeight;
        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={1.5}
            className={d.count > 0 ? "fill-zinc-400" : "fill-zinc-800"}
          >
            <title>
              {d.date}: {d.count} commit{d.count !== 1 ? "s" : ""}
            </title>
          </rect>
        );
      })}
      {/* X-axis labels — show every 5th day */}
      {data.map((d, i) => {
        if (i % 5 !== 0 && i !== data.length - 1) return null;
        const x = padding.left + i * (barWidth + barGap) + barWidth / 2;
        const label = new Date(d.date + "T00:00:00").toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" }
        );
        return (
          <text
            key={`label-${d.date}`}
            x={x}
            y={height - 4}
            textAnchor="middle"
            className="fill-zinc-600 text-[9px]"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function GitPage() {
  const [data, setData] = useState<GitData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/git");
      if (!res.ok) throw new Error("Failed to fetch git data");
      const json: GitData = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load git data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute summary stats
  const totalCommits30d = data
    ? data.projects.reduce((sum, p) => sum + p.commitDates.length, 0)
    : 0;
  const totalBranches = data
    ? data.projects.reduce((sum, p) => sum + p.branches.length, 0)
    : 0;
  const activeProjects = data ? data.projects.length : 0;
  const dailyCommits = data ? buildDailyCommits(data.projects) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GitBranch className="size-5 text-zinc-400" />
        <h1 className="text-xl font-semibold text-zinc-100">Git Activity</h1>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full bg-zinc-800" />
            ))}
          </div>
          <Skeleton className="h-32 w-full bg-zinc-800" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full bg-zinc-800" />
            ))}
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatsCard
              title="Commits (30d)"
              value={totalCommits30d}
              icon={GitCommitHorizontal}
            />
            <StatsCard
              title="Active Branches"
              value={totalBranches}
              icon={GitBranch}
            />
            <StatsCard
              title="Active Projects"
              value={activeProjects}
              icon={FolderGit2}
            />
          </div>

          {/* Commit Frequency Chart */}
          {dailyCommits.length > 0 && (
            <Card className="border-zinc-800 bg-zinc-900">
              <CardContent className="pt-0">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Daily Commits — Last 30 Days
                </p>
                <CommitFrequencyChart data={dailyCommits} />
              </CardContent>
            </Card>
          )}

          {/* Per-project sections */}
          {data.projects.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No git repositories found.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.projects.map((project) => (
                <Card
                  key={project.name}
                  className="border-zinc-800 bg-zinc-900"
                >
                  <CardContent className="pt-0">
                    {/* Project header */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-zinc-100 truncate">
                          {project.name}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {project.path}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="secondary"
                          className="bg-zinc-800 text-zinc-400"
                        >
                          <GitBranch className="size-3" />
                          {project.branches.length} branch
                          {project.branches.length !== 1 ? "es" : ""}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="bg-zinc-800 text-zinc-400"
                        >
                          {project.commitDates.length} commit
                          {project.commitDates.length !== 1 ? "s" : ""} / 30d
                        </Badge>
                      </div>
                    </div>

                    {/* Recent commits */}
                    {project.recentCommits.length > 0 && (
                      <div className="mt-4 space-y-0 rounded-md border border-zinc-800">
                        {project.recentCommits.slice(0, 8).map((commit) => (
                          <div
                            key={commit.hash}
                            className="flex items-center gap-3 border-b border-zinc-800/50 px-3 py-1.5 text-sm last:border-0"
                          >
                            <span className="shrink-0 font-mono text-xs text-zinc-500">
                              {commit.hash.slice(0, 7)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                              {commit.message}
                            </span>
                            <span className="shrink-0 text-xs text-zinc-600">
                              {relativeTime(commit.date)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {project.recentCommits.length === 0 && (
                      <p className="mt-3 text-xs text-zinc-600">
                        No recent commits.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
