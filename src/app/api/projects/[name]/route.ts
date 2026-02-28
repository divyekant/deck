import { NextRequest, NextResponse } from "next/server";

import { listSessions } from "@/lib/claude/sessions";
import type { SessionMeta } from "@/lib/claude/types";

interface ModelSummary {
  model: string;
  cost: number;
  sessions: number;
}

interface ProjectDetailResponse {
  projectName: string;
  projectPath: string;
  totalSessions: number;
  totalCost: number;
  models: ModelSummary[];
  activeDays: number;
  costTrend: { date: string; cost: number }[];
  topSessionsByCost: SessionMeta[];
  sessions: SessionMeta[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const projectName = decodeURIComponent(name);

    const allSessions = await listSessions();
    const projectSessions = allSessions.filter(
      (s) => s.projectName === projectName
    );

    if (projectSessions.length === 0) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Project path from first session
    const projectPath = projectSessions[0].projectPath;

    // Total cost
    let totalCost = 0;
    for (const s of projectSessions) {
      totalCost += s.estimatedCost;
    }

    // Model breakdown
    const modelMap = new Map<string, { cost: number; sessions: number }>();
    for (const s of projectSessions) {
      const existing = modelMap.get(s.model) ?? { cost: 0, sessions: 0 };
      existing.cost += s.estimatedCost;
      existing.sessions += 1;
      modelMap.set(s.model, existing);
    }
    const models: ModelSummary[] = Array.from(modelMap.entries())
      .map(([model, data]) => ({ model, cost: data.cost, sessions: data.sessions }))
      .sort((a, b) => b.cost - a.cost);

    // Active days: count unique dates
    const uniqueDates = new Set<string>();
    for (const s of projectSessions) {
      uniqueDates.add(new Date(s.startTime).toISOString().slice(0, 10));
    }
    const activeDays = uniqueDates.size;

    // Cost trend: last 90 days, fill zeros
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 89);
    startDate.setHours(0, 0, 0, 0);

    const costMap = new Map<string, number>();
    for (const s of projectSessions) {
      const sessionDate = new Date(s.startTime);
      if (sessionDate >= startDate) {
        const dateKey = sessionDate.toISOString().slice(0, 10);
        costMap.set(dateKey, (costMap.get(dateKey) ?? 0) + s.estimatedCost);
      }
    }

    const costTrend: { date: string; cost: number }[] = [];
    const cursor = new Date(startDate);
    for (let i = 0; i < 90; i++) {
      const dateKey = cursor.toISOString().slice(0, 10);
      costTrend.push({ date: dateKey, cost: costMap.get(dateKey) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Top 5 most expensive sessions
    const topSessionsByCost = [...projectSessions]
      .sort((a, b) => b.estimatedCost - a.estimatedCost)
      .slice(0, 5);

    // All sessions sorted by startTime desc (already sorted from listSessions)
    const sessions = projectSessions;

    const response: ProjectDetailResponse = {
      projectName,
      projectPath,
      totalSessions: projectSessions.length,
      totalCost,
      models,
      activeDays,
      costTrend,
      topSessionsByCost,
      sessions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get project details:", error);
    return NextResponse.json(
      { error: "Failed to get project details" },
      { status: 500 }
    );
  }
}
