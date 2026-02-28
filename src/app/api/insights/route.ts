import { NextResponse } from "next/server";

import { listSessions } from "@/lib/claude/sessions";
import type { SessionMeta } from "@/lib/claude/types";

// ---- Types ----

interface Insight {
  id: string;
  title: string;
  description: string;
  value: string;
  icon: string;
  category: "productivity" | "usage" | "efficiency" | "cost";
}

// ---- Helpers ----

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getMostProductiveDay(sessions: SessionMeta[]): Insight {
  const dayCounts = new Array(7).fill(0);
  for (const s of sessions) {
    const day = new Date(s.startTime).getDay();
    dayCounts[day]++;
  }
  const maxIdx = dayCounts.indexOf(Math.max(...dayCounts));
  const count = dayCounts[maxIdx];

  return {
    id: "most-productive-day",
    title: "Most Productive Day",
    description: `You start the most sessions on ${DAY_NAMES[maxIdx]}s — ${count} total across all time.`,
    value: DAY_NAMES[maxIdx],
    icon: "Calendar",
    category: "productivity",
  };
}

function getPeakCodingHours(sessions: SessionMeta[]): Insight {
  const buckets: Record<string, number> = {
    morning: 0,   // 6-12
    afternoon: 0,  // 12-18
    evening: 0,    // 18-24
    night: 0,      // 0-6
  };

  for (const s of sessions) {
    const hour = new Date(s.startTime).getHours();
    if (hour >= 6 && hour < 12) buckets.morning++;
    else if (hour >= 12 && hour < 18) buckets.afternoon++;
    else if (hour >= 18) buckets.evening++;
    else buckets.night++;
  }

  const peak = Object.entries(buckets).reduce((a, b) =>
    b[1] > a[1] ? b : a
  );

  const labels: Record<string, string> = {
    morning: "Morning (6am-12pm)",
    afternoon: "Afternoon (12pm-6pm)",
    evening: "Evening (6pm-12am)",
    night: "Night (12am-6am)",
  };

  const shortLabels: Record<string, string> = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
  };

  return {
    id: "peak-coding-hours",
    title: "Peak Coding Hours",
    description: `${labels[peak[0]]} is your most active window with ${peak[1]} sessions.`,
    value: shortLabels[peak[0]],
    icon: "Clock",
    category: "productivity",
  };
}

function getFavoriteModel(sessions: SessionMeta[]): Insight {
  const modelCounts = new Map<string, number>();
  for (const s of sessions) {
    modelCounts.set(s.model, (modelCounts.get(s.model) ?? 0) + 1);
  }

  let topModel = "unknown";
  let topCount = 0;
  for (const [model, count] of modelCounts) {
    if (count > topCount) {
      topModel = model;
      topCount = count;
    }
  }

  const pct =
    sessions.length > 0 ? Math.round((topCount / sessions.length) * 100) : 0;

  return {
    id: "favorite-model",
    title: "Favorite Model",
    description: `Used in ${topCount} sessions (${pct}% of all sessions).`,
    value: topModel,
    icon: "Cpu",
    category: "usage",
  };
}

function getLongestStreak(sessions: SessionMeta[]): Insight {
  if (sessions.length === 0) {
    return {
      id: "longest-streak",
      title: "Longest Streak",
      description: "No sessions yet. Start coding to build a streak!",
      value: "0 days",
      icon: "Flame",
      category: "productivity",
    };
  }

  // Get unique dates (YYYY-MM-DD) sorted ascending
  const dateSet = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.startTime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dateSet.add(key);
  }
  const dates = Array.from(dateSet).sort();

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00");
    const curr = new Date(dates[i] + "T00:00:00");
    const diffDays = Math.round(
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 1;
    }
  }

  return {
    id: "longest-streak",
    title: "Longest Streak",
    description: `${maxStreak} consecutive day${maxStreak !== 1 ? "s" : ""} with at least one coding session.`,
    value: `${maxStreak} day${maxStreak !== 1 ? "s" : ""}`,
    icon: "Flame",
    category: "productivity",
  };
}

function getMostExpensiveProject(sessions: SessionMeta[]): Insight {
  const projectCosts = new Map<string, number>();
  for (const s of sessions) {
    projectCosts.set(
      s.projectName,
      (projectCosts.get(s.projectName) ?? 0) + s.estimatedCost
    );
  }

  let topProject = "N/A";
  let topCost = 0;
  for (const [project, cost] of projectCosts) {
    if (cost > topCost) {
      topProject = project;
      topCost = cost;
    }
  }

  return {
    id: "most-expensive-project",
    title: "Most Expensive Project",
    description: `$${topCost.toFixed(2)} total spend across all sessions.`,
    value: topProject,
    icon: "DollarSign",
    category: "cost",
  };
}

function getMostEfficientProject(sessions: SessionMeta[]): Insight {
  // Group by project, compute average cache read ratio
  const projectStats = new Map<
    string,
    { totalCacheRead: number; totalInput: number; count: number }
  >();

  for (const s of sessions) {
    const existing = projectStats.get(s.projectName) ?? {
      totalCacheRead: 0,
      totalInput: 0,
      count: 0,
    };
    existing.totalCacheRead += s.cacheReadTokens;
    existing.totalInput += s.totalInputTokens + s.cacheCreationTokens + s.cacheReadTokens;
    existing.count++;
    projectStats.set(s.projectName, existing);
  }

  let bestProject = "N/A";
  let bestRatio = 0;
  let bestCount = 0;

  for (const [project, stats] of projectStats) {
    // Require at least 3 sessions for meaningful data
    if (stats.count < 3) continue;
    const ratio = stats.totalInput > 0 ? stats.totalCacheRead / stats.totalInput : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestProject = project;
      bestCount = stats.count;
    }
  }

  const pct = Math.round(bestRatio * 100);

  return {
    id: "most-efficient-sessions",
    title: "Most Efficient Project",
    description:
      bestProject === "N/A"
        ? "Not enough data yet. Need projects with 3+ sessions."
        : `${pct}% cache read ratio across ${bestCount} sessions — great context reuse.`,
    value: bestProject === "N/A" ? "N/A" : `${pct}% cached`,
    icon: "Zap",
    category: "efficiency",
  };
}

function getBusiestProjectThisWeek(sessions: SessionMeta[]): Insight {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const projectCounts = new Map<string, number>();
  for (const s of sessions) {
    if (new Date(s.startTime) >= sevenDaysAgo) {
      projectCounts.set(
        s.projectName,
        (projectCounts.get(s.projectName) ?? 0) + 1
      );
    }
  }

  let topProject = "None";
  let topCount = 0;
  for (const [project, count] of projectCounts) {
    if (count > topCount) {
      topProject = project;
      topCount = count;
    }
  }

  return {
    id: "busiest-project-this-week",
    title: "Busiest Project This Week",
    description:
      topCount === 0
        ? "No sessions in the last 7 days."
        : `${topCount} session${topCount !== 1 ? "s" : ""} in the last 7 days.`,
    value: topProject,
    icon: "TrendingUp",
    category: "usage",
  };
}

// ---- Route Handler ----

export async function GET() {
  try {
    const sessions = await listSessions();

    if (sessions.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    const insights: Insight[] = [
      getMostProductiveDay(sessions),
      getPeakCodingHours(sessions),
      getFavoriteModel(sessions),
      getLongestStreak(sessions),
      getMostExpensiveProject(sessions),
      getMostEfficientProject(sessions),
      getBusiestProjectThisWeek(sessions),
    ];

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Failed to compute insights:", error);
    return NextResponse.json(
      { error: "Failed to compute insights" },
      { status: 500 }
    );
  }
}
