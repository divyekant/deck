import { promises as fs } from "fs";
import path from "path";

import { calculateCost } from "./costs";
import type {
  AssistantMessage,
  SessionDetail,
  SessionMessage,
  SessionMeta,
  TokenUsage,
  UserMessage,
} from "./types";

/**
 * Safely parse a single JSONL line. Returns null for malformed lines.
 */
export function parseJsonlLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Parse a JSONL session file into a SessionDetail with messages and computed metadata.
 */
export async function parseSessionFile(
  filePath: string,
  projectPath: string = "",
  projectName: string = ""
): Promise<SessionDetail> {
  const raw = await fs.readFile(filePath, "utf-8");
  const lines = raw.split("\n");

  const messages: SessionMessage[] = [];
  let sessionId = "";
  let model = "";
  let firstPrompt = "";
  let startTime = "";
  let endTime = "";
  let messageCount = 0;

  const totalUsage: TokenUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };

  // Track which models are used and how much cost each accrues
  const modelUsageMap = new Map<string, TokenUsage>();

  for (const line of lines) {
    const parsed = parseJsonlLine(line);
    if (!parsed) continue;

    const msg = parsed as unknown as SessionMessage;
    messages.push(msg);

    // Extract sessionId from the first message that has one
    if (!sessionId && "sessionId" in parsed && parsed.sessionId) {
      sessionId = parsed.sessionId as string;
    }

    // Track timestamps from all message types
    const ts = ("timestamp" in parsed ? parsed.timestamp : null) as
      | string
      | null;
    if (ts) {
      if (!startTime || ts < startTime) startTime = ts;
      if (!endTime || ts > endTime) endTime = ts;
    }

    // Process user messages
    if (parsed.type === "user") {
      messageCount++;
      const userMsg = parsed as unknown as UserMessage;
      // First user message with a plain string content is the "first prompt"
      if (
        !firstPrompt &&
        userMsg.message &&
        typeof userMsg.message.content === "string"
      ) {
        firstPrompt = userMsg.message.content;
      }
    }

    // Process assistant messages
    if (parsed.type === "assistant") {
      messageCount++;
      const assistantMsg = parsed as unknown as AssistantMessage;
      const msgModel = assistantMsg.message?.model;
      const usage = assistantMsg.message?.usage;

      // Capture the first real model (skip "<synthetic>" placeholder models)
      if (!model && msgModel && msgModel !== "<synthetic>") {
        model = msgModel;
      }

      // Aggregate token usage (skip zero-usage synthetic messages)
      if (usage && (usage.input_tokens > 0 || usage.output_tokens > 0)) {
        totalUsage.input_tokens += usage.input_tokens || 0;
        totalUsage.output_tokens += usage.output_tokens || 0;
        totalUsage.cache_creation_input_tokens +=
          usage.cache_creation_input_tokens || 0;
        totalUsage.cache_read_input_tokens +=
          usage.cache_read_input_tokens || 0;

        // Track per-model usage for cost calculation accuracy
        const effectiveModel = msgModel && msgModel !== "<synthetic>" ? msgModel : model;
        if (effectiveModel) {
          const existing = modelUsageMap.get(effectiveModel) ?? {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          };
          existing.input_tokens += usage.input_tokens || 0;
          existing.output_tokens += usage.output_tokens || 0;
          existing.cache_creation_input_tokens +=
            usage.cache_creation_input_tokens || 0;
          existing.cache_read_input_tokens +=
            usage.cache_read_input_tokens || 0;
          modelUsageMap.set(effectiveModel, existing);
        }
      }
    }
  }

  // If we didn't find a session ID from messages, derive from filename
  if (!sessionId) {
    sessionId = path.basename(filePath, ".jsonl");
  }

  // Calculate total cost across all models used in this session
  let estimatedCost = 0;
  if (modelUsageMap.size > 0) {
    for (const [m, u] of modelUsageMap) {
      estimatedCost += calculateCost(m, u);
    }
  } else if (model) {
    estimatedCost = calculateCost(model, totalUsage);
  }

  const startMs = startTime ? new Date(startTime).getTime() : 0;
  const endMs = endTime ? new Date(endTime).getTime() : 0;

  const meta: SessionMeta = {
    id: sessionId,
    projectPath,
    projectName,
    model: model || "unknown",
    firstPrompt: firstPrompt.slice(0, 200), // truncate long prompts
    messageCount,
    totalInputTokens: totalUsage.input_tokens,
    totalOutputTokens: totalUsage.output_tokens,
    cacheCreationTokens: totalUsage.cache_creation_input_tokens,
    cacheReadTokens: totalUsage.cache_read_input_tokens,
    estimatedCost,
    startTime: startTime || new Date(0).toISOString(),
    endTime: endTime || new Date(0).toISOString(),
    duration: endMs - startMs,
  };

  return { meta, messages };
}
