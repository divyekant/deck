import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

import {
  getProjectDirs,
  getSessionFiles,
} from "@/lib/claude/sessions";
import { parseJsonlLine } from "@/lib/claude/parser";

// ---- Types ----

interface CommandEntry {
  command: string;
  output: string;
  sessionId: string;
  project: string;
  timestamp: string;
  messageIndex: number;
}

// Tool names that represent terminal command execution
const TERMINAL_TOOL_NAMES = new Set([
  "Bash",
  "execute_command",
  "bash",
  "terminal",
  "shell",
  "run_command",
]);

// ---- Helpers ----

/**
 * Extract the first N lines from a string.
 */
function firstNLines(text: string, n: number): string {
  return text.split("\n").slice(0, n).join("\n");
}

/**
 * Extract commands from a single session JSONL file.
 */
async function extractCommandsFromFile(
  filePath: string,
  project: string
): Promise<CommandEntry[]> {
  const raw = await fs.readFile(filePath, "utf-8");
  const lines = raw.split("\n");

  const commands: CommandEntry[] = [];
  const sessionId = path.basename(filePath, ".jsonl");

  // Two-pass: collect tool_use blocks from assistant messages,
  // then match tool_result blocks from user messages by tool_use_id.
  interface PendingCommand {
    command: string;
    timestamp: string;
    messageIndex: number;
    toolUseId: string;
  }

  const pendingByToolId = new Map<string, PendingCommand>();
  let messageIndex = 0;

  for (const line of lines) {
    const parsed = parseJsonlLine(line);
    if (!parsed) continue;

    const type = parsed.type as string;

    if (type === "assistant") {
      messageIndex++;
      const msg = parsed.message as Record<string, unknown> | undefined;
      if (!msg) continue;

      const content = msg.content as unknown[] | undefined;
      if (!Array.isArray(content)) continue;

      const timestamp =
        (parsed.timestamp as string) || "";

      for (const block of content) {
        if (
          typeof block !== "object" ||
          block === null ||
          (block as Record<string, unknown>).type !== "tool_use"
        )
          continue;

        const toolBlock = block as Record<string, unknown>;
        const toolName = toolBlock.name as string;

        if (!TERMINAL_TOOL_NAMES.has(toolName)) continue;

        const input = toolBlock.input as Record<string, unknown> | undefined;
        if (!input) continue;

        const commandText =
          (input.command as string) || (input.cmd as string) || "";
        if (!commandText) continue;

        const toolUseId = (toolBlock.id as string) || "";

        if (toolUseId) {
          pendingByToolId.set(toolUseId, {
            command: commandText,
            timestamp,
            messageIndex,
            toolUseId,
          });
        } else {
          // No id to match result — store with empty output
          commands.push({
            command: commandText,
            output: "",
            sessionId,
            project,
            timestamp,
            messageIndex,
          });
        }
      }
    }

    if (type === "user") {
      const msg = parsed.message as Record<string, unknown> | undefined;
      if (!msg) continue;

      const content = msg.content;
      if (!Array.isArray(content)) continue;

      for (const block of content) {
        if (
          typeof block !== "object" ||
          block === null ||
          (block as Record<string, unknown>).type !== "tool_result"
        )
          continue;

        const resultBlock = block as Record<string, unknown>;
        const toolUseId = resultBlock.tool_use_id as string;
        if (!toolUseId) continue;

        const pending = pendingByToolId.get(toolUseId);
        if (!pending) continue;

        // Extract output text
        let outputText = "";
        const resultContent = resultBlock.content;
        if (typeof resultContent === "string") {
          outputText = resultContent;
        } else if (Array.isArray(resultContent)) {
          // Content can be an array of { type: "text", text: "..." } blocks
          for (const item of resultContent) {
            if (
              typeof item === "object" &&
              item !== null &&
              (item as Record<string, unknown>).type === "text"
            ) {
              outputText +=
                (outputText ? "\n" : "") +
                ((item as Record<string, unknown>).text as string);
            }
          }
        }

        commands.push({
          command: pending.command,
          output: firstNLines(outputText, 3),
          sessionId,
          project,
          timestamp: pending.timestamp,
          messageIndex: pending.messageIndex,
        });

        pendingByToolId.delete(toolUseId);
      }
    }
  }

  // Any pending commands without matched results get empty output
  for (const pending of pendingByToolId.values()) {
    commands.push({
      command: pending.command,
      output: "",
      sessionId,
      project,
      timestamp: pending.timestamp,
      messageIndex: pending.messageIndex,
    });
  }

  return commands;
}

// ---- Route Handler ----

const MAX_SESSION_FILES = 100;
const MAX_COMMANDS_BEFORE_STOP = 500;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.max(
      1,
      Math.min(500, parseInt(searchParams.get("limit") || "100", 10) || 100)
    );
    const offset = Math.max(
      0,
      parseInt(searchParams.get("offset") || "0", 10) || 0
    );
    const query = (searchParams.get("q") || "").toLowerCase();

    const projects = await getProjectDirs();
    const allCommands: CommandEntry[] = [];

    // Collect all session files across projects, then sort by mtime desc and cap
    const allFiles: { filePath: string; project: string; mtime: number }[] = [];
    for (const project of projects) {
      const files = await getSessionFiles(project.dirName);
      for (const filePath of files) {
        try {
          const stat = await fs.stat(filePath);
          allFiles.push({ filePath, project: project.name, mtime: stat.mtimeMs });
        } catch {
          // Skip files that can't be stat'd
          continue;
        }
      }
    }

    // Sort most-recent-first and limit to MAX_SESSION_FILES
    allFiles.sort((a, b) => b.mtime - a.mtime);
    const cappedFiles = allFiles.slice(0, MAX_SESSION_FILES);

    for (const { filePath, project } of cappedFiles) {
      try {
        const commands = await extractCommandsFromFile(filePath, project);
        allCommands.push(...commands);
        // Early termination: stop scanning once we have enough commands
        if (allCommands.length >= MAX_COMMANDS_BEFORE_STOP) break;
      } catch {
        // Skip files that can't be read or parsed
        continue;
      }
    }

    // Sort by timestamp descending (most recent first)
    allCommands.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply search filter
    let filtered = allCommands;
    if (query) {
      filtered = allCommands.filter(
        (cmd) =>
          cmd.command.toLowerCase().includes(query) ||
          cmd.output.toLowerCase().includes(query) ||
          cmd.project.toLowerCase().includes(query)
      );
    }

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      commands: paged,
      total,
    });
  } catch (error) {
    console.error("Failed to extract commands:", error);
    return NextResponse.json(
      { error: "Failed to extract commands" },
      { status: 500 }
    );
  }
}
