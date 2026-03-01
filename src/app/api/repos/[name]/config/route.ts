import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const MAX_CONTENT_LENGTH = 20000;

interface ClaudeMdInfo {
  content: string;
  lineCount: number;
  size: number;
  path: string;
}

interface MemoryFileInfo {
  fileName: string;
  content: string;
  lineCount: number;
  size: number;
}

interface SkillInfo {
  name: string;
  content: string;
  size: number;
}

interface RepoConfigResponse {
  claudeMd: ClaudeMdInfo | null;
  memory: MemoryFileInfo[];
  skills: SkillInfo[];
  settings: Record<string, unknown> | null;
}

/**
 * Convert a project name back to the directory name used in ~/.claude/projects/.
 * The repo detail page sends the project name (e.g. "deck"), which was derived
 * from the directory name by the sessions API.
 *
 * We scan the projects directory to find a matching dir that ends with the given name.
 */
async function findProjectDir(projectName: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Check if this dir name ends with the project name
      const segments = entry.name.split("-").filter(Boolean);
      const lastName = segments[segments.length - 1];
      if (lastName === projectName) {
        return entry.name;
      }
    }
  } catch {
    // Projects directory doesn't exist
  }
  return null;
}

/**
 * Read the project's CLAUDE.md from ~/.claude/projects/{dirName}/CLAUDE.md
 */
async function readClaudeMd(dirName: string): Promise<ClaudeMdInfo | null> {
  const filePath = path.join(PROJECTS_DIR, dirName, "CLAUDE.md");
  try {
    const [raw, stat] = await Promise.all([
      fs.readFile(filePath, "utf-8"),
      fs.stat(filePath),
    ]);
    const content =
      raw.length > MAX_CONTENT_LENGTH
        ? raw.slice(0, MAX_CONTENT_LENGTH) + "\n\n... (truncated)"
        : raw;
    return {
      content,
      lineCount: raw.split("\n").length,
      size: stat.size,
      path: filePath.replace(os.homedir(), "~"),
    };
  } catch {
    return null;
  }
}

/**
 * Read memory files from ~/.claude/projects/{dirName}/memory/*.md
 */
async function readMemoryFiles(dirName: string): Promise<MemoryFileInfo[]> {
  const memoryDir = path.join(PROJECTS_DIR, dirName, "memory");
  const results: MemoryFileInfo[] = [];

  try {
    const files = await fs.readdir(memoryDir);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    for (const fileName of mdFiles) {
      try {
        const filePath = path.join(memoryDir, fileName);
        const [raw, stat] = await Promise.all([
          fs.readFile(filePath, "utf-8"),
          fs.stat(filePath),
        ]);
        const content =
          raw.length > MAX_CONTENT_LENGTH
            ? raw.slice(0, MAX_CONTENT_LENGTH) + "\n\n... (truncated)"
            : raw;
        results.push({
          fileName,
          content,
          lineCount: raw.split("\n").length,
          size: stat.size,
        });
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Memory directory doesn't exist
  }

  return results;
}

/**
 * Read skills from:
 * 1. ~/.claude/projects/{dirName}/skills/ (project-level skills directory)
 * 2. The actual project directory's .claude/agents/ directory
 */
async function readSkills(
  dirName: string,
  projectPath: string
): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  // 1. Check ~/.claude/projects/{dirName}/skills/
  const projectSkillsDir = path.join(PROJECTS_DIR, dirName, "skills");
  await scanSkillDirectory(projectSkillsDir, skills);

  // 2. Check {projectPath}/.claude/agents/ if the project path is valid
  if (projectPath) {
    const agentsDir = path.join(projectPath, ".claude", "agents");
    await scanSkillDirectory(agentsDir, skills);
  }

  return skills;
}

async function scanSkillDirectory(
  dir: string,
  skills: SkillInfo[]
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        try {
          const filePath = path.join(dir, entry.name);
          const [content, stat] = await Promise.all([
            fs.readFile(filePath, "utf-8"),
            fs.stat(filePath),
          ]);
          skills.push({
            name: entry.name.replace(/\.md$/, ""),
            content:
              content.length > MAX_CONTENT_LENGTH
                ? content.slice(0, MAX_CONTENT_LENGTH) + "\n\n... (truncated)"
                : content,
            size: stat.size,
          });
        } catch {
          // Skip unreadable files
        }
      } else if (entry.isDirectory()) {
        // Scan subdirectories (skills are often in nested dirs)
        const subDir = path.join(dir, entry.name);
        try {
          const subEntries = await fs.readdir(subDir, { withFileTypes: true });
          const mdFiles = subEntries.filter(
            (e) => e.isFile() && e.name.endsWith(".md")
          );
          for (const mdFile of mdFiles) {
            try {
              const filePath = path.join(subDir, mdFile.name);
              const [content, stat] = await Promise.all([
                fs.readFile(filePath, "utf-8"),
                fs.stat(filePath),
              ]);
              skills.push({
                name: `${entry.name}/${mdFile.name.replace(/\.md$/, "")}`,
                content:
                  content.length > MAX_CONTENT_LENGTH
                    ? content.slice(0, MAX_CONTENT_LENGTH) +
                      "\n\n... (truncated)"
                    : content,
                size: stat.size,
              });
            } catch {
              // Skip
            }
          }
        } catch {
          // Skip
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }
}

/**
 * Read settings.json from ~/.claude/projects/{dirName}/settings.json
 */
async function readSettings(
  dirName: string
): Promise<Record<string, unknown> | null> {
  const filePath = path.join(PROJECTS_DIR, dirName, "settings.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const projectName = decodeURIComponent(name);

    const dirName = await findProjectDir(projectName);
    if (!dirName) {
      // Return empty config rather than 404 -- project may exist but have no config
      const emptyResponse: RepoConfigResponse = {
        claudeMd: null,
        memory: [],
        skills: [],
        settings: null,
      };
      return NextResponse.json(emptyResponse);
    }

    // Reconstruct the project path from dirName
    let projectPath = "";
    if (dirName.startsWith("-")) {
      projectPath = "/" + dirName.slice(1).replace(/-/g, "/");
    } else {
      projectPath = dirName.replace(/-/g, "/");
    }

    const [claudeMd, memory, skills, settings] = await Promise.all([
      readClaudeMd(dirName),
      readMemoryFiles(dirName),
      readSkills(dirName, projectPath),
      readSettings(dirName),
    ]);

    const response: RepoConfigResponse = {
      claudeMd,
      memory,
      skills,
      settings,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get repo config:", error);
    return NextResponse.json(
      { error: "Failed to get repo config" },
      { status: 500 }
    );
  }
}
