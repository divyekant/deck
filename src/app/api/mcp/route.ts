import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

const MCP_CONFIG_PATH = join(homedir(), ".claude", ".mcp.json");

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

async function readMcpConfig(): Promise<McpConfig> {
  try {
    const raw = await readFile(MCP_CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { mcpServers: {} };
  }
}

async function writeMcpConfig(config: McpConfig): Promise<void> {
  await writeFile(MCP_CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

const VALID_ACTIONS = ["add", "update", "remove"] as const;
type McpAction = typeof VALID_ACTIONS[number];

export async function GET() {
  try {
    const config = await readMcpConfig();
    return NextResponse.json(config.mcpServers);
  } catch (error) {
    console.error("Failed to read MCP config:", error);
    return NextResponse.json(
      { error: "Failed to read MCP config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, name, config: serverConfig } = body;

    // Validate action
    if (!action || typeof action !== "string") {
      return NextResponse.json(
        { error: "action is required and must be a string" },
        { status: 400 }
      );
    }

    if (!VALID_ACTIONS.includes(action as McpAction)) {
      return NextResponse.json(
        { error: `action must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate name
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Validate config.command for add/update
    if (action === "add" || action === "update") {
      if (!serverConfig || typeof serverConfig !== "object") {
        return NextResponse.json(
          { error: "config object is required for add/update actions" },
          { status: 400 }
        );
      }

      if (!serverConfig.command || typeof serverConfig.command !== "string" || !serverConfig.command.trim()) {
        return NextResponse.json(
          { error: "config.command is required and must be a non-empty string" },
          { status: 400 }
        );
      }
    }

    const mcpConfig = await readMcpConfig();

    switch (action) {
      case "add": {
        if (mcpConfig.mcpServers[name]) {
          return NextResponse.json(
            { error: `Server "${name}" already exists. Use update to modify it.` },
            { status: 409 }
          );
        }
        mcpConfig.mcpServers[name] = {
          command: serverConfig.command,
          args: serverConfig.args || [],
          ...(serverConfig.env && Object.keys(serverConfig.env).length > 0
            ? { env: serverConfig.env }
            : {}),
        };
        break;
      }

      case "update": {
        if (!mcpConfig.mcpServers[name]) {
          return NextResponse.json(
            { error: `Server "${name}" not found` },
            { status: 404 }
          );
        }
        mcpConfig.mcpServers[name] = {
          command: serverConfig.command,
          args: serverConfig.args || [],
          ...(serverConfig.env && Object.keys(serverConfig.env).length > 0
            ? { env: serverConfig.env }
            : {}),
        };
        break;
      }

      case "remove": {
        if (!mcpConfig.mcpServers[name]) {
          return NextResponse.json(
            { error: `Server "${name}" not found` },
            { status: 404 }
          );
        }
        delete mcpConfig.mcpServers[name];
        break;
      }
    }

    await writeMcpConfig(mcpConfig);
    return NextResponse.json({ success: true, mcpServers: mcpConfig.mcpServers });
  } catch (error) {
    console.error("Failed to update MCP config:", error);
    return NextResponse.json(
      { error: "Failed to update MCP config" },
      { status: 500 }
    );
  }
}
