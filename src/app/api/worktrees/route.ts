import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface WorktreeEntry {
  projectName: string;
  worktreePath: string;
  branch: string;
  isMain: boolean;
  commitHash: string;
  fileCount: number | null;
  isDirty: boolean;
}

/**
 * Convert an escaped directory name back to the original filesystem path.
 * e.g. "-Users-divyekant-Projects-kai" -> "/Users/divyekant/Projects/kai"
 */
function dirNameToPath(dirName: string): string {
  if (dirName.startsWith("-")) {
    return "/" + dirName.slice(1).replace(/-/g, "/");
  }
  return dirName.replace(/-/g, "/");
}

/**
 * Extract readable project name from the encoded dir name.
 */
function readableProjectName(dirName: string): string {
  const segments = dirName.split("-").filter(Boolean);
  return segments[segments.length - 1] || dirName;
}

/**
 * Parse `git worktree list --porcelain` output into structured entries.
 */
function parseWorktreeList(
  output: string,
  projectName: string
): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  const blocks = output.trim().split("\n\n");

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.trim().split("\n");
    let worktreePath = "";
    let commitHash = "";
    let branch = "";
    let isMain = false;
    let isBare = false;

    for (const line of lines) {
      if (line.startsWith("worktree ")) {
        worktreePath = line.slice("worktree ".length);
      } else if (line.startsWith("HEAD ")) {
        commitHash = line.slice("HEAD ".length);
      } else if (line.startsWith("branch ")) {
        // branch refs/heads/main -> main
        branch = line.slice("branch ".length).replace("refs/heads/", "");
      } else if (line === "detached") {
        branch = "(detached)";
      } else if (line === "bare") {
        isBare = true;
      }
    }

    if (isBare || !worktreePath) continue;

    // The first worktree in the list is always the main one
    isMain = entries.length === 0;

    // Try to get file count
    let fileCount: number | null = null;
    try {
      const count = execSync("git ls-files | wc -l", {
        cwd: worktreePath,
        timeout: 3000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      fileCount = parseInt(count.trim(), 10) || null;
    } catch {
      // Not accessible or not a git dir
    }

    // Check for uncommitted changes
    let isDirty = false;
    try {
      const status = execSync("git status --porcelain", {
        cwd: worktreePath,
        timeout: 3000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      isDirty = status.trim().length > 0;
    } catch {
      // Can't determine dirty status
    }

    entries.push({
      projectName,
      worktreePath,
      branch,
      isMain,
      commitHash,
      fileCount,
      isDirty,
    });
  }

  return entries;
}

export async function GET() {
  try {
    const allWorktrees: WorktreeEntry[] = [];
    let projectDirs: string[] = [];

    try {
      const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
      projectDirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      // projects dir doesn't exist
    }

    for (const dirName of projectDirs) {
      const projectName = readableProjectName(dirName);
      const actualPath = dirNameToPath(dirName);

      // Check if the project directory exists and is a git repo
      try {
        await fs.access(actualPath);
      } catch {
        continue;
      }

      // Run git worktree list --porcelain in the actual project directory
      try {
        const output = execSync("git worktree list --porcelain", {
          cwd: actualPath,
          timeout: 5000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
        const entries = parseWorktreeList(output, projectName);
        allWorktrees.push(...entries);
      } catch {
        // Not a git repo or git not available
      }

      // Also check for worktrees inside ~/.claude/projects/<dir>/.claude/worktrees/
      const claudeWorktreesDir = path.join(
        PROJECTS_DIR,
        dirName,
        ".claude",
        "worktrees"
      );
      try {
        const wtEntries = await fs.readdir(claudeWorktreesDir, {
          withFileTypes: true,
        });
        for (const wt of wtEntries) {
          if (!wt.isDirectory()) continue;

          const wtPath = path.join(claudeWorktreesDir, wt.name);

          // Skip if we already found this worktree via git worktree list
          if (allWorktrees.some((w) => w.worktreePath === wtPath)) continue;

          let branch = wt.name;
          let commitHash = "";
          let isDirty = false;
          let fileCount: number | null = null;

          try {
            branch = execSync("git rev-parse --abbrev-ref HEAD", {
              cwd: wtPath,
              timeout: 3000,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            }).trim();
          } catch {
            // Use directory name as branch
          }

          try {
            commitHash = execSync("git rev-parse HEAD", {
              cwd: wtPath,
              timeout: 3000,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            }).trim();
          } catch {
            // Can't get commit hash
          }

          try {
            const status = execSync("git status --porcelain", {
              cwd: wtPath,
              timeout: 3000,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            });
            isDirty = status.trim().length > 0;
          } catch {
            // Can't determine dirty status
          }

          try {
            const count = execSync("git ls-files | wc -l", {
              cwd: wtPath,
              timeout: 3000,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            });
            fileCount = parseInt(count.trim(), 10) || null;
          } catch {
            // Can't count files
          }

          allWorktrees.push({
            projectName,
            worktreePath: wtPath,
            branch,
            isMain: false,
            commitHash,
            fileCount,
            isDirty,
          });
        }
      } catch {
        // No .claude/worktrees/ directory for this project
      }
    }

    return NextResponse.json({ worktrees: allWorktrees });
  } catch (error) {
    console.error("Failed to scan worktrees:", error);
    return NextResponse.json(
      { error: "Failed to scan worktrees" },
      { status: 500 }
    );
  }
}
