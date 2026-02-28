import { NextResponse } from "next/server";

import { listSessions } from "@/lib/claude/sessions";
import type { SessionMeta } from "@/lib/claude/types";

// ---- ISO Week Helpers ----

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { year: d.getUTCFullYear(), week };
}

function weekKey(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Get the Monday of a given ISO week.
 */
function mondayOfISOWeek(year: number, week: number): Date {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1 ... Sun=7
  // Monday of week 1
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  // Monday of target week
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function weekLabel(year: number, week: number): string {
  const monday = mondayOfISOWeek(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const monMonth = MONTH_NAMES[monday.getUTCMonth()];
  const monDay = monday.getUTCDate();
  const sunMonth = MONTH_NAMES[sunday.getUTCMonth()];
  const sunDay = sunday.getUTCDate();

  if (monMonth === sunMonth) {
    return `${monMonth} ${monDay}-${sunDay}`;
  }
  return `${monMonth} ${monDay} - ${sunMonth} ${sunDay}`;
}

// ---- Analytics Types ----

interface WeeklyCost {
  week: string;
  weekLabel: string;
  cost: number;
  sessions: number;
}

interface ModelEfficiency {
  model: string;
  totalSessions: number;
  totalCost: number;
  avgCostPerSession: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgTokensPerSession: number;
}

interface ProjectRanking {
  projectName: string;
  totalCost: number;
  sessions: number;
}

interface DurationTrend {
  week: string;
  weekLabel: string;
  avgDuration: number;
}

interface HourlyHeatmap {
  hour: number;
  count: number;
}

interface AnalyticsResponse {
  weeklyCosts: WeeklyCost[];
  modelEfficiency: ModelEfficiency[];
  projectRanking: ProjectRanking[];
  durationTrend: DurationTrend[];
  hourlyHeatmap: HourlyHeatmap[];
}

// ---- Computation ----

function computeAnalytics(sessions: SessionMeta[]): AnalyticsResponse {
  const now = new Date();
  const currentWeek = getISOWeek(now);

  // Build ordered list of last 12 weeks
  const last12Weeks: { year: number; week: number; key: string }[] = [];
  {
    // Walk backwards from current week
    let y = currentWeek.year;
    let w = currentWeek.week;
    for (let i = 0; i < 12; i++) {
      last12Weeks.unshift({ year: y, week: w, key: weekKey(y, w) });
      w--;
      if (w < 1) {
        y--;
        // Get the last ISO week of the previous year
        const dec31 = new Date(Date.UTC(y, 11, 31));
        w = getISOWeek(dec31).week;
      }
    }
  }

  const weekKeySet = new Set(last12Weeks.map((w) => w.key));

  // Accumulators
  const weeklyCostMap = new Map<string, { cost: number; sessions: number }>();
  const weeklyDurationMap = new Map<
    string,
    { totalDuration: number; count: number }
  >();
  const modelMap = new Map<
    string,
    {
      sessions: number;
      cost: number;
      inputTokens: number;
      outputTokens: number;
    }
  >();
  const projectMap = new Map<string, { cost: number; sessions: number }>();
  const hourlyCounts = new Array<number>(24).fill(0);

  for (const s of sessions) {
    const startDate = new Date(s.startTime);
    const iw = getISOWeek(startDate);
    const wk = weekKey(iw.year, iw.week);

    // Weekly costs + duration (last 12 weeks only)
    if (weekKeySet.has(wk)) {
      const existing = weeklyCostMap.get(wk) ?? { cost: 0, sessions: 0 };
      existing.cost += s.estimatedCost;
      existing.sessions += 1;
      weeklyCostMap.set(wk, existing);

      const durExisting = weeklyDurationMap.get(wk) ?? {
        totalDuration: 0,
        count: 0,
      };
      durExisting.totalDuration += s.duration;
      durExisting.count += 1;
      weeklyDurationMap.set(wk, durExisting);
    }

    // Model efficiency (all time)
    const me = modelMap.get(s.model) ?? {
      sessions: 0,
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    me.sessions += 1;
    me.cost += s.estimatedCost;
    me.inputTokens += s.totalInputTokens;
    me.outputTokens += s.totalOutputTokens;
    modelMap.set(s.model, me);

    // Project ranking (all time)
    const pr = projectMap.get(s.projectName) ?? { cost: 0, sessions: 0 };
    pr.cost += s.estimatedCost;
    pr.sessions += 1;
    projectMap.set(s.projectName, pr);

    // Hourly heatmap (all time)
    const hour = startDate.getHours();
    hourlyCounts[hour]++;
  }

  // Build weeklyCosts with zero-fill
  const weeklyCosts: WeeklyCost[] = last12Weeks.map((w) => {
    const data = weeklyCostMap.get(w.key);
    return {
      week: w.key,
      weekLabel: weekLabel(w.year, w.week),
      cost: data?.cost ?? 0,
      sessions: data?.sessions ?? 0,
    };
  });

  // Build modelEfficiency
  const modelEfficiency: ModelEfficiency[] = Array.from(modelMap.entries())
    .map(([model, data]) => ({
      model,
      totalSessions: data.sessions,
      totalCost: data.cost,
      avgCostPerSession: data.sessions > 0 ? data.cost / data.sessions : 0,
      totalInputTokens: data.inputTokens,
      totalOutputTokens: data.outputTokens,
      avgTokensPerSession:
        data.sessions > 0
          ? Math.round(
              (data.inputTokens + data.outputTokens) / data.sessions
            )
          : 0,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  // Build projectRanking (top 10)
  const projectRanking: ProjectRanking[] = Array.from(projectMap.entries())
    .map(([projectName, data]) => ({
      projectName,
      totalCost: data.cost,
      sessions: data.sessions,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);

  // Build durationTrend with zero-fill
  const durationTrend: DurationTrend[] = last12Weeks.map((w) => {
    const data = weeklyDurationMap.get(w.key);
    return {
      week: w.key,
      weekLabel: weekLabel(w.year, w.week),
      avgDuration: data && data.count > 0 ? data.totalDuration / data.count : 0,
    };
  });

  // Build hourlyHeatmap
  const hourlyHeatmap: HourlyHeatmap[] = hourlyCounts.map((count, hour) => ({
    hour,
    count,
  }));

  return {
    weeklyCosts,
    modelEfficiency,
    projectRanking,
    durationTrend,
    hourlyHeatmap,
  };
}

export async function GET() {
  try {
    const sessions = await listSessions();
    const analytics = computeAnalytics(sessions);
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Failed to compute analytics:", error);
    return NextResponse.json(
      { error: "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
