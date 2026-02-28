import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getRunningSessionsList } from "@/lib/claude/process";
import { getProjectDirs, CLAUDE_DIR } from "@/lib/claude/sessions";
import { parseJsonlLine } from "@/lib/claude/parser";

const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const RECENTLY_ACTIVE_THRESHOLD_MS = 600_000; // 10 minutes

interface RunningSessionEntry {
  id: string;
  projectDir: string;
  model: string;
  prompt: string;
  startedAt: string;
  source: "deck" | "heuristic";
}

/**
 * Scan JSONL files across all project dirs and return sessions whose files
 * were modified within the last 2 minutes — a heuristic for "likely running".
 */
async function detectRecentlyActiveSessions(): Promise<RunningSessionEntry[]> {
  const results: RunningSessionEntry[] = [];
  const now = Date.now();
  const projects = await getProjectDirs();

  for (const project of projects) {
    const fullDir = path.join(PROJECTS_DIR, project.dirName);
    let entries;
    try {
      entries = await fs.readdir(fullDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (
        !entry.isFile() ||
        !entry.name.endsWith(".jsonl") ||
        entry.name === "history.jsonl"
      ) {
        continue;
      }

      const filePath = path.join(fullDir, entry.name);
      let stat;
      try {
        stat = await fs.stat(filePath);
      } catch {
        continue;
      }

      if (now - stat.mtimeMs > RECENTLY_ACTIVE_THRESHOLD_MS) {
        continue;
      }

      // This file was modified recently — parse minimal info
      const sessionId = entry.name.replace(/\.jsonl$/, "");

      let model = "";
      let prompt = "";
      let startedAt = "";

      try {
        // Read first few KB to get session start info
        const fd = await fs.open(filePath, "r");
        const buf = Buffer.alloc(4096);
        await fd.read(buf, 0, 4096, 0);
        await fd.close();
        const head = buf.toString("utf-8");
        const headLines = head.split("\n");

        for (const line of headLines) {
          const parsed = parseJsonlLine(line);
          if (!parsed) continue;

          // Extract model from first assistant message or system init
          if (!model && typeof parsed.model === "string") {
            model = parsed.model;
          }
          if (
            !model &&
            parsed.type === "assistant" &&
            typeof (parsed as Record<string, unknown>).message === "object"
          ) {
            const msg = (parsed as Record<string, unknown>).message as Record<
              string,
              unknown
            >;
            if (typeof msg.model === "string") {
              model = msg.model;
            }
          }

          // Extract first user prompt
          if (
            !prompt &&
            parsed.type === "user" &&
            typeof (parsed as Record<string, unknown>).message === "object"
          ) {
            const msg = (parsed as Record<string, unknown>).message as Record<
              string,
              unknown
            >;
            if (typeof msg.content === "string") {
              prompt = msg.content.slice(0, 200);
            } else if (Array.isArray(msg.content)) {
              const textBlock = (
                msg.content as { type: string; text?: string }[]
              ).find((b) => b.type === "text");
              if (textBlock?.text) {
                prompt = textBlock.text.slice(0, 200);
              }
            }
          }

          // Extract timestamp from first message
          if (!startedAt && typeof parsed.timestamp === "string") {
            startedAt = parsed.timestamp;
          }

          if (model && prompt && startedAt) break;
        }
      } catch {
        // If we can't parse, still include with minimal info
      }

      // Fallback startedAt to file birthtime
      if (!startedAt) {
        startedAt = stat.birthtime.toISOString();
      }

      results.push({
        id: sessionId,
        projectDir: project.path,
        model: model || "unknown",
        prompt: prompt || "",
        startedAt,
        source: "heuristic",
      });
    }
  }

  return results;
}

export async function GET() {
  try {
    // Get Deck-spawned sessions
    const deckSessions = getRunningSessionsList();
    const deckIds = new Set(deckSessions.map((s) => s.id));

    const merged: RunningSessionEntry[] = deckSessions.map((s) => ({
      id: s.id,
      projectDir: s.projectDir,
      model: s.model,
      prompt: s.prompt,
      startedAt:
        s.startedAt instanceof Date
          ? s.startedAt.toISOString()
          : String(s.startedAt),
      source: "deck" as const,
    }));

    // Detect heuristic sessions and deduplicate
    const heuristicSessions = await detectRecentlyActiveSessions();
    for (const hs of heuristicSessions) {
      if (!deckIds.has(hs.id)) {
        merged.push(hs);
      }
    }

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Failed to list running sessions:", error);
    return NextResponse.json(
      { error: "Failed to list running sessions" },
      { status: 500 }
    );
  }
}
