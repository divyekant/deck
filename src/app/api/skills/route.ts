import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { getProjectDirs } from "@/lib/claude/sessions";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const GLOBAL_COMMANDS_DIR = path.join(CLAUDE_DIR, "commands");
const GLOBAL_CLAUDE_MD = path.join(CLAUDE_DIR, "CLAUDE.md");

const CONTENT_TRUNCATE_LIMIT = 500;

interface CommandEntry {
  name: string;
  scope: "global" | "project";
  projectName: string | null;
  content: string;
}

interface ClaudeMdEntry {
  path: string;
  scope: "global" | "project";
  projectName: string | null;
  content: string;
  size: number;
  truncated: boolean;
}

interface SkillsResponse {
  commands: CommandEntry[];
  claudeMdFiles: ClaudeMdEntry[];
}

/**
 * Scan a directory for .md files and return them as command entries.
 */
async function scanCommandsDir(
  dir: string,
  scope: "global" | "project",
  projectName: string | null
): Promise<CommandEntry[]> {
  const commands: CommandEntry[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        try {
          const filePath = path.join(dir, entry.name);
          const content = await fs.readFile(filePath, "utf-8");
          commands.push({
            name: entry.name.replace(/\.md$/, ""),
            scope,
            projectName,
            content,
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return commands;
}

/**
 * Try to read a CLAUDE.md file and return its metadata.
 */
async function readClaudeMd(
  filePath: string,
  scope: "global" | "project",
  projectName: string | null
): Promise<ClaudeMdEntry | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const stat = await fs.stat(filePath);
    const truncated = content.length > CONTENT_TRUNCATE_LIMIT;
    return {
      path: filePath.replace(os.homedir(), "~"),
      scope,
      projectName,
      content: truncated
        ? content.slice(0, CONTENT_TRUNCATE_LIMIT)
        : content,
      size: stat.size,
      truncated,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const commands: CommandEntry[] = [];
    const claudeMdFiles: ClaudeMdEntry[] = [];

    // 1. Global commands from ~/.claude/commands/
    const globalCommands = await scanCommandsDir(
      GLOBAL_COMMANDS_DIR,
      "global",
      null
    );
    commands.push(...globalCommands);

    // 2. Global CLAUDE.md
    const globalMd = await readClaudeMd(GLOBAL_CLAUDE_MD, "global", null);
    if (globalMd) {
      claudeMdFiles.push(globalMd);
    }

    // 3. Project-level commands and CLAUDE.md files
    const projects = await getProjectDirs();
    for (const project of projects) {
      // Project commands: {projectPath}/.claude/commands/
      const projectCommandsDir = path.join(
        project.path,
        ".claude",
        "commands"
      );
      const projectCommands = await scanCommandsDir(
        projectCommandsDir,
        "project",
        project.name
      );
      commands.push(...projectCommands);

      // Project CLAUDE.md: {projectPath}/CLAUDE.md
      const projectMdPath = path.join(project.path, "CLAUDE.md");
      const projectMd = await readClaudeMd(
        projectMdPath,
        "project",
        project.name
      );
      if (projectMd) {
        claudeMdFiles.push(projectMd);
      }
    }

    // Sort commands: global first, then by name
    commands.sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === "global" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const response: SkillsResponse = { commands, claudeMdFiles };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to scan skills:", error);
    return NextResponse.json(
      { error: "Failed to scan skills" },
      { status: 500 }
    );
  }
}
