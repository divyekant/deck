import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface LintIssue {
  severity: "error" | "warning" | "info";
  message: string;
}

interface LintResult {
  projectName: string;
  scope: "global" | "project";
  file: "CLAUDE.md" | "settings.json";
  path: string;
  lineCount: number;
  size: number;
  issues: LintIssue[];
  content?: string;
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
 * Lint a CLAUDE.md file and return issues found.
 */
function lintClaudeMd(content: string, lineCount: number): LintIssue[] {
  const issues: LintIssue[] = [];

  if (lineCount < 5) {
    issues.push({
      severity: "warning",
      message: "CLAUDE.md is very short, may need more detail",
    });
  }

  if (lineCount > 200) {
    issues.push({
      severity: "warning",
      message: "CLAUDE.md exceeds 200 lines, may be truncated by Claude",
    });
  }

  const hasHeadings = /^## /m.test(content);
  if (!hasHeadings) {
    issues.push({
      severity: "info",
      message: "No section headings found",
    });
  }

  return issues;
}

/**
 * Lint a settings.json file and return issues found.
 */
function lintSettingsJson(content: string): LintIssue[] {
  const issues: LintIssue[] = [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    issues.push({
      severity: "error",
      message: "settings.json has invalid JSON",
    });
    return issues;
  }

  const hooks = parsed.hooks;
  if (
    !hooks ||
    (typeof hooks === "object" && Object.keys(hooks as object).length === 0)
  ) {
    issues.push({
      severity: "info",
      message: "No hooks configured",
    });
  }

  return issues;
}

/**
 * Try to read a file, returning its content and stats, or null if it doesn't exist.
 */
async function readFileSafe(
  filePath: string
): Promise<{ content: string; size: number; lineCount: number } | null> {
  try {
    const [content, stat] = await Promise.all([
      fs.readFile(filePath, "utf-8"),
      fs.stat(filePath),
    ]);
    const lineCount = content.split("\n").length;
    return { content, size: stat.size, lineCount };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const results: LintResult[] = [];

    // 1. Lint global CLAUDE.md
    const globalClaudeMdPath = path.join(CLAUDE_DIR, "CLAUDE.md");
    const globalClaudeMd = await readFileSafe(globalClaudeMdPath);
    if (globalClaudeMd) {
      results.push({
        projectName: "Global",
        scope: "global",
        file: "CLAUDE.md",
        path: globalClaudeMdPath,
        lineCount: globalClaudeMd.lineCount,
        size: globalClaudeMd.size,
        issues: lintClaudeMd(globalClaudeMd.content, globalClaudeMd.lineCount),
        content: globalClaudeMd.content.slice(0, 2000),
      });
    } else {
      results.push({
        projectName: "Global",
        scope: "global",
        file: "CLAUDE.md",
        path: globalClaudeMdPath,
        lineCount: 0,
        size: 0,
        issues: [{ severity: "error", message: "No CLAUDE.md found" }],
      });
    }

    // 2. Lint global settings.json
    const globalSettingsPath = path.join(CLAUDE_DIR, "settings.json");
    const globalSettings = await readFileSafe(globalSettingsPath);
    if (globalSettings) {
      results.push({
        projectName: "Global",
        scope: "global",
        file: "settings.json",
        path: globalSettingsPath,
        lineCount: globalSettings.lineCount,
        size: globalSettings.size,
        issues: lintSettingsJson(globalSettings.content),
        content: globalSettings.content.slice(0, 2000),
      });
    }

    // 3. Scan project directories
    let entries;
    try {
      entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    } catch {
      return NextResponse.json(results);
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      try {
        const dirName = entry.name as string;
        const projectDir = path.join(PROJECTS_DIR, dirName);
        const projectName = readableProjectName(dirName);

        // CLAUDE.md
        const claudeMdPath = path.join(projectDir, "CLAUDE.md");
        const claudeMd = await readFileSafe(claudeMdPath);
        if (claudeMd) {
          results.push({
            projectName,
            scope: "project",
            file: "CLAUDE.md",
            path: claudeMdPath,
            lineCount: claudeMd.lineCount,
            size: claudeMd.size,
            issues: lintClaudeMd(claudeMd.content, claudeMd.lineCount),
            content: claudeMd.content.slice(0, 2000),
          });
        } else {
          results.push({
            projectName,
            scope: "project",
            file: "CLAUDE.md",
            path: claudeMdPath,
            lineCount: 0,
            size: 0,
            issues: [{ severity: "error", message: "No CLAUDE.md found" }],
          });
        }

        // settings.json
        const settingsPath = path.join(projectDir, "settings.json");
        const settingsFile = await readFileSafe(settingsPath);
        if (settingsFile) {
          results.push({
            projectName,
            scope: "project",
            file: "settings.json",
            path: settingsPath,
            lineCount: settingsFile.lineCount,
            size: settingsFile.size,
            issues: lintSettingsJson(settingsFile.content),
            content: settingsFile.content.slice(0, 2000),
          });
        }
      } catch {
        continue;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to run lint scan:", error);
    return NextResponse.json(
      { error: "Failed to run lint scan" },
      { status: 500 }
    );
  }
}
