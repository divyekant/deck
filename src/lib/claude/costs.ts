import type { ModelPricing, TokenUsage } from "./types";

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic models (Claude Code)
  "claude-opus-4-6": {
    input: 15,
    output: 75,
    cacheWrite: 18.75,
    cacheRead: 1.5,
  },
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  "claude-haiku-4-5": {
    input: 0.8,
    output: 4,
    cacheWrite: 1.0,
    cacheRead: 0.08,
  },
  // OpenAI models (Codex CLI)
  "gpt-4.1": {
    input: 2,
    output: 8,
    cacheWrite: 0,
    cacheRead: 0.5, // cached input pricing for OpenAI
  },
  "gpt-4.1-mini": {
    input: 0.4,
    output: 1.6,
    cacheWrite: 0,
    cacheRead: 0.1,
  },
  "gpt-4.1-nano": {
    input: 0.1,
    output: 0.4,
    cacheWrite: 0,
    cacheRead: 0.025,
  },
  "o3": {
    input: 2,
    output: 8,
    cacheWrite: 0,
    cacheRead: 0.5,
  },
  "o4-mini": {
    input: 1.1,
    output: 4.4,
    cacheWrite: 0,
    cacheRead: 0.275,
  },
  "codex-mini-latest": {
    input: 1.5,
    output: 6,
    cacheWrite: 0,
    cacheRead: 0.375,
  },
  // Codex model aliases (may appear with version suffixes)
  "gpt-5.2-codex": {
    input: 2,
    output: 8,
    cacheWrite: 0,
    cacheRead: 0.5,
  },
};

/**
 * Calculate cost in USD for a given model and token usage.
 * Falls back to opus pricing for unknown models.
 */
export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-opus-4-6"];

  const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
  const cacheWriteCost =
    (usage.cache_creation_input_tokens / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost =
    (usage.cache_read_input_tokens / 1_000_000) * pricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Format a cost in USD as "$X.XX" (always two decimal places).
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/**
 * Format a token count as a human-readable string: "1.2K", "3.4M", etc.
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}
