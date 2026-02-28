import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { getProjectDirs } from "@/lib/claude/sessions";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const GLOBAL_COMMANDS_DIR = path.join(CLAUDE_DIR, "commands");
const GLOBAL_CLAUDE_MD = path.join(CLAUDE_DIR, "CLAUDE.md");
const GLOBAL_SKILLS_DIR = path.join(CLAUDE_DIR, "skills");
const PLUGINS_CACHE_DIR = path.join(CLAUDE_DIR, "plugins", "cache");

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

interface SkillEntry {
  name: string;
  source: "user" | "plugin";
  pluginName?: string;
  description?: string;
  files: string[];
}

interface SkillsResponse {
  commands: CommandEntry[];
  claudeMdFiles: ClaudeMdEntry[];
  skills: SkillEntry[];
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

/**
 * Scan a single skill directory (a directory containing .md files)
 * and return a SkillEntry.
 */
async function scanSkillDir(
  skillDir: string,
  skillName: string,
  source: "user" | "plugin",
  pluginName?: string
): Promise<SkillEntry | null> {
  try {
    const entries = await fs.readdir(skillDir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name);

    if (files.length === 0) return null;

    // Try to extract description from a README or the first .md file
    let description: string | undefined;
    const readmeFile = files.find(
      (f) => f.toLowerCase() === "readme.md" || f.toLowerCase() === "readme.txt"
    );
    const firstMd = files.find((f) => f.endsWith(".md"));
    const descFile = readmeFile || firstMd;

    if (descFile) {
      try {
        const content = await fs.readFile(
          path.join(skillDir, descFile),
          "utf-8"
        );
        // Use the first non-empty line as description
        const firstLine = content
          .split("\n")
          .map((l) => l.replace(/^#+\s*/, "").trim())
          .find((l) => l.length > 0);
        if (firstLine) {
          description = firstLine.slice(0, 200);
        }
      } catch {
        // Skip description extraction
      }
    }

    return {
      name: skillName,
      source,
      pluginName,
      description,
      files,
    };
  } catch {
    return null;
  }
}

/**
 * Scan ~/.claude/skills/ for user-defined skills.
 * Each subdirectory is a skill containing files.
 */
async function scanUserSkills(): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];
  try {
    const entries = await fs.readdir(GLOBAL_SKILLS_DIR, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skill = await scanSkillDir(
          path.join(GLOBAL_SKILLS_DIR, entry.name),
          entry.name,
          "user"
        );
        if (skill) skills.push(skill);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return skills;
}

/**
 * Scan ~/.claude/plugins/cache/ for installed plugin skills.
 * Each plugin directory may have a skills/ subdirectory with skill directories.
 */
async function scanPluginSkills(): Promise<SkillEntry[]> {
  const skills: SkillEntry[] = [];
  try {
    const plugins = await fs.readdir(PLUGINS_CACHE_DIR, {
      withFileTypes: true,
    });
    for (const plugin of plugins) {
      if (!plugin.isDirectory()) continue;

      const pluginSkillsDir = path.join(
        PLUGINS_CACHE_DIR,
        plugin.name,
        "skills"
      );
      try {
        const skillEntries = await fs.readdir(pluginSkillsDir, {
          withFileTypes: true,
        });
        for (const skillEntry of skillEntries) {
          if (skillEntry.isDirectory()) {
            const skill = await scanSkillDir(
              path.join(pluginSkillsDir, skillEntry.name),
              skillEntry.name,
              "plugin",
              plugin.name
            );
            if (skill) skills.push(skill);
          }
        }
      } catch {
        // No skills subdirectory for this plugin
      }
    }
  } catch {
    // Plugins cache directory doesn't exist
  }
  return skills;
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

    // 4. Scan user skills from ~/.claude/skills/
    const userSkills = await scanUserSkills();

    // 5. Scan plugin skills from ~/.claude/plugins/cache/
    const pluginSkills = await scanPluginSkills();

    const skills = [...userSkills, ...pluginSkills];

    const response: SkillsResponse = { commands, claudeMdFiles, skills };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to scan skills:", error);
    return NextResponse.json(
      { error: "Failed to scan skills" },
      { status: 500 }
    );
  }
}
