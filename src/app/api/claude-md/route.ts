import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const GLOBAL_CLAUDE_MD = path.join(CLAUDE_DIR, "CLAUDE.md");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

const CONTENT_TRUNCATE_LIMIT = 10000;

interface ClaudeMdEntry {
  scope: "global" | "project";
  projectName: string | null;
  content: string;
  path: string;
  size: number;
  lastModified: string;
}

/**
 * Convert an escaped directory name back to a readable project name.
 * e.g. "-Users-divyekant-Projects-deck" -> "deck"
 */
function readableProjectName(dirName: string): string {
  let fsPath: string;
  if (dirName.startsWith("-")) {
    fsPath = "/" + dirName.slice(1).replace(/-/g, "/");
  } else {
    fsPath = dirName.replace(/-/g, "/");
  }
  return path.basename(fsPath);
}

/**
 * Try to read a CLAUDE.md file and return its metadata.
 */
async function readClaudeMdFile(
  filePath: string,
  scope: "global" | "project",
  projectName: string | null
): Promise<ClaudeMdEntry | null> {
  try {
    const stat = await fs.stat(filePath);
    const raw = await fs.readFile(filePath, "utf-8");
    const content =
      raw.length > CONTENT_TRUNCATE_LIMIT
        ? raw.slice(0, CONTENT_TRUNCATE_LIMIT)
        : raw;

    return {
      scope,
      projectName,
      content,
      path: filePath.replace(os.homedir(), "~"),
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const entries: ClaudeMdEntry[] = [];

    // 1. Global CLAUDE.md
    const globalEntry = await readClaudeMdFile(
      GLOBAL_CLAUDE_MD,
      "global",
      null
    );
    if (globalEntry) {
      entries.push(globalEntry);
    }

    // 2. Per-project CLAUDE.md files in ~/.claude/projects/*/
    try {
      const projectDirs = await fs.readdir(PROJECTS_DIR, {
        withFileTypes: true,
      });

      for (const dir of projectDirs) {
        if (!dir.isDirectory()) continue;

        const projectClaudeMd = path.join(
          PROJECTS_DIR,
          dir.name,
          "CLAUDE.md"
        );
        const projectName = readableProjectName(dir.name);
        const entry = await readClaudeMdFile(
          projectClaudeMd,
          "project",
          projectName
        );
        if (entry) {
          entries.push(entry);
        }
      }
    } catch {
      // projects directory doesn't exist
    }

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Failed to scan CLAUDE.md files:", error);
    return NextResponse.json(
      { error: "Failed to scan CLAUDE.md files" },
      { status: 500 }
    );
  }
}
