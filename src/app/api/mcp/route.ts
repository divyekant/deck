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

    if (!action || !name) {
      return NextResponse.json(
        { error: "action and name are required" },
        { status: 400 }
      );
    }

    const mcpConfig = await readMcpConfig();

    switch (action) {
      case "add": {
        if (!serverConfig || !serverConfig.command) {
          return NextResponse.json(
            { error: "config with command is required for add" },
            { status: 400 }
          );
        }
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
        if (!serverConfig || !serverConfig.command) {
          return NextResponse.json(
            { error: "config with command is required for update" },
            { status: 400 }
          );
        }
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

      default:
        return NextResponse.json(
          { error: "action must be one of: add, remove, update" },
          { status: 400 }
        );
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
