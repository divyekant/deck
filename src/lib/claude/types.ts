// ---- Token & Cost Types ----

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface ModelPricing {
  input: number;       // cost per 1M input tokens
  output: number;      // cost per 1M output tokens
  cacheWrite: number;  // cost per 1M cache creation tokens
  cacheRead: number;   // cost per 1M cache read tokens
}

// ---- JSONL Message Types ----

export interface BaseMessage {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  isSidechain?: boolean;
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | unknown[];
}

export type ContentBlock = ThinkingBlock | TextBlock | ToolUseBlock | ToolResultBlock;

export interface UserMessage extends BaseMessage {
  type: "user";
  message: {
    role: "user";
    content: string | ContentBlock[];
  };
}

export interface AssistantMessage extends BaseMessage {
  type: "assistant";
  message: {
    id: string;
    model: string;
    role: "assistant";
    type: "message";
    content: ContentBlock[];
    usage: TokenUsage & {
      server_tool_use?: Record<string, unknown>;
      service_tier?: string | null;
      cache_creation?: Record<string, number>;
      inference_geo?: string | null;
      iterations?: number | null;
      speed?: number | null;
    };
    stop_reason?: string;
    stop_sequence?: string;
    container?: string | null;
    context_management?: unknown;
  };
  slug?: string;
  error?: string;
  isApiErrorMessage?: boolean;
}

export interface ProgressMessage extends BaseMessage {
  type: "progress";
  data: {
    type: string;
    [key: string]: unknown;
  };
}

export interface QueueOperationMessage {
  type: "queue-operation";
  operation: string;
  timestamp: string;
  sessionId: string;
  content?: string;
}

export interface FileHistorySnapshotMessage {
  type: "file-history-snapshot";
  messageId: string;
  snapshot: {
    messageId: string;
    trackedFileBackups: Record<string, unknown>;
    timestamp: string;
  };
  isSnapshotUpdate: boolean;
}

export interface SystemMessage extends BaseMessage {
  type: "system";
  message?: {
    role: "system";
    content: string;
  };
  [key: string]: unknown;
}

export type SessionMessage =
  | UserMessage
  | AssistantMessage
  | ProgressMessage
  | QueueOperationMessage
  | FileHistorySnapshotMessage
  | SystemMessage;

// ---- Session Types ----

export interface SessionMeta {
  id: string;
  projectPath: string;
  projectName: string;
  model: string;
  firstPrompt: string;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  estimatedCost: number;
  startTime: string;
  endTime: string;
  duration: number; // milliseconds
}

export interface SessionDetail {
  meta: SessionMeta;
  messages: SessionMessage[];
}

// ---- Dashboard / Stats Types ----

export interface DailyActivity {
  date: string;         // YYYY-MM-DD
  sessionCount: number;
  cost: number;
}

export interface ModelCostBreakdown {
  model: string;
  totalCost: number;
  sessionCount: number;
}

export interface OverviewStats {
  totalSessions: number;
  totalCost: number;
  modelBreakdown: ModelCostBreakdown[];
  dailyActivity: DailyActivity[];
  recentSessions: SessionMeta[];
}
