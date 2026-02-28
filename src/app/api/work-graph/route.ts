import { NextResponse } from "next/server";

import { listSessions, getSession } from "@/lib/claude/sessions";
import { getProjectColor } from "@/lib/project-colors";
import type { AssistantMessage, ToolUseBlock } from "@/lib/claude/types";

// ---- Types ----

interface GraphNode {
  id: string;
  type: "project" | "session" | "file";
  label: string;
  color?: string;
  cost?: number;
  date?: string;
  project?: string;
  firstPrompt?: string;
  messageCount?: number;
  action?: string;
  changeCount?: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

// ---- Color name to hex mapping ----

const COLOR_HEX: Record<string, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  cyan: "#06b6d4",
  orange: "#f97316",
  pink: "#ec4899",
  lime: "#84cc16",
  indigo: "#6366f1",
};

// ---- File extraction (reused from diffs route) ----

function extractFileChanges(
  toolName: string,
  input: Record<string, unknown>
): { path: string; action: "created" | "edited" } | null {
  const nameLower = toolName.toLowerCase();

  if (nameLower === "write") {
    const filePath = input.file_path;
    if (typeof filePath === "string" && filePath) {
      return { path: filePath, action: "created" };
    }
  }

  if (nameLower === "edit") {
    const filePath = input.file_path;
    if (typeof filePath === "string" && filePath) {
      return { path: filePath, action: "edited" };
    }
  }

  // Skip bash commands for the graph — only Write/Edit are reliable file nodes
  return null;
}

// ---- GET handler ----

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") ?? "30", 10);
    const validDays = [7, 30, 90].includes(days) ? days : 30;

    // 1. Fetch all sessions and filter to date range
    const allSessions = await listSessions();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - validDays);

    const filteredSessions = allSessions.filter(
      (s) => new Date(s.startTime) >= cutoff
    );

    // Limit to most recent 50
    const sessions = filteredSessions.slice(0, 50);

    // 2. Build nodes and edges
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const projectSet = new Map<string, string>(); // projectName -> hex color
    const fileMap = new Map<
      string,
      { action: string; count: number; sessions: Set<string> }
    >(); // filePath -> data

    // Add project nodes (discover from sessions)
    for (const s of sessions) {
      if (!projectSet.has(s.projectName)) {
        const color = getProjectColor(s.projectName);
        const hex = COLOR_HEX[color.name] ?? "#71717a";
        projectSet.set(s.projectName, hex);
        nodes.push({
          id: `project:${s.projectName}`,
          type: "project",
          label: s.projectName,
          color: hex,
        });
      }
    }

    // Process each session: add session node, extract file changes
    for (const s of sessions) {
      const hex = projectSet.get(s.projectName) ?? "#71717a";

      // Add session node
      nodes.push({
        id: `session:${s.id}`,
        type: "session",
        label: s.firstPrompt
          ? s.firstPrompt.slice(0, 60) + (s.firstPrompt.length > 60 ? "..." : "")
          : s.id.slice(0, 8),
        color: hex,
        cost: s.estimatedCost,
        date: s.startTime,
        project: s.projectName,
        firstPrompt: s.firstPrompt,
        messageCount: s.messageCount,
      });

      // Edge: session -> project
      edges.push({
        source: `session:${s.id}`,
        target: `project:${s.projectName}`,
      });

      // Fetch session detail for file diffs
      try {
        const detail = await getSession(s.id);
        if (!detail) continue;

        for (const msg of detail.messages) {
          if (msg.type !== "assistant") continue;

          const assistantMsg = msg as AssistantMessage;
          const content = assistantMsg.message?.content;
          if (!Array.isArray(content)) continue;

          for (const block of content) {
            if (block.type !== "tool_use") continue;

            const toolBlock = block as ToolUseBlock;
            const change = extractFileChanges(toolBlock.name, toolBlock.input);
            if (!change) continue;

            const existing = fileMap.get(change.path);
            if (existing) {
              existing.count += 1;
              existing.sessions.add(s.id);
            } else {
              fileMap.set(change.path, {
                action: change.action,
                count: 1,
                sessions: new Set([s.id]),
              });
            }
          }
        }
      } catch {
        // Skip sessions that fail to parse
        continue;
      }
    }

    // 3. Add file nodes and edges (session -> file)
    for (const [filePath, data] of fileMap.entries()) {
      const fileId = `file:${filePath}`;
      const fileName = filePath.split("/").pop() ?? filePath;

      nodes.push({
        id: fileId,
        type: "file",
        label: fileName,
        action: data.action,
        changeCount: data.count,
      });

      // Connect each session that touched this file
      for (const sessionId of data.sessions) {
        edges.push({
          source: `session:${sessionId}`,
          target: fileId,
        });
      }
    }

    // 4. Stats
    const stats = {
      projectCount: projectSet.size,
      sessionCount: sessions.length,
      fileCount: fileMap.size,
    };

    return NextResponse.json({ nodes, edges, stats });
  } catch (error) {
    console.error("Failed to build work graph:", error);
    return NextResponse.json(
      { error: "Failed to build work graph" },
      { status: 500 }
    );
  }
}
