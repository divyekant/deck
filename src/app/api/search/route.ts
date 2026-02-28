import { NextRequest, NextResponse } from "next/server";

import { listSessions, getSession } from "@/lib/claude/sessions";
import type {
  SessionMessage,
  ContentBlock,
  TextBlock,
  ThinkingBlock,
} from "@/lib/claude/types";

interface MatchInfo {
  messageIndex: number;
  snippet: string;
  role: "human" | "assistant" | "thinking";
}

interface SessionSearchResult {
  sessionId: string;
  project: string;
  firstPrompt: string;
  matchCount: number;
  matches: MatchInfo[];
}

const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_SESSIONS = 50;
const MAX_MAX_SESSIONS = 200;
const CONTEXT_CHARS = 100;

/**
 * Build a context snippet around a match, with ~100 chars of context on each side.
 * The matched term is wrapped in **bold** markers for the client to render.
 */
function buildSnippet(text: string, matchStart: number, queryLen: number): string {
  const before = Math.max(0, matchStart - CONTEXT_CHARS);
  const after = Math.min(text.length, matchStart + queryLen + CONTEXT_CHARS);

  let start = before;
  let end = after;

  // Trim to word boundary
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
 * Search a text for the query (case-insensitive) and return the first match snippet.
 * We return at most one snippet per message to keep results meaningful.
 */
function findFirstMatch(
  text: string,
  queryLower: string,
): { snippet: string; count: number } | null {
  const textLower = text.toLowerCase();
  const idx = textLower.indexOf(queryLower);
  if (idx === -1) return null;

  // Count all occurrences in this text
  let count = 0;
  let searchFrom = 0;
  while (true) {
    const found = textLower.indexOf(queryLower, searchFrom);
    if (found === -1) break;
    count++;
    searchFrom = found + queryLower.length;
  }

  return {
    snippet: buildSnippet(text, idx, queryLower.length),
    count,
  };
}

function extractUserText(msg: SessionMessage): string | null {
  if (msg.type !== "user") return null;
  const content = msg.message.content;
  if (typeof content === "string") return content;
  return (content as ContentBlock[])
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ");
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q");
  const limit = Math.max(1, Math.min(100, parseInt(params.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const offset = Math.max(0, parseInt(params.get("offset") || "0", 10) || 0);
  const maxSessions = Math.max(1, Math.min(MAX_MAX_SESSIONS, parseInt(params.get("maxSessions") || String(DEFAULT_MAX_SESSIONS), 10) || DEFAULT_MAX_SESSIONS));

  if (!q || q.trim() === "") {
    return NextResponse.json(
      { error: "Missing required query parameter: q" },
      { status: 400 }
    );
  }

  const queryLower = q.trim().toLowerCase();

  try {
    // Sessions are already sorted most-recent-first — cap to avoid unbounded memory
    const allSessions = await listSessions();
    const sessions = allSessions.slice(0, maxSessions);

    // Collect all session-level results first so we can count total
    const allSessionResults: SessionSearchResult[] = [];

    for (const meta of sessions) {
      const detail = await getSession(meta.id);
      if (!detail) continue;

      const matches: MatchInfo[] = [];
      let sessionMatchCount = 0;

      for (let msgIdx = 0; msgIdx < detail.messages.length; msgIdx++) {
        const msg = detail.messages[msgIdx];

        if (msg.type === "user") {
          const text = extractUserText(msg);
          if (text) {
            const result = findFirstMatch(text, queryLower);
            if (result) {
              sessionMatchCount += result.count;
              matches.push({
                messageIndex: msgIdx,
                snippet: result.snippet,
                role: "human",
              });
            }
          }
        } else if (msg.type === "assistant") {
          const blocks = msg.message.content;
          let foundInMessage = false;

          for (const block of blocks) {
            if (foundInMessage) break;

            if (block.type === "text") {
              const result = findFirstMatch((block as TextBlock).text, queryLower);
              if (result) {
                sessionMatchCount += result.count;
                if (!foundInMessage) {
                  matches.push({
                    messageIndex: msgIdx,
                    snippet: result.snippet,
                    role: "assistant",
                  });
                  foundInMessage = true;
                }
              }
            } else if (block.type === "thinking") {
              const result = findFirstMatch((block as ThinkingBlock).thinking, queryLower);
              if (result) {
                sessionMatchCount += result.count;
                if (!foundInMessage) {
                  matches.push({
                    messageIndex: msgIdx,
                    snippet: result.snippet,
                    role: "thinking",
                  });
                  foundInMessage = true;
                }
              }
            }
          }
        }
      }

      if (matches.length > 0) {
        allSessionResults.push({
          sessionId: meta.id,
          project: meta.projectName,
          firstPrompt: meta.firstPrompt,
          matchCount: sessionMatchCount,
          matches: matches.slice(0, 5), // Cap snippets per session
        });
      }
    }

    const total = allSessionResults.length;
    const paged = allSessionResults.slice(offset, offset + limit);

    return NextResponse.json({
      results: paged,
      total,
      query: q.trim(),
    });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
