import { execSync } from "child_process";
import { NextResponse } from "next/server";

import { getProjectDirs } from "@/lib/claude/sessions";

export interface GitCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface GitProject {
  name: string;
  path: string;
  recentCommits: GitCommit[];
  branches: string[];
  commitDates: string[];
}

export interface GitData {
  projects: GitProject[];
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
    const projectDirs = await getProjectDirs();

    const projects: GitProject[] = [];

    for (const project of projectDirs) {
      // Check if this is a valid git repo
      const gitCheck = gitCommand(project.path, "rev-parse --git-dir");
      if (!gitCheck) continue;

      // Recent commits (last 20)
      const commitLog = gitCommand(
        project.path,
        'log --oneline -20 --format="%H|%s|%ai|%an"'
      );
      const recentCommits: GitCommit[] = commitLog
        ? commitLog
            .split("\n")
            .filter(Boolean)
            .map((line) => {
              const [hash, message, date, author] = line.split("|");
              return { hash, message, date, author };
            })
        : [];

      // Branches
      const branchOutput = gitCommand(project.path, "branch --list");
      const branches = branchOutput
        ? branchOutput
            .split("\n")
            .map((b) => b.replace(/^\*?\s*/, "").trim())
            .filter(Boolean)
        : [];

      // Commit dates for last 30 days (for frequency chart)
      const commitDatesOutput = gitCommand(
        project.path,
        'log --since="30 days ago" --format="%ai"'
      );
      const commitDates = commitDatesOutput
        ? commitDatesOutput.split("\n").filter(Boolean)
        : [];

      projects.push({
        name: project.name,
        path: project.path,
        recentCommits,
        branches,
        commitDates,
      });
    }

    return NextResponse.json({ projects } satisfies GitData);
  } catch (error) {
    console.error("Failed to get git data:", error);
    return NextResponse.json(
      { error: "Failed to get git data" },
      { status: 500 }
    );
  }
}
