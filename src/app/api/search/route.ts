import { NextRequest, NextResponse } from "next/server";

import { listSessions, getSession } from "@/lib/claude/sessions";
import type {
  SessionMessage,
  ContentBlock,
  TextBlock,
  ThinkingBlock,
} from "@/lib/claude/types";

interface SearchResult {
  sessionId: string;
  projectName: string;
  model: string;
  startTime: string;
  firstPrompt: string;
  matchType: "user" | "assistant" | "thinking";
  snippet: string;
  matchIndex: number;
}

const MAX_RESULTS = 50;
const CONTEXT_CHARS = 80;

/**
 * Build a context snippet around a match, trimmed to word boundaries.
 * The matched term is wrapped in **bold** markers for the client to render.
 */
function buildSnippet(text: string, matchStart: number, queryLen: number): string {
  const before = Math.max(0, matchStart - CONTEXT_CHARS);
  const after = Math.min(text.length, matchStart + queryLen + CONTEXT_CHARS);

  let start = before;
  let end = after;

  // Trim to word boundary (forward for start, backward for end)
  if (start > 0) {
    const spaceIdx = text.indexOf(" ", start);
    if (spaceIdx !== -1 && spaceIdx < matchStart) {
      start = spaceIdx + 1;
    }
  }
  if (end < text.length) {
    const spaceIdx = text.lastIndexOf(" ", end);
    if (spaceIdx !== -1 && spaceIdx > matchStart + queryLen) {
      end = spaceIdx;
    }
  }

  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  // Reconstruct with the matched portion bolded
  const slice = text.slice(start, end);
  const matchInSlice = matchStart - start;
  const highlighted =
    slice.slice(0, matchInSlice) +
    "**" +
    slice.slice(matchInSlice, matchInSlice + queryLen) +
    "**" +
    slice.slice(matchInSlice + queryLen);

  return prefix + highlighted + suffix;
}

/**
 * Search a text for the query (case-insensitive) and push results.
 * Returns true if we've hit the result limit.
 */
function searchText(
  text: string,
  queryLower: string,
  matchType: "user" | "assistant" | "thinking",
  sessionId: string,
  projectName: string,
  model: string,
  startTime: string,
  firstPrompt: string,
  results: SearchResult[]
): boolean {
  const textLower = text.toLowerCase();
  let searchFrom = 0;

  while (results.length < MAX_RESULTS) {
    const idx = textLower.indexOf(queryLower, searchFrom);
    if (idx === -1) break;

    results.push({
      sessionId,
      projectName,
      model,
      startTime,
      firstPrompt,
      matchType,
      snippet: buildSnippet(text, idx, queryLower.length),
      matchIndex: results.length,
    });

    // Move past this match to find the next one in the same text
    searchFrom = idx + queryLower.length;
  }

  return results.length >= MAX_RESULTS;
}

function extractUserText(msg: SessionMessage): string | null {
  if (msg.type !== "user") return null;
  const content = msg.message.content;
  if (typeof content === "string") return content;
  // ContentBlock[] — extract text blocks
  return (content as ContentBlock[])
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ");
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim() === "") {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 }
    );
  }

  const queryLower = q.trim().toLowerCase();
  const results: SearchResult[] = [];

  try {
    // Sessions are already sorted most-recent-first
    const sessions = await listSessions();

    for (const meta of sessions) {
      if (results.length >= MAX_RESULTS) break;

      const detail = await getSession(meta.id);
      if (!detail) continue;

      for (const msg of detail.messages) {
        if (results.length >= MAX_RESULTS) break;

        if (msg.type === "user") {
          const text = extractUserText(msg);
          if (text) {
            const done = searchText(
              text,
              queryLower,
              "user",
              meta.id,
              meta.projectName,
              meta.model,
              meta.startTime,
              meta.firstPrompt,
              results
            );
            if (done) break;
          }
        } else if (msg.type === "assistant") {
          const blocks = msg.message.content;
          for (const block of blocks) {
            if (results.length >= MAX_RESULTS) break;

            if (block.type === "text") {
              const done = searchText(
                (block as TextBlock).text,
                queryLower,
                "assistant",
                meta.id,
                meta.projectName,
                meta.model,
                meta.startTime,
                meta.firstPrompt,
                results
              );
              if (done) break;
            } else if (block.type === "thinking") {
              const done = searchText(
                (block as ThinkingBlock).thinking,
                queryLower,
                "thinking",
                meta.id,
                meta.projectName,
                meta.model,
                meta.startTime,
                meta.firstPrompt,
                results
              );
              if (done) break;
            }
          }
        }
      }
    }

    return NextResponse.json({
      results,
      query: q.trim(),
      total: results.length,
    });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
