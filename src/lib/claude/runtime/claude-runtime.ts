import { spawn, execSync } from "child_process";
import type { ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import { getAuthEnv } from "@/lib/auth";
import type {
  CliTool,
  SessionConfig,
  SessionEvent,
  SessionHandle,
  SessionRuntime,
} from "./types";

// ---- Internal state ----

export interface ProcessEntry {
  process: ChildProcess;
  output: string[];
  listeners: Set<(line: string) => void>;
  exitListeners: Set<(code: number | null) => void>;
}

// ---- PATH helper ----

function getCliPath(): string {
  const base = process.env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin";
  const extras = [
    `${process.env.HOME}/.nvm/versions/node/v24.12.0/bin`,
    `${process.env.HOME}/.orbstack/bin`,
    `${process.env.HOME}/homebrew/bin`,
    `${process.env.HOME}/.local/bin`,
    "/usr/local/bin",
    "/opt/homebrew/bin",
  ];
  const parts = new Set(base.split(":"));
  for (const p of extras) parts.add(p);
  return Array.from(parts).join(":");
}

const CLI_PATH = getCliPath();

function isCliAvailable(binary: string): boolean {
  try {
    execSync(`which ${binary}`, {
      env: { ...process.env, PATH: CLI_PATH },
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

// ---- Event translation ----

function translateLine(raw: string): SessionEvent | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  // Result event → done
  if (parsed.type === "result") {
    return {
      type: "done",
      exitCode: null,
      stopReason: "turn_complete",
    };
  }

  // Error event from stderr wrapping
  if (parsed.type === "error" && typeof parsed.error === "string") {
    return {
      type: "error",
      message: parsed.error,
      recoverable: true,
    };
  }

  // Assistant messages with content blocks
  if (parsed.type === "assistant" && parsed.message) {
    const message = parsed.message as { content?: unknown[] };
    const content = message.content;
    if (!Array.isArray(content) || content.length === 0) return null;

    const block = content[0] as Record<string, unknown>;

    switch (block.type) {
      case "text":
        return {
          type: "text_delta",
          text: (block.text as string) || "",
          stream: "output",
        };

      case "thinking":
        return {
          type: "text_delta",
          text: (block.thinking as string) || "",
          stream: "thought",
        };

      case "tool_use":
        return {
          type: "tool_call",
          name: (block.name as string) || "",
          status: "started",
          toolCallId: (block.id as string) || undefined,
        };

      case "tool_result":
        return {
          type: "tool_call",
          name: "tool_result",
          status: "completed",
          toolCallId: (block.tool_use_id as string) || undefined,
        };

      default:
        return null;
    }
  }

  return null;
}

// ---- ClaudeRuntime ----

export class ClaudeRuntime implements SessionRuntime {
  readonly cli: CliTool = "claude";
  private readonly processes = new Map<string, ProcessEntry>();

  async ensureSession(config: SessionConfig): Promise<SessionHandle> {
    if (!isCliAvailable("claude")) {
      throw new Error(
        "'claude' CLI not found in PATH. Make sure Claude Code is installed and accessible.",
      );
    }

    const id = randomUUID();

    // Auth env
    const authEnv = await getAuthEnv();

    // Build clean env
    const { CLAUDECODE: _cc, ...cleanEnv } = process.env;
    if (authEnv.ANTHROPIC_AUTH_TOKEN) {
      delete cleanEnv.ANTHROPIC_API_KEY;
    }
    const spawnEnv = { ...cleanEnv, PATH: CLI_PATH, ...authEnv };

    // Build args
    const args = [
      "-p",
      "--verbose",
      "--output-format=stream-json",
      "--include-partial-messages",
      "--model",
      config.model,
      "--session-id",
      id,
    ];

    if (config.skipPermissions) args.push("--dangerously-skip-permissions");
    if (config.remoteControl) args.push("--enable-remote-control");
    if (config.maxTurns) args.push("--max-turns", String(config.maxTurns));
    if (config.systemPrompt) args.push("--system-prompt", config.systemPrompt);
    if (config.additionalFlags) args.push(...config.additionalFlags);

    const proc = spawn("claude", args, {
      cwd: config.projectDir || undefined,
      stdio: ["pipe", "pipe", "pipe"],
      env: spawnEnv,
    });

    const entry: ProcessEntry = {
      process: proc,
      output: [],
      listeners: new Set(),
      exitListeners: new Set(),
    };

    this.processes.set(id, entry);

    // Wire stdout line buffering
    this.wireStdout(id, proc, entry);

    // Wire stderr
    this.wireStderr(proc, entry);

    // Wire close/error events
    this.wireProcessEvents(id, proc, entry);

    // Write initial prompt to stdin BUT LEAVE STDIN OPEN (persistent mode)
    if (proc.stdin && config.prompt) {
      proc.stdin.write(config.prompt + "\n");
      // DO NOT call proc.stdin.end() — persistent mode
    }

    const now = new Date();
    const handle: SessionHandle = {
      id,
      cli: "claude",
      projectDir: config.projectDir,
      model: config.model,
      startedAt: now,
      lastAccessedAt: now,
      idle: false,
    };

    return handle;
  }

  runTurn(handle: SessionHandle, prompt: string): AsyncIterable<SessionEvent> {
    const entry = this.processes.get(handle.id);
    if (!entry) {
      throw new Error(`No process entry found for session ${handle.id}`);
    }

    handle.idle = false;
    handle.lastAccessedAt = new Date();

    const proc = entry.process;
    const stdinAlive =
      proc.stdin && !proc.stdin.destroyed && proc.stdin.writable;

    if (stdinAlive) {
      // Persistent mode: write to existing stdin
      proc.stdin!.write(prompt + "\n");
    } else {
      // Fallback: respawn with --resume
      this.respawnForResume(handle, entry, prompt);
    }

    return this.createEventStream(handle, entry);
  }

  async cancel(handle: SessionHandle): Promise<void> {
    const entry = this.processes.get(handle.id);
    if (!entry) return;

    entry.process.kill("SIGTERM");

    // Force kill after 5 seconds
    setTimeout(() => {
      try {
        entry.process.kill("SIGKILL");
      } catch {
        // Process may already be dead
      }
    }, 5000);
  }

  async close(handle: SessionHandle): Promise<void> {
    const entry = this.processes.get(handle.id);
    if (!entry) return;

    // Close stdin (sends EOF)
    if (entry.process.stdin && !entry.process.stdin.destroyed) {
      entry.process.stdin.end();
    }

    // Wait up to 3 seconds for graceful exit
    const graceful = await Promise.race([
      new Promise<boolean>((resolve) => {
        entry.process.on("close", () => resolve(true));
      }),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 3000);
      }),
    ]);

    if (!graceful) {
      entry.process.kill("SIGTERM");
    }

    this.processes.delete(handle.id);
  }

  getProcessEntry(id: string): ProcessEntry | undefined {
    return this.processes.get(id);
  }

  // ---- Private helpers ----

  private wireStdout(
    _id: string,
    proc: ChildProcess,
    entry: ProcessEntry,
  ): void {
    let buffer = "";
    proc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) {
          entry.output.push(trimmed);
          for (const listener of entry.listeners) {
            listener(trimmed);
          }
        }
      }
    });
  }

  private wireStderr(proc: ChildProcess, entry: ProcessEntry): void {
    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        const errorLine = JSON.stringify({ type: "error", error: text });
        entry.output.push(errorLine);
        for (const listener of entry.listeners) {
          listener(errorLine);
        }
      }
    });
  }

  private wireProcessEvents(
    id: string,
    proc: ChildProcess,
    entry: ProcessEntry,
  ): void {
    proc.on("close", (code) => {
      for (const exitListener of entry.exitListeners) {
        exitListener(code);
      }
      entry.exitListeners.clear();

      // Remove from internal map after 5 minutes
      setTimeout(() => {
        this.processes.delete(id);
      }, 5 * 60 * 1000);
    });

    proc.on("error", (err) => {
      const errorLine = JSON.stringify({
        type: "error",
        error: `Process error: ${err.message}`,
      });
      entry.output.push(errorLine);
      for (const listener of entry.listeners) {
        listener(errorLine);
      }

      for (const exitListener of entry.exitListeners) {
        exitListener(null);
      }
      entry.exitListeners.clear();
    });
  }

  private respawnForResume(
    handle: SessionHandle,
    entry: ProcessEntry,
    prompt: string,
  ): void {
    const args = [
      "--resume",
      handle.id,
      "-p",
      "--verbose",
      "--output-format=stream-json",
      "--include-partial-messages",
    ];

    const { CLAUDECODE: _cc, ...cleanEnv } = process.env;
    const spawnEnv = { ...cleanEnv, PATH: CLI_PATH };

    const proc = spawn("claude", args, {
      cwd: handle.projectDir || undefined,
      stdio: ["pipe", "pipe", "pipe"],
      env: spawnEnv,
    });

    // Update entry with new process
    entry.process = proc;

    // Re-wire I/O
    this.wireStdout(handle.id, proc, entry);
    this.wireStderr(proc, entry);
    this.wireProcessEvents(handle.id, proc, entry);

    // Write prompt and close stdin (resume mode behaves like -p)
    if (proc.stdin) {
      proc.stdin.write(prompt + "\n");
      proc.stdin.end();
    }
  }

  private createEventStream(
    handle: SessionHandle,
    entry: ProcessEntry,
  ): AsyncIterable<SessionEvent> {
    const self = this;

    async function* generator(): AsyncGenerator<SessionEvent> {
      // Process any already-buffered output lines that arrived
      // between the write and now
      const startIdx = entry.output.length;

      // Create a queue for incoming events
      const queue: SessionEvent[] = [];
      let resolve: (() => void) | null = null;
      let done = false;

      const onLine = (line: string) => {
        const event = translateLine(line);
        if (!event) return;

        if (event.type === "done") {
          handle.idle = true;
          queue.push(event);
          done = true;
        } else {
          queue.push(event);
        }

        if (resolve) {
          const r = resolve;
          resolve = null;
          r();
        }
      };

      const onExit = (_code: number | null) => {
        if (!done) {
          done = true;
          // Don't push a duplicate done if we already got a result event
        }
        if (resolve) {
          const r = resolve;
          resolve = null;
          r();
        }
      };

      entry.listeners.add(onLine);
      entry.exitListeners.add(onExit);

      // Process any lines that were buffered before we attached the listener
      for (let i = startIdx; i < entry.output.length; i++) {
        const event = translateLine(entry.output[i]);
        if (event) {
          if (event.type === "done") {
            handle.idle = true;
            done = true;
          }
          queue.push(event);
        }
      }

      try {
        while (true) {
          if (queue.length > 0) {
            const event = queue.shift()!;
            yield event;
            if (event.type === "done") {
              return;
            }
          } else if (done) {
            return;
          } else {
            // Wait for more events
            await new Promise<void>((r) => {
              resolve = r;
            });
          }
        }
      } finally {
        // Cleanup listeners
        entry.listeners.delete(onLine);
        entry.exitListeners.delete(onExit);
      }
    }

    return generator();
  }
}
