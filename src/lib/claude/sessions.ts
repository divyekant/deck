import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { parseSessionFile } from "./parser";
import type {
  DailyActivity,
  ModelCostBreakdown,
  OverviewStats,
  SessionDetail,
  SessionMeta,
} from "./types";

// ---- Constants ----

export const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

// ---- Module-level cache ----
// Keyed by "filePath::mtime" to invalidate when the file changes.

interface CacheEntry {
  mtime: number;
  meta: SessionMeta;
}

const metaCache = new Map<string, CacheEntry>();

// ---- Project Discovery ----

/**
 * Convert an escaped directory name (dashes-for-slashes) back to a readable
 * project name by taking the last meaningful path segment.
 *
 * Examples:
 *   "-Users-divyekant-Projects-kai"       -> "kai"
 *   "-Users-divyekant-Projects-CleverTap"  -> "CleverTap"
 *   "-Users-divyekant"                     -> "divyekant"
 */
function readableProjectName(dirName: string): string {
  // Split on dashes, filter empty segments, take the last one
  const segments = dirName.split("-").filter(Boolean);
  return segments[segments.length - 1] || dirName;
}

/**
 * Convert an escaped directory name back to the original filesystem path.
 * e.g. "-Users-divyekant-Projects-kai" -> "/Users/divyekant/Projects/kai"
 */
function dirNameToPath(dirName: string): string {
  // The leading dash represents the root "/", remaining dashes are path separators
  if (dirName.startsWith("-")) {
    return "/" + dirName.slice(1).replace(/-/g, "/");
  }
  return dirName.replace(/-/g, "/");
}

/**
 * Scan ~/.claude/projects/ for project directories.
 * Returns an array of { path, name } where path is the original filesystem
 * path and name is a short human-readable label.
 */
export async function getProjectDirs(): Promise<
  { path: string; name: string; dirName: string }[]
> {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => ({
        path: dirNameToPath(e.name),
        name: readableProjectName(e.name),
        dirName: e.name,
      }));
  } catch {
    // If the projects directory doesn't exist, return empty
    return [];
  }
}

/**
 * Find all .jsonl session files in a project directory.
 * Excludes history.jsonl and non-UUID-named files (directories, etc.)
 */
export async function getSessionFiles(projectDir: string): Promise<string[]> {
  const fullDir = path.join(PROJECTS_DIR, projectDir);
  try {
    const entries = await fs.readdir(fullDir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith(".jsonl") &&
          e.name !== "history.jsonl"
      )
      .map((e) => path.join(fullDir, e.name));
  } catch {
    return [];
  }
}

// ---- Session Listing ----

/**
 * List all sessions across all projects, sorted by startTime descending.
 * Uses mtime-based caching so unchanged files are not re-parsed.
 */
export async function listSessions(): Promise<SessionMeta[]> {
  const projects = await getProjectDirs();
  const allMetas: SessionMeta[] = [];

  for (const project of projects) {
    const files = await getSessionFiles(project.dirName);

    for (const filePath of files) {
      try {
        const stat = await fs.stat(filePath);
        const mtimeMs = stat.mtimeMs;
        const cached = metaCache.get(filePath);

        if (cached && cached.mtime === mtimeMs) {
          allMetas.push(cached.meta);
          continue;
        }

        const detail = await parseSessionFile(
          filePath,
          project.path,
          project.name
        );

        // Only include sessions that have at least one user or assistant message
        if (detail.meta.messageCount > 0) {
          metaCache.set(filePath, { mtime: mtimeMs, meta: detail.meta });
          allMetas.push(detail.meta);
        }
      } catch {
        // Skip files that can't be read or parsed
        continue;
      }
    }
  }

  // Sort by startTime descending (most recent first)
  allMetas.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  return allMetas;
}

// ---- Single Session Retrieval ----

/**
 * Find and parse a specific session by its ID across all projects.
 * Returns null if the session is not found.
 */
export async function getSession(
  sessionId: string
): Promise<SessionDetail | null> {
  const projects = await getProjectDirs();

  for (const project of projects) {
    const fullDir = path.join(PROJECTS_DIR, project.dirName);
    const filePath = path.join(fullDir, `${sessionId}.jsonl`);

    try {
      await fs.access(filePath);
      return await parseSessionFile(filePath, project.path, project.name);
    } catch {
      // File doesn't exist in this project, try next
      continue;
    }
  }

  return null;
}

// ---- Work Hours ----

/**
 * Count how many sessions started in each hour of the day (0-23).
 * Returns an array of 24 entries.
 */
export async function getWorkHoursData(): Promise<{ hour: number; count: number }[]> {
  const sessions = await listSessions();
  const hourCounts = new Array(24).fill(0);
  for (const s of sessions) {
    const hour = new Date(s.startTime).getHours();
    hourCounts[hour]++;
  }
  return hourCounts.map((count, hour) => ({ hour, count }));
}

// ---- Overview / Stats ----

/**
 * Compute aggregate overview stats:
 * - Total sessions and total cost
 * - Cost breakdown by model
 * - Daily activity for the last 30 days
 * - 5 most recent sessions
 */
export async function getOverviewStats(): Promise<OverviewStats> {
  const sessions = await listSessions();

  let totalCost = 0;
  const modelMap = new Map<string, { cost: number; count: number }>();
  const dailyMap = new Map<string, { count: number; cost: number }>();

  // Date boundary: 30 days ago at midnight UTC
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  for (const session of sessions) {
    totalCost += session.estimatedCost;

    // Model breakdown
    const existing = modelMap.get(session.model) ?? { cost: 0, count: 0 };
    existing.cost += session.estimatedCost;
    existing.count += 1;
    modelMap.set(session.model, existing);

    // Daily activity (last 30 days only)
    const sessionDate = new Date(session.startTime);
    if (sessionDate >= thirtyDaysAgo) {
      const dateKey = sessionDate.toISOString().slice(0, 10); // YYYY-MM-DD
      const daily = dailyMap.get(dateKey) ?? { count: 0, cost: 0 };
      daily.count += 1;
      daily.cost += session.estimatedCost;
      dailyMap.set(dateKey, daily);
    }
  }

  // Build model breakdown array, sorted by cost descending
  const modelBreakdown: ModelCostBreakdown[] = Array.from(modelMap.entries())
    .map(([model, data]) => ({
      model,
      totalCost: data.cost,
      sessionCount: data.count,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  // Build daily activity array, sorted by date ascending
  const dailyActivity: DailyActivity[] = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      sessionCount: data.count,
      cost: data.cost,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 5 most recent sessions (already sorted by startTime desc)
  const recentSessions = sessions.slice(0, 5);

  return {
    totalSessions: sessions.length,
    totalCost,
    modelBreakdown,
    dailyActivity,
    recentSessions,
  };
}
