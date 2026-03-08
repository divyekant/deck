// Unified Runtime API — drop-in replacement for process.ts
// API routes should import from here instead of process.ts.

import { SessionStore } from "./session-store";
import { ClaudeRuntime } from "./claude-runtime";
import { CodexRuntime } from "./codex-runtime";
import type {
  CliTool,
  SessionConfig,
  SessionEvent,
  SessionHandle,
  SessionRuntime,
} from "./types";

// Re-export types for consumers
export type { SessionConfig, SessionEvent, SessionHandle, CliTool } from "./types";

// Singleton instances
const store = new SessionStore();
const claudeRuntime = new ClaudeRuntime();
const codexRuntime = new CodexRuntime();

// ---- Helpers ----

function getRuntimeForCli(cli: CliTool): SessionRuntime {
  switch (cli) {
    case "codex":
      return codexRuntime;
    case "claude":
    default:
      return claudeRuntime;
  }
}

// ---- Public API ----

/**
 * Create a new session using the specified CLI tool (defaults to "claude").
 * Registers the session handle in the store on success.
 */
export async function createSession(
  opts: SessionConfig & { cli?: CliTool },
): Promise<{ id: string; error?: string }> {
  const cli = opts.cli || "claude";
  const runtime = getRuntimeForCli(cli);

  try {
    const handle = await runtime.ensureSession(opts);
    store.register(handle, runtime);
    return { id: handle.id };
  } catch (err) {
    return {
      id: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send a follow-up turn to an existing session.
 * Returns an async iterable of SessionEvents.
 * If the session is not found, yields a single error event.
 */
export function sendTurn(
  id: string,
  prompt: string,
): AsyncIterable<SessionEvent> {
  const entry = store.get(id);

  if (!entry) {
    async function* errorStream(): AsyncGenerator<SessionEvent> {
      yield {
        type: "error",
        message: `Session not found: ${id}`,
        recoverable: false,
      };
    }
    return errorStream();
  }

  return entry.runtime.runTurn(entry.handle, prompt) as AsyncIterable<SessionEvent>;
}

/**
 * Cancel a running session. Kills the process and removes from the store.
 * Returns true if the session was found and cancelled, false otherwise.
 */
export async function cancelSession(id: string): Promise<boolean> {
  const entry = store.get(id);
  if (!entry) return false;

  await entry.runtime.cancel(entry.handle);
  store.remove(id);
  return true;
}

/**
 * Get the SessionHandle for an active session, or undefined if not found.
 */
export function getActiveSession(id: string): SessionHandle | undefined {
  const entry = store.get(id);
  return entry?.handle;
}

/**
 * List all active sessions as summary objects.
 */
export function listActiveSessions(): {
  id: string;
  projectDir: string;
  model: string;
  startedAt: Date;
  cli: CliTool;
}[] {
  return store.list().map((entry) => ({
    id: entry.handle.id,
    projectDir: entry.handle.projectDir,
    model: entry.handle.model,
    startedAt: entry.handle.startedAt,
    cli: entry.handle.cli,
  }));
}

/**
 * Get the underlying ProcessEntry for SSE compatibility.
 * Delegates to the runtime's getProcessEntry if available.
 */
export function getProcessEntry(id: string) {
  const entry = store.get(id);
  if (!entry) return undefined;

  // ClaudeRuntime exposes getProcessEntry; CodexRuntime may not
  const runtime = entry.runtime as SessionRuntime & {
    getProcessEntry?: (id: string) => unknown;
  };

  if (typeof runtime.getProcessEntry === "function") {
    return runtime.getProcessEntry(id);
  }

  return undefined;
}
