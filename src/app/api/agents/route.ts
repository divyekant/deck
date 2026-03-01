import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import { getProjectDirs } from "@/lib/claude/sessions";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const GLOBAL_AGENTS_DIR = path.join(CLAUDE_DIR, "agents");

const CONTENT_TRUNCATE_LIMIT = 5000;

interface AgentEntry {
  name: string;
  scope: "global" | "project";
  projectName: string | null;
  content: string;
  path: string;
  size: number;
}

/**
 * Scan a directory for .md agent files and return them as AgentEntry[].
 */
async function scanAgentsDir(
  dir: string,
  scope: "global" | "project",
  projectName: string | null
): Promise<AgentEntry[]> {
  const agents: AgentEntry[] = [];
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
          agents.push({
            name: entry.name.replace(/\.md$/, ""),
            scope,
            projectName,
            content: content.slice(0, CONTENT_TRUNCATE_LIMIT),
            path: filePath.replace(os.homedir(), "~"),
            size: stat.size,
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return agents;
}

export async function GET() {
  try {
    const agents: AgentEntry[] = [];

    // 1. Global agents from ~/.claude/agents/
    const globalAgents = await scanAgentsDir(
      GLOBAL_AGENTS_DIR,
      "global",
      null
    );
    agents.push(...globalAgents);

    // 2. Project-level agents
    const projects = await getProjectDirs();
    for (const project of projects) {
      // Check .claude/agents/ inside the project source directory
      const projectAgentsDir = path.join(project.path, ".claude", "agents");
      const projectAgents = await scanAgentsDir(
        projectAgentsDir,
        "project",
        project.name
      );
      agents.push(...projectAgents);
    }

    // Sort: global first, then alphabetically by project name, then by agent name
    agents.sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === "global" ? -1 : 1;
      if (a.projectName !== b.projectName) {
        return (a.projectName ?? "").localeCompare(b.projectName ?? "");
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(agents);
  } catch (error) {
    console.error("Failed to scan agents:", error);
    return NextResponse.json(
      { error: "Failed to scan agents" },
      { status: 500 }
    );
  }
}
