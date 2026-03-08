// ---- CLI Tool Type ----

export type CliTool = "claude" | "codex";

// ---- Session Events (discriminated union) ----

export type SessionEvent =
  | { type: "text_delta"; text: string; stream?: "output" | "thought" }
  | { type: "status"; text: string; phase?: string }
  | {
      type: "tool_call";
      name: string;
      status: "started" | "completed" | "error";
      toolCallId?: string;
    }
  | { type: "done"; exitCode: number | null; stopReason?: string }
  | { type: "error"; message: string; recoverable: boolean };

// ---- Session Handle ----

export interface SessionHandle {
  id: string;
  cli: CliTool;
  projectDir: string;
  model: string;
  startedAt: Date;
  lastAccessedAt: Date;
  idle: boolean;
}

// ---- Session Config ----

export interface SessionConfig {
  projectDir: string;
  model: string;
  prompt: string;
  skipPermissions?: boolean;
  remoteControl?: boolean;
  maxTurns?: number;
  systemPrompt?: string;
  additionalFlags?: string[];
}

// ---- Session Runtime ----

export interface SessionRuntime {
  cli: CliTool;
  ensureSession(config: SessionConfig): Promise<SessionHandle>;
  runTurn(
    handle: SessionHandle,
    prompt: string,
  ): AsyncIterable<SessionEvent>;
  cancel(handle: SessionHandle): Promise<void>;
  close(handle: SessionHandle): Promise<void>;
}
