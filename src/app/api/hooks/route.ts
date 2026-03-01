import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const GLOBAL_SETTINGS = path.join(CLAUDE_DIR, "settings.json");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface HookCommand {
  type: string;
  command: string;
  timeout?: number;
}

interface HookRule {
  matcher: string;
  hooks: HookCommand[];
}

interface HookGroup {
  event: string;
  scope: "global" | "project";
  projectName: string | null;
  rules: HookRule[];
}

/**
 * Convert an escaped directory name back to a readable project name.
 * e.g. "-Users-divyekant-Projects-deck" -> "deck"
 */
function readableProjectName(dirName: string): string {
  const segments = dirName.split("-").filter(Boolean);
  return segments[segments.length - 1] || dirName;
}

/**
 * Read a settings.json file and extract hooks configuration.
 */
async function extractHooks(
  filePath: string,
  scope: "global" | "project",
  projectName: string | null
): Promise<HookGroup[]> {
  const groups: HookGroup[] = [];
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const hooks = parsed.hooks;
    if (!hooks || typeof hooks !== "object") return groups;

    for (const [event, rules] of Object.entries(hooks)) {
      if (!Array.isArray(rules) || rules.length === 0) continue;
      groups.push({
        event,
        scope,
        projectName,
        rules: rules as HookRule[],
      });
    }
  } catch {
    // File doesn't exist or isn't valid JSON — skip
  }
  return groups;
}

export async function GET() {
  try {
    const allGroups: HookGroup[] = [];

    // 1. Global hooks from ~/.claude/settings.json
    const globalGroups = await extractHooks(GLOBAL_SETTINGS, "global", null);
    allGroups.push(...globalGroups);

    // 2. Per-project hooks from ~/.claude/projects/<dir>/settings.json
    try {
      const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const projectSettings = path.join(
          PROJECTS_DIR,
          entry.name,
          "settings.json"
        );
        const projectName = readableProjectName(entry.name);
        const projectGroups = await extractHooks(
          projectSettings,
          "project",
          projectName
        );
        allGroups.push(...projectGroups);
      }
    } catch {
      // Projects directory doesn't exist
    }

    // Sort: global first, then by project name, then by event
    allGroups.sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === "global" ? -1 : 1;
      if (a.projectName !== b.projectName) {
        return (a.projectName ?? "").localeCompare(b.projectName ?? "");
      }
      return a.event.localeCompare(b.event);
    });

    return NextResponse.json(allGroups);
  } catch (error) {
    console.error("Failed to scan hooks:", error);
    return NextResponse.json(
      { error: "Failed to scan hooks" },
      { status: 500 }
    );
  }
}
