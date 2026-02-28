import { readFile, readdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { Puzzle, Radio, Globe, FolderOpen, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/stats-card";

// --- Types ---

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

// --- Data loading ---

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
      ...(type === "stdio" && config.command
        ? { command: config.command, args: config.args ?? [] }
        : {}),
      ...(type === "sse" && config.url ? { url: config.url } : {}),
      scope,
      ...(projectName ? { projectName } : {}),
      ...(config.env && Object.keys(config.env).length > 0
        ? { env: config.env }
        : {}),
    };
  });
}

async function readJsonSafe(
  filePath: string
): Promise<Record<string, unknown> | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function projectNameFromDir(dirName: string): string {
  const parts = dirName.replace(/^-/, "").split("-");
  return parts[parts.length - 1] || dirName;
}

async function getPortsData() {
  const home = homedir();
  const allServers: McpServerEntry[] = [];
  const seen = new Set<string>();

  // 1. ~/.claude/.mcp.json
  const mcpJson = await readJsonSafe(join(home, ".claude", ".mcp.json"));
  if (mcpJson?.mcpServers && typeof mcpJson.mcpServers === "object") {
    for (const s of extractServers(
      mcpJson.mcpServers as Record<string, McpServerConfig>,
      "global"
    )) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        allServers.push(s);
      }
    }
  }

  // 2. ~/.claude.json
  const claudeJson = await readJsonSafe(join(home, ".claude.json"));
  if (claudeJson?.mcpServers && typeof claudeJson.mcpServers === "object") {
    for (const s of extractServers(
      claudeJson.mcpServers as Record<string, McpServerConfig>,
      "global"
    )) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        allServers.push(s);
      }
    }
  }

  // 3. ~/.claude/settings.json
  const settingsJson = await readJsonSafe(
    join(home, ".claude", "settings.json")
  );
  if (
    settingsJson?.mcpServers &&
    typeof settingsJson.mcpServers === "object"
  ) {
    for (const s of extractServers(
      settingsJson.mcpServers as Record<string, McpServerConfig>,
      "global"
    )) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        allServers.push(s);
      }
    }
  }

  // 4. Scan ~/.claude/projects/*/ for .mcp.json
  const projectsDir = join(home, ".claude", "projects");
  try {
    const projectDirs = await readdir(projectsDir, { withFileTypes: true });
    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const mcpPath = join(projectsDir, dir.name, ".mcp.json");
      const projectMcp = await readJsonSafe(mcpPath);
      if (
        projectMcp?.mcpServers &&
        typeof projectMcp.mcpServers === "object"
      ) {
        const pName = projectNameFromDir(dir.name);
        for (const s of extractServers(
          projectMcp.mcpServers as Record<string, McpServerConfig>,
          "project",
          pName
        )) {
          allServers.push(s);
        }
      }
    }
  } catch {
    // projects directory may not exist
  }

  const globalServers = allServers.filter((s) => s.scope === "global");
  const projectServers = allServers.filter((s) => s.scope === "project");

  return {
    servers: allServers,
    globalServers,
    projectServers,
    stats: {
      total: allServers.length,
      global: globalServers.length,
      projectScoped: projectServers.length,
    },
  };
}

// --- Server Card ---

function ServerCard({ server }: { server: McpServerEntry }) {
  const Icon = server.type === "stdio" ? Puzzle : Radio;

  const commandLine =
    server.type === "stdio" && server.command
      ? [server.command, ...(server.args ?? [])].join(" ")
      : null;

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Icon className="size-4 text-zinc-400" />
            <CardTitle className="text-base text-zinc-100">
              {server.name}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {/* Type badge */}
            {server.type === "stdio" ? (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400">
                stdio
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400">
                sse
              </span>
            )}
            {/* Scope badge */}
            {server.scope === "global" ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400">
                <Globe className="size-3" />
                Global
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-violet-500/10 text-violet-400">
                <FolderOpen className="size-3" />
                {server.projectName}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {commandLine && (
          <div className="font-mono text-xs text-zinc-400 bg-zinc-800/50 rounded px-2 py-1 break-all">
            {commandLine}
          </div>
        )}
        {server.type === "sse" && server.url && (
          <div className="font-mono text-xs text-zinc-400 bg-zinc-800/50 rounded px-2 py-1 break-all">
            {server.url}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Page ---

export default async function PortsPage() {
  const data = await getPortsData();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Ports
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          MCP servers configured across global and project scopes.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Total Servers"
          value={data.stats.total}
          icon={Server}
        />
        <StatsCard
          title="Global"
          value={data.stats.global}
          icon={Globe}
        />
        <StatsCard
          title="Project-Scoped"
          value={data.stats.projectScoped}
          icon={FolderOpen}
        />
      </div>

      {/* Empty state */}
      {data.servers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Puzzle className="size-12 text-zinc-800 mb-4" />
          <p className="text-sm text-zinc-500">
            No MCP servers configured.
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Add servers in ~/.claude/.mcp.json or project-level .mcp.json files.
          </p>
        </div>
      )}

      {/* Global Servers */}
      {data.globalServers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-200">
              Global Servers
            </h2>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400">
              {data.globalServers.length}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.globalServers.map((server) => (
              <ServerCard key={`global-${server.name}`} server={server} />
            ))}
          </div>
        </div>
      )}

      {/* Project Servers */}
      {data.projectServers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4 text-zinc-400" />
            <h2 className="text-lg font-semibold text-zinc-200">
              Project Servers
            </h2>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-400">
              {data.projectServers.length}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.projectServers.map((server) => (
              <ServerCard
                key={`project-${server.projectName}-${server.name}`}
                server={server}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
