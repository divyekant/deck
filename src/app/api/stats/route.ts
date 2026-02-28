import { execFileSync } from "child_process";
import { NextResponse } from "next/server";

import { getOverviewStats, getProjectDirs, listSessions } from "@/lib/claude/sessions";

export async function GET() {
  try {
    const stats = await getOverviewStats();

    // Count today's commits across all projects
    let commitsToday = 0;
    try {
      const projects = await getProjectDirs();
      for (const project of projects) {
        try {
          const output = execFileSync(
            "git",
            ["-C", project.path, "log", "--oneline", "--since=midnight"],
            { encoding: "utf-8", timeout: 5000, stdio: ["pipe", "pipe", "pipe"] }
          ).trim();
          commitsToday += output ? output.split("\n").filter(Boolean).length : 0;
        } catch {
          // Not a git repo or git failed — skip
        }
      }
    } catch {
      // Failed to get project dirs — commitsToday stays 0
    }

    // Find the project with the most sessions
    let topProject: { name: string; sessions: number } | null = null;
    try {
      const sessions = await listSessions();
      const projectCounts = new Map<string, number>();
      for (const session of sessions) {
        const count = projectCounts.get(session.projectName) ?? 0;
        projectCounts.set(session.projectName, count + 1);
      }
      let maxCount = 0;
      for (const [name, count] of projectCounts) {
        if (count > maxCount) {
          maxCount = count;
          topProject = { name, sessions: count };
        }
      }
    } catch {
      // Failed to compute top project — leave null
    }

    return NextResponse.json({ ...stats, commitsToday, topProject });
  } catch (error) {
    console.error("Failed to get overview stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
