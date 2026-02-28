import { execSync } from "child_process";
import { NextResponse } from "next/server";

import { getProjectDirs, listSessions } from "@/lib/claude/sessions";
import type { SessionMeta } from "@/lib/claude/types";

export interface RepoPulse {
  name: string;
  path: string;
  activityLevel: "hot" | "warm" | "cold";
  commitsThisWeek: number;
  branches: number;
  lastCommitDate: string | null;
  sessions7d: number;
  sessions30d: number;
  cost30d: number;
  sparkline: number[]; // 7 entries, sessions per day for last 7 days
  lastSessionDate: string | null;
}

export interface PulseSummary {
  totalCommitsThisWeek: number;
  mostActiveRepo: string | null;
  reposWithNoActivity: number;
  repos: RepoPulse[];
}

function gitCommand(projectPath: string, cmd: string): string {
  try {
    return execSync(`git -C "${projectPath}" ${cmd} 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {
    return "";
  }
}

export async function GET() {
  try {
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
      // Git stats
      const commitCountStr = gitCommand(
        project.path,
        'log --oneline --since="7 days ago" | wc -l'
      );
      const commitsThisWeek = parseInt(commitCountStr.trim(), 10) || 0;
      totalCommitsThisWeek += commitsThisWeek;

      const branchCountStr = gitCommand(project.path, "branch --list | wc -l");
      const branches = parseInt(branchCountStr.trim(), 10) || 0;

      const lastCommitDateStr = gitCommand(
        project.path,
        "log -1 --format=%ci"
      );
      const lastCommitDate = lastCommitDateStr || null;

      // Session stats
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

      // Most recent session date
      const sortedSessions = [...projectSessions].sort(
        (a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      const lastSessionDate =
        sortedSessions.length > 0 ? sortedSessions[0].startTime : null;

      // Activity level
      let activityLevel: "hot" | "warm" | "cold";
      if (
        lastSessionDate &&
        new Date(lastSessionDate) >= threeDaysAgo
      ) {
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

      // Track most active by combined score
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

    // Sort: hot first, then warm, then cold; within same level sort by last session date
    const levelOrder = { hot: 0, warm: 1, cold: 2 };
    repos.sort((a, b) => {
      const levelDiff = levelOrder[a.activityLevel] - levelOrder[b.activityLevel];
      if (levelDiff !== 0) return levelDiff;
      const aTime = a.lastSessionDate
        ? new Date(a.lastSessionDate).getTime()
        : 0;
      const bTime = b.lastSessionDate
        ? new Date(b.lastSessionDate).getTime()
        : 0;
      return bTime - aTime;
    });

    const summary: PulseSummary = {
      totalCommitsThisWeek,
      mostActiveRepo,
      reposWithNoActivity,
      repos,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to get pulse data:", error);
    return NextResponse.json(
      { error: "Failed to get pulse data" },
      { status: 500 }
    );
  }
}
