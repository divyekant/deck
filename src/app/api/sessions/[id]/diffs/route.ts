import { NextResponse } from "next/server";

import { getSession } from "@/lib/claude/sessions";
import type { AssistantMessage, ToolUseBlock } from "@/lib/claude/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FileDiff {
  path: string;
  action: "created" | "edited" | "modified";
  count: number;
}

/** Bash commands that commonly modify the filesystem */
const MODIFYING_PATTERNS = /(?:^|\s|&&|\|\||;)\s*(?:>|>>|mv\s|rm\s|cp\s|mkdir\s)/;

function extractFileChanges(
  toolName: string,
  input: Record<string, unknown>
): { path: string; action: "created" | "edited" | "modified" } | null {
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

  if (nameLower === "bash") {
    const command = input.command;
    if (typeof command === "string" && MODIFYING_PATTERNS.test(command)) {
      // Best-effort: use the command itself as a pseudo-path since
      // we can't reliably extract the target file from arbitrary shell
      return { path: `[bash] ${command.slice(0, 120)}`, action: "modified" };
    }
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const session = await getSession(id);

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Track files: path -> { action (first touch), count }
    const fileMap = new Map<
      string,
      { action: "created" | "edited" | "modified"; count: number }
    >();

    for (const msg of session.messages) {
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
        } else {
          fileMap.set(change.path, {
            action: change.action,
            count: 1,
          });
        }
      }
    }

    const files: FileDiff[] = Array.from(fileMap.entries())
      .map(([path, data]) => ({
        path,
        action: data.action,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);

    const totalChanges = files.reduce((sum, f) => sum + f.count, 0);

    return NextResponse.json({
      sessionId: id,
      files,
      totalChanges,
    });
  } catch (error) {
    console.error("Failed to compute diffs:", error);
    return NextResponse.json(
      { error: "Failed to compute diffs" },
      { status: 500 }
    );
  }
}
