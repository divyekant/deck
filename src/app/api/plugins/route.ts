import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { Dirent } from "fs";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PLUGINS_CACHE_DIR = path.join(CLAUDE_DIR, "plugins", "cache");

interface PluginEntry {
  org: string;
  name: string;
  version: string;
  path: string;
  skillCount: number;
}

/**
 * Count .md files in a skills/ subdirectory.
 */
async function countSkills(pluginVersionDir: string): Promise<number> {
  const skillsDir = path.join(pluginVersionDir, "skills");
  try {
    const skillDirs = await fs.readdir(skillsDir, { withFileTypes: true });
    let count = 0;
    for (const entry of skillDirs) {
      if (entry.isDirectory()) {
        try {
          const files = await fs.readdir(path.join(skillsDir, entry.name));
          count += files.filter((f: string) => f.endsWith(".md")).length;
        } catch {
          // skip unreadable
        }
      }
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Check if a directory name looks like a semver version (e.g. "4.3.1", "1.0.0-beta.2").
 */
function looksLikeVersion(name: string): boolean {
  return /^\d+\.\d+/.test(name);
}

async function readdirSafe(
  dir: string
): Promise<Dirent[]> {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const plugins: PluginEntry[] = [];

    const orgDirs = await readdirSafe(PLUGINS_CACHE_DIR);
    if (orgDirs.length === 0) {
      return NextResponse.json([]);
    }

    for (const orgEntry of orgDirs) {
      // Skip dotfiles, non-directories, and temp_git cache clones
      if (!orgEntry.isDirectory()) continue;
      if (orgEntry.name.startsWith(".")) continue;
      if (orgEntry.name.startsWith("temp_git_")) continue;
      if (orgEntry.name === "update-checker-last-check") continue;

      const orgPath = path.join(PLUGINS_CACHE_DIR, orgEntry.name);
      const pluginDirs = await readdirSafe(orgPath);

      for (const pluginEntry of pluginDirs) {
        if (!pluginEntry.isDirectory()) continue;
        if (pluginEntry.name.startsWith(".")) continue;

        const pluginPath = path.join(orgPath, pluginEntry.name);
        const versionDirs = await readdirSafe(pluginPath);

        for (const versionEntry of versionDirs) {
          if (!versionEntry.isDirectory()) continue;
          if (!looksLikeVersion(versionEntry.name)) continue;

          const versionPath = path.join(pluginPath, versionEntry.name);
          const skillCount = await countSkills(versionPath);

          plugins.push({
            org: orgEntry.name,
            name: pluginEntry.name,
            version: versionEntry.name,
            path: versionPath.replace(os.homedir(), "~"),
            skillCount,
          });
        }
      }
    }

    return NextResponse.json(plugins);
  } catch (error) {
    console.error("Failed to scan plugins:", error);
    return NextResponse.json(
      { error: "Failed to scan plugins" },
      { status: 500 }
    );
  }
}
