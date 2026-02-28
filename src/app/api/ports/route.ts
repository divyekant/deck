import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { homedir } from "os";
import { join, basename } from "path";

interface McpServerEntry {
  name: string;
  type: "stdio" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  scope: "global" | "project";
  projectName?: string;
  env?: Record<string, string>;
}

interface McpServerConfig {
  type?: "stdio" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

function inferType(config: McpServerConfig): "stdio" | "sse" {
  if (config.type === "sse" || config.url) return "sse";
  return "stdio";
}

function extractServers(
  servers: Record<string, McpServerConfig>,
  scope: "global" | "project",
  projectName?: string
): McpServerEntry[] {
  return Object.entries(servers).map(([name, config]) => {
    const type = inferType(config);
    return {
      name,
      type,
      ...(type === "stdio" && config.command ? { command: config.command, args: config.args ?? [] } : {}),
      ...(type === "sse" && config.url ? { url: config.url } : {}),
      scope,
      ...(projectName ? { projectName } : {}),
      ...(config.env && Object.keys(config.env).length > 0
        ? { env: Object.fromEntries(Object.entries(config.env).map(([k]) => [k, "***"])) }
        : {}),
    };
  });
}

async function readJsonSafe(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function projectNameFromDir(dirName: string): string {
  // Convert "-Users-divyekant-Projects-kai" to "kai"
  const parts = dirName.replace(/^-/, "").split("-");
  return parts[parts.length - 1] || dirName;
}

async function getAllServers(): Promise<McpServerEntry[]> {
  const home = homedir();
  const allServers: McpServerEntry[] = [];
  const seen = new Set<string>();

  // 1. ~/.claude/.mcp.json — global MCP config
  const mcpJson = await readJsonSafe(join(home, ".claude", ".mcp.json"));
  if (mcpJson?.mcpServers && typeof mcpJson.mcpServers === "object") {
    const servers = extractServers(
      mcpJson.mcpServers as Record<string, McpServerConfig>,
      "global"
    );
    for (const s of servers) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        allServers.push(s);
      }
    }
  }

  // 2. ~/.claude.json — may have mcpServers at top level
  const claudeJson = await readJsonSafe(join(home, ".claude.json"));
  if (claudeJson?.mcpServers && typeof claudeJson.mcpServers === "object") {
    const servers = extractServers(
      claudeJson.mcpServers as Record<string, McpServerConfig>,
      "global"
    );
    for (const s of servers) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        allServers.push(s);
      }
    }
  }

  // 3. ~/.claude/settings.json — may have mcpServers
  const settingsJson = await readJsonSafe(join(home, ".claude", "settings.json"));
  if (settingsJson?.mcpServers && typeof settingsJson.mcpServers === "object") {
    const servers = extractServers(
      settingsJson.mcpServers as Record<string, McpServerConfig>,
      "global"
    );
    for (const s of servers) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        allServers.push(s);
      }
    }
  }

  // 4. Scan ~/.claude/projects/*/ for .mcp.json files
  const projectsDir = join(home, ".claude", "projects");
  try {
    const projectDirs = await readdir(projectsDir, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const mcpPath = join(projectsDir, dir.name, ".mcp.json");
      const projectMcp = await readJsonSafe(mcpPath);
      if (projectMcp?.mcpServers && typeof projectMcp.mcpServers === "object") {
        const pName = projectNameFromDir(dir.name);
        const servers = extractServers(
          projectMcp.mcpServers as Record<string, McpServerConfig>,
          "project",
          pName
        );
        for (const s of servers) {
          allServers.push(s);
        }
      }
    }
  } catch {
    // projects directory may not exist
  }

  return allServers;
}

export async function GET() {
  try {
    const servers = await getAllServers();

    const global = servers.filter((s) => s.scope === "global").length;
    const projectScoped = servers.filter((s) => s.scope === "project").length;

    return NextResponse.json({
      servers,
      stats: {
        total: servers.length,
        global,
        projectScoped,
      },
    });
  } catch (error) {
    console.error("Failed to read MCP server configs:", error);
    return NextResponse.json(
      { error: "Failed to read MCP server configs" },
      { status: 500 }
    );
  }
}
