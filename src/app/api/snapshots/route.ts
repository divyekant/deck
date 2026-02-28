import { NextRequest, NextResponse } from "next/server";

import { listSessions, getSession } from "@/lib/claude/sessions";
import type {
  AssistantMessage,
  ContentBlock,
  ToolUseBlock,
  TextBlock,
} from "@/lib/claude/types";

// ---- Snapshot Types ----

interface Snapshot {
  id: string;
  projectName: string;
  model: string;
  firstPrompt: string;
  startTime: string;
  duration: number;
  estimatedCost: number;
  messageCount: number;
  filesModified: string[];
  filesCount: number;
  commandsRun: string[];
  keyActions: string[];
  toolCallsCount: number;
}

// ---- Helpers ----

/** Strings that indicate filler assistant preamble, not real actions */
const FILLER_PREFIXES = [
  "i'll ",
  "i will ",
  "let me ",
  "sure,",
  "sure!",
  "okay,",
  "okay!",
  "alright,",
  "alright!",
  "certainly",
  "of course",
  "got it",
  "understood",
  "no problem",
];

function isFillerText(text: string): boolean {
  const lower = text.toLowerCase().trimStart();
  return FILLER_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function truncateStr(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max).trimEnd() + "...";
}

function extractSnapshot(
  sessionId: string,
  projectName: string,
  model: string,
  firstPrompt: string,
  startTime: string,
  duration: number,
  estimatedCost: number,
  messageCount: number,
  messages: unknown[]
): Snapshot {
  const filesSet = new Set<string>();
  const commandsSet = new Set<string>();
  const keyActions: string[] = [];
  let toolCallsCount = 0;

  for (const msg of messages) {
    const m = msg as { type?: string; message?: { content?: ContentBlock[] } };
    if (m.type !== "assistant") continue;

    const content = (m as AssistantMessage).message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block.type === "tool_use") {
        const toolBlock = block as ToolUseBlock;
        toolCallsCount++;

        // Extract file paths from Write and Edit tool calls
        if (
          (toolBlock.name === "Write" || toolBlock.name === "Edit") &&
          toolBlock.input &&
          typeof toolBlock.input.file_path === "string"
        ) {
          filesSet.add(toolBlock.input.file_path);
        }

        // Extract commands from Bash tool calls
        if (
          toolBlock.name === "Bash" &&
          toolBlock.input &&
          typeof toolBlock.input.command === "string"
        ) {
          const cmd = truncateStr(toolBlock.input.command, 80);
          commandsSet.add(cmd);
        }
      }

      // Extract key actions from text blocks
      if (
        block.type === "text" &&
        keyActions.length < 3
      ) {
        const textBlock = block as TextBlock;
        const text = textBlock.text.trim();
        if (text.length > 50 && !isFillerText(text)) {
          keyActions.push(truncateStr(text, 120));
        }
      }
    }
  }

  // Take first 5 unique commands
  const commandsRun = Array.from(commandsSet).slice(0, 5);

  return {
    id: sessionId,
    projectName,
    model,
    firstPrompt,
    startTime,
    duration,
    estimatedCost,
    messageCount,
    filesModified: Array.from(filesSet),
    filesCount: filesSet.size,
    commandsRun,
    keyActions,
    toolCallsCount,
  };
}

// ---- GET Handler ----

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectFilter = searchParams.get("project") || undefined;
    const limit = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("limit") || "30", 10) || 30)
    );
    const offset = Math.max(
      0,
      parseInt(searchParams.get("offset") || "0", 10) || 0
    );

    // Get all sessions, sorted by startTime desc
    let allSessions = await listSessions();

    // Collect unique project names for the filter dropdown
    const projectsSet = new Set<string>();
    for (const s of allSessions) {
      projectsSet.add(s.projectName);
    }
    const projects = Array.from(projectsSet).sort();

    // Apply project filter
    if (projectFilter) {
      allSessions = allSessions.filter(
        (s) => s.projectName === projectFilter
      );
    }

    const total = allSessions.length;

    // Slice to the requested window (pre-snapshot-building to limit work)
    const windowSessions = allSessions.slice(offset, offset + limit);

    // Build snapshots for the windowed sessions
    const snapshots: Snapshot[] = [];

    for (const meta of windowSessions) {
      try {
        const detail = await getSession(meta.id);
        if (!detail) {
          // If full session can't be loaded, return a skeleton snapshot
          snapshots.push({
            id: meta.id,
            projectName: meta.projectName,
            model: meta.model,
            firstPrompt: meta.firstPrompt,
            startTime: meta.startTime,
            duration: meta.duration,
            estimatedCost: meta.estimatedCost,
            messageCount: meta.messageCount,
            filesModified: [],
            filesCount: 0,
            commandsRun: [],
            keyActions: [],
            toolCallsCount: 0,
          });
          continue;
        }

        snapshots.push(
          extractSnapshot(
            meta.id,
            meta.projectName,
            meta.model,
            meta.firstPrompt,
            meta.startTime,
            meta.duration,
            meta.estimatedCost,
            meta.messageCount,
            detail.messages
          )
        );
      } catch {
        // If a session fails to parse, skip it
        continue;
      }
    }

    return NextResponse.json({ snapshots, total, projects });
  } catch (error) {
    console.error("Failed to build snapshots:", error);
    return NextResponse.json(
      { error: "Failed to build snapshots" },
      { status: 500 }
    );
  }
}
