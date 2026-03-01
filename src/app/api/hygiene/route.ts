import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface HygieneCheck {
  claudeMd: boolean;
  settings: boolean;
  memory: boolean;
  agents: boolean;
  recentSessions: boolean;
}

interface ProjectHygiene {
  projectName: string;
  projectDir: string;
  score: number;
  checks: HygieneCheck;
}

/**
 * Convert an escaped directory name back to a readable project name.
 * e.g. "-Users-divyekant-Projects-kai" -> "kai"
 */
function readableProjectName(dirName: string): string {
  const segments = dirName.split("-").filter(Boolean);
  return segments[segments.length - 1] || dirName;
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
 * Check if a file or directory exists.
 */
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory has any files matching a pattern.
 */
async function hasFilesWithExtension(
  dir: string,
  ext: string
): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.some((e) => e.isFile() && e.name.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * Compute hygiene score from checks. Each check is worth 20 points.
 */
function computeScore(checks: HygieneCheck): number {
  let score = 0;
  if (checks.claudeMd) score += 20;
  if (checks.settings) score += 20;
  if (checks.memory) score += 20;
  if (checks.agents) score += 20;
  if (checks.recentSessions) score += 20;
  return score;
}

export async function GET() {
  try {
    const results: ProjectHygiene[] = [];

    let entries;
    try {
      entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    } catch {
      return NextResponse.json([]);
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      try {
        const dirName = entry.name as string;
        const projectClaudeDir = path.join(PROJECTS_DIR, dirName);
        const actualProjectPath = dirNameToPath(dirName);

        // 1. CLAUDE.md in the ~/.claude/projects/<dir>/ folder
        const hasClaudeMd = await exists(
          path.join(projectClaudeDir, "CLAUDE.md")
        );

        // 2. settings.json in the ~/.claude/projects/<dir>/ folder
        const hasSettings = await exists(
          path.join(projectClaudeDir, "settings.json")
        );

        // 3. memory/MEMORY.md in the ~/.claude/projects/<dir>/ folder
        const hasMemory = await exists(
          path.join(projectClaudeDir, "memory", "MEMORY.md")
        );

        // 4. .claude/agents/*.md in the ACTUAL project directory on disk
        const agentsDir = path.join(actualProjectPath, ".claude", "agents");
        const hasAgents = await hasFilesWithExtension(agentsDir, ".md");

        // 5. Recent sessions: any .jsonl files in the project's claude dir
        const hasRecentSessions = await hasFilesWithExtension(
          projectClaudeDir,
          ".jsonl"
        );

        const checks: HygieneCheck = {
          claudeMd: hasClaudeMd,
          settings: hasSettings,
          memory: hasMemory,
          agents: hasAgents,
          recentSessions: hasRecentSessions,
        };

        results.push({
          projectName: readableProjectName(dirName),
          projectDir: dirName,
          score: computeScore(checks),
          checks,
        });
      } catch {
        // Skip projects that error during scanning
        continue;
      }
    }

    // Sort by score ascending (worst projects first)
    results.sort((a, b) => a.score - b.score);

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to scan hygiene:", error);
    return NextResponse.json(
      { error: "Failed to scan project hygiene" },
      { status: 500 }
    );
  }
}
