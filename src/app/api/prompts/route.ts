import { NextRequest, NextResponse } from "next/server";

import { listSessions } from "@/lib/claude/sessions";

type PromptCategory =
  | "bug-fix"
  | "feature"
  | "refactor"
  | "testing"
  | "review"
  | "exploration"
  | "general";

interface PromptEntry {
  text: string;
  useCount: number;
  projects: string[];
  models: string[];
  avgCost: number;
  avgDuration: number;
  totalCost: number;
  lastUsed: string;
  category: PromptCategory;
}

function inferCategory(text: string): PromptCategory {
  const lower = text.toLowerCase();
  if (/\b(fix|bug|error|issue)\b/.test(lower)) return "bug-fix";
  if (/\b(add|create|implement|build)\b/.test(lower)) return "feature";
  if (/\b(refactor|clean|reorganize)\b/.test(lower)) return "refactor";
  if (/\b(test|spec)\b/.test(lower)) return "testing";
  if (/\b(review|check|look at)\b/.test(lower)) return "review";
  if (/\b(explain|how|what|why)\b/.test(lower)) return "exploration";
  return "general";
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sort = searchParams.get("sort") || "recent";
    const categoryFilter = searchParams.get("category") || "";

    const sessions = await listSessions();

    // Group by normalized prompt text (trimmed, lowercased)
    const promptMap = new Map<
      string,
      {
        originalText: string;
        projects: Set<string>;
        models: Set<string>;
        costs: number[];
        durations: number[];
        lastUsed: string;
      }
    >();

    for (const session of sessions) {
      const prompt = session.firstPrompt;
      if (!prompt || !prompt.trim()) continue;

      const key = prompt.trim().toLowerCase();
      const existing = promptMap.get(key);

      if (existing) {
        existing.projects.add(session.projectName);
        existing.models.add(session.model);
        existing.costs.push(session.estimatedCost);
        existing.durations.push(session.duration);
        if (session.startTime > existing.lastUsed) {
          existing.lastUsed = session.startTime;
        }
      } else {
        promptMap.set(key, {
          originalText: prompt.trim(),
          projects: new Set([session.projectName]),
          models: new Set([session.model]),
          costs: [session.estimatedCost],
          durations: [session.duration],
          lastUsed: session.startTime,
        });
      }
    }

    // Build prompt entries
    let prompts: PromptEntry[] = Array.from(promptMap.values()).map((data) => {
      const totalCost = data.costs.reduce((a, b) => a + b, 0);
      const totalDuration = data.durations.reduce((a, b) => a + b, 0);
      const useCount = data.costs.length;

      return {
        text: data.originalText,
        useCount,
        projects: Array.from(data.projects).sort(),
        models: Array.from(data.models).sort(),
        avgCost: totalCost / useCount,
        avgDuration: totalDuration / useCount,
        totalCost,
        lastUsed: data.lastUsed,
        category: inferCategory(data.originalText),
      };
    });

    // Filter by category if provided
    if (categoryFilter) {
      prompts = prompts.filter((p) => p.category === categoryFilter);
    }

    // Sort
    switch (sort) {
      case "cost":
        prompts.sort((a, b) => a.avgCost - b.avgCost);
        break;
      case "used":
        prompts.sort((a, b) => b.useCount - a.useCount);
        break;
      case "recent":
      default:
        prompts.sort(
          (a, b) =>
            new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
        );
        break;
    }

    // Collect all categories present
    const categories = Array.from(
      new Set(prompts.map((p) => p.category))
    ).sort();

    return NextResponse.json({
      prompts,
      categories,
      total: prompts.length,
    });
  } catch (error) {
    console.error("Failed to build prompt library:", error);
    return NextResponse.json(
      { error: "Failed to build prompt library" },
      { status: 500 }
    );
  }
}
