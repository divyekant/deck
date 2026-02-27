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
    source: 'claude-code',
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

// ---- Codex Session Parser ----

/**
 * Codex JSONL line types:
 * - session_meta: { payload: { id, timestamp, cwd, model_provider, cli_version } }
 * - response_item: { payload: { type: "message", role, content } }
 * - event_msg: { payload: { type: "user_message"|"agent_message"|"token_count"|"task_started"|"task_complete", ... } }
 * - turn_context: { payload: { model, cwd, ... } }
 * - (reasoning items with encrypted_content are skipped)
 */

interface CodexTokenUsageInfo {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}

/**
 * Parse a Codex session JSONL file into the same SessionDetail type used by Claude Code sessions.
 * Maps Codex-specific fields to the unified schema.
 */
export async function parseCodexSessionFile(
  filePath: string,
): Promise<SessionDetail> {
  const raw = await fs.readFile(filePath, "utf-8");
  const lines = raw.split("\n");

  // We store raw parsed lines as SessionMessage[] even though the schema differs.
  // The UI primarily uses meta; messages are kept for detail views.
  const messages: SessionMessage[] = [];

  let sessionId = "";
  let model = "";
  let firstPrompt = "";
  let startTime = "";
  let endTime = "";
  let cwd = "";
  let messageCount = 0;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let cachedInputTokens = 0;

  for (const line of lines) {
    const parsed = parseJsonlLine(line);
    if (!parsed) continue;

    const ts = parsed.timestamp as string | undefined;
    if (ts) {
      if (!startTime || ts < startTime) startTime = ts;
      if (!endTime || ts > endTime) endTime = ts;
    }

    const type = parsed.type as string;
    const payload = parsed.payload as Record<string, unknown> | undefined;

    if (type === "session_meta" && payload) {
      sessionId = (payload.id as string) || "";
      cwd = (payload.cwd as string) || "";
    }

    if (type === "turn_context" && payload) {
      const turnModel = payload.model as string | undefined;
      if (turnModel && !model) {
        model = turnModel;
      }
      if (!cwd && payload.cwd) {
        cwd = payload.cwd as string;
      }
    }

    if (type === "event_msg" && payload) {
      const eventType = payload.type as string;

      if (eventType === "user_message") {
        messageCount++;
        const userText = payload.message as string | undefined;
        if (!firstPrompt && userText) {
          firstPrompt = userText;
        }
        // Create a synthetic UserMessage for the messages array
        messages.push({
          type: "user",
          uuid: "",
          parentUuid: null,
          sessionId,
          timestamp: ts || "",
          message: {
            role: "user",
            content: userText || "",
          },
        } as unknown as SessionMessage);
      }

      if (eventType === "agent_message") {
        messageCount++;
        const agentText = payload.message as string | undefined;
        messages.push({
          type: "assistant",
          uuid: "",
          parentUuid: null,
          sessionId,
          timestamp: ts || "",
          message: {
            id: "",
            model,
            role: "assistant",
            type: "message",
            content: [{ type: "text", text: agentText || "" }],
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            },
          },
        } as unknown as SessionMessage);
      }

      if (eventType === "token_count") {
        const info = payload.info as Record<string, unknown> | null;
        if (info) {
          const totalUsageInfo = info.total_token_usage as CodexTokenUsageInfo | undefined;
          if (totalUsageInfo) {
            // total_token_usage is cumulative — use the last one we see as the final count
            totalInputTokens = totalUsageInfo.input_tokens || 0;
            totalOutputTokens = (totalUsageInfo.output_tokens || 0) + (totalUsageInfo.reasoning_output_tokens || 0);
            cachedInputTokens = totalUsageInfo.cached_input_tokens || 0;
          }
        }
      }
    }

    // response_item with type: "message" and role: "assistant" can have tool calls
    if (type === "response_item" && payload) {
      const itemType = payload.type as string;
      const role = payload.role as string | undefined;

      if (itemType === "message" && role === "assistant") {
        // Assistant response_items may contain tool_use in content
        const content = payload.content as unknown[] | undefined;
        if (content && Array.isArray(content)) {
          messages.push({
            type: "assistant",
            uuid: "",
            parentUuid: null,
            sessionId,
            timestamp: ts || "",
            message: {
              id: "",
              model,
              role: "assistant",
              type: "message",
              content,
              usage: {
                input_tokens: 0,
                output_tokens: 0,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
              },
            },
          } as unknown as SessionMessage);
        }
      }
    }
  }

  if (!sessionId) {
    // Derive from filename: rollout-YYYY-MM-DDTHH-MM-SS-UUID.jsonl
    const base = path.basename(filePath, ".jsonl");
    const uuidMatch = base.match(
      /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
    );
    sessionId = uuidMatch ? uuidMatch[1] : base;
  }

  // Derive project name from cwd
  const projectPath = cwd || "";
  const projectName = cwd ? path.basename(cwd) : "codex";

  // Calculate cost using our pricing table
  const tokenUsage: TokenUsage = {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: cachedInputTokens,
  };
  const estimatedCost = model ? calculateCost(model, tokenUsage) : 0;

  const startMs = startTime ? new Date(startTime).getTime() : 0;
  const endMs = endTime ? new Date(endTime).getTime() : 0;

  const meta: SessionMeta = {
    id: sessionId,
    source: 'codex',
    projectPath,
    projectName,
    model: model || "unknown",
    firstPrompt: firstPrompt.slice(0, 200),
    messageCount,
    totalInputTokens,
    totalOutputTokens,
    cacheCreationTokens: 0,
    cacheReadTokens: cachedInputTokens,
    estimatedCost,
    startTime: startTime || new Date(0).toISOString(),
    endTime: endTime || new Date(0).toISOString(),
    duration: endMs - startMs,
  };

  return { meta, messages };
}
