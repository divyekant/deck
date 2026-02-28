import { NextRequest, NextResponse } from "next/server";

import { listSessions } from "@/lib/claude/sessions";
import type { SessionMeta } from "@/lib/claude/types";

// ---- Health Score Dimensions ----

function frequencyScore(sessionsLast7Days: number): number {
  if (sessionsLast7Days >= 3) return 25;
  if (sessionsLast7Days >= 2) return 15;
  if (sessionsLast7Days >= 1) return 8;
  return 0;
}

function costEfficiencyScore(avgCostPerMessage: number): number {
  if (avgCostPerMessage < 0.05) return 25;
  if (avgCostPerMessage < 0.10) return 20;
  if (avgCostPerMessage < 0.20) return 15;
  if (avgCostPerMessage < 0.50) return 10;
  return 5;
}

function cacheEfficiencyScore(cacheHitRate: number): number {
  if (cacheHitRate > 0.60) return 25;
  if (cacheHitRate > 0.40) return 20;
  if (cacheHitRate > 0.20) return 15;
  if (cacheHitRate > 0.10) return 10;
  return 5;
}

function sessionDepthScore(avgMessageCount: number): number {
  if (avgMessageCount > 20) return 25;
  if (avgMessageCount > 10) return 20;
  if (avgMessageCount > 5) return 15;
  if (avgMessageCount > 2) return 10;
  return 5;
}

// ---- Types ----

interface ProjectHealth {
  name: string;
  healthScore: number;
  trend: "improving" | "declining" | "stable";
  dimensions: {
    frequency: number;
    costEfficiency: number;
    cacheEfficiency: number;
    sessionDepth: number;
  };
  sessionCount: number;
  totalCost: number;
  recentSessions: number;
}

// ---- Route Handler ----

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sort = searchParams.get("sort") || "health";

    const allSessions = await listSessions();
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    // Group sessions by project
    const projectMap = new Map<string, SessionMeta[]>();
    for (const session of allSessions) {
      const existing = projectMap.get(session.projectName) ?? [];
      existing.push(session);
      projectMap.set(session.projectName, existing);
    }

    const projects: ProjectHealth[] = [];

    for (const [name, sessions] of projectMap) {
      const totalCost = sessions.reduce((sum, s) => sum + s.estimatedCost, 0);
      const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
      const totalCacheCreation = sessions.reduce((sum, s) => sum + s.cacheCreationTokens, 0);
      const totalCacheRead = sessions.reduce((sum, s) => sum + s.cacheReadTokens, 0);

      // Sessions in time windows
      const last7 = sessions.filter(
        (s) => new Date(s.startTime).getTime() >= sevenDaysAgo
      );
      const prev7 = sessions.filter((s) => {
        const t = new Date(s.startTime).getTime();
        return t >= fourteenDaysAgo && t < sevenDaysAgo;
      });

      // Dimension calculations
      const freq = frequencyScore(last7.length);

      const avgCostPerMsg =
        totalMessages > 0 ? totalCost / totalMessages : Infinity;
      const costEff = costEfficiencyScore(avgCostPerMsg);

      const totalCacheTokens = totalCacheCreation + totalCacheRead;
      const cacheHitRate =
        totalCacheTokens > 0 ? totalCacheRead / totalCacheTokens : 0;
      const cacheEff = cacheEfficiencyScore(cacheHitRate);

      const avgMsgCount =
        sessions.length > 0 ? totalMessages / sessions.length : 0;
      const depth = sessionDepthScore(avgMsgCount);

      const healthScore = freq + costEff + cacheEff + depth;

      // Trend: compare current 7 days vs previous 7 days
      const computeWindowHealth = (windowSessions: SessionMeta[], windowCount: number) => {
        const wFreq = frequencyScore(windowCount);
        const wMessages = windowSessions.reduce((s, x) => s + x.messageCount, 0);
        const wCost = windowSessions.reduce((s, x) => s + x.estimatedCost, 0);
        const wAvgCost = wMessages > 0 ? wCost / wMessages : Infinity;
        const wCostEff = costEfficiencyScore(wAvgCost);
        const wCacheCreate = windowSessions.reduce((s, x) => s + x.cacheCreationTokens, 0);
        const wCacheRead = windowSessions.reduce((s, x) => s + x.cacheReadTokens, 0);
        const wCacheTotal = wCacheCreate + wCacheRead;
        const wCacheRate = wCacheTotal > 0 ? wCacheRead / wCacheTotal : 0;
        const wCacheEff = cacheEfficiencyScore(wCacheRate);
        const wAvgMsg = windowSessions.length > 0 ? wMessages / windowSessions.length : 0;
        const wDepth = sessionDepthScore(wAvgMsg);
        return wFreq + wCostEff + wCacheEff + wDepth;
      };

      const currentHealth = computeWindowHealth(last7, last7.length);
      const previousHealth = computeWindowHealth(prev7, prev7.length);
      const diff = currentHealth - previousHealth;

      let trend: "improving" | "declining" | "stable" = "stable";
      if (diff > 5) trend = "improving";
      else if (diff < -5) trend = "declining";

      projects.push({
        name,
        healthScore,
        trend,
        dimensions: {
          frequency: freq,
          costEfficiency: costEff,
          cacheEfficiency: cacheEff,
          sessionDepth: depth,
        },
        sessionCount: sessions.length,
        totalCost,
        recentSessions: last7.length,
      });
    }

    // Sort
    switch (sort) {
      case "active":
        projects.sort((a, b) => b.recentSessions - a.recentSessions);
        break;
      case "cost":
        projects.sort((a, b) => b.totalCost - a.totalCost);
        break;
      case "health":
      default:
        projects.sort((a, b) => b.healthScore - a.healthScore);
        break;
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to compute project health:", error);
    return NextResponse.json(
      { error: "Failed to compute project health" },
      { status: 500 }
    );
  }
}
