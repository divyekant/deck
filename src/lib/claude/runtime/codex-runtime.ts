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

// ---- PATH helper (shared pattern with ClaudeRuntime) ----

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

// ---- CodexRuntime (one-shot mode) ----

export class CodexRuntime implements SessionRuntime {
  readonly cli: CliTool = "codex";
  private readonly processes = new Map<string, ProcessEntry>();

  async ensureSession(config: SessionConfig): Promise<SessionHandle> {
    if (!isCliAvailable("codex")) {
      throw new Error(
        "'codex' CLI not found in PATH. Make sure Codex is installed and accessible.",
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

    // Build args: --approval-policy on-failure --model X <prompt>
    const args = [
      "--approval-policy",
      "on-failure",
      "--model",
      config.model,
    ];

    if (config.additionalFlags) args.push(...config.additionalFlags);

    // Prompt is positional (last argument)
    args.push(config.prompt);

    const proc = spawn("codex", args, {
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
    this.wireStdout(proc, entry);

    // Wire stderr
    this.wireStderr(proc, entry);

    // Wire close/error events
    this.wireProcessEvents(id, proc, entry);

    // Close stdin immediately (one-shot mode, prompt is a positional arg)
    if (proc.stdin && !proc.stdin.destroyed) {
      proc.stdin.end();
    }

    const now = new Date();
    const handle: SessionHandle = {
      id,
      cli: "codex",
      projectDir: config.projectDir,
      model: config.model,
      startedAt: now,
      lastAccessedAt: now,
      idle: false,
    };

    return handle;
  }

  async runTurn(
    handle: SessionHandle,
    prompt: string,
  ): Promise<AsyncIterable<SessionEvent>> {
    const oldEntry = this.processes.get(handle.id);

    // Codex is one-shot: kill old process, spawn fresh
    if (oldEntry) {
      try {
        oldEntry.process.kill("SIGTERM");
      } catch {
        // Process may already be dead
      }
    }

    handle.idle = false;
    handle.lastAccessedAt = new Date();

    // Auth env
    const authEnv = await getAuthEnv();

    // Build clean env
    const { CLAUDECODE: _cc, ...cleanEnv } = process.env;
    if (authEnv.ANTHROPIC_AUTH_TOKEN) {
      delete cleanEnv.ANTHROPIC_API_KEY;
    }
    const spawnEnv = { ...cleanEnv, PATH: CLI_PATH, ...authEnv };

    // Build args with new prompt
    const args = [
      "--approval-policy",
      "on-failure",
      "--model",
      handle.model,
      prompt,
    ];

    const proc = spawn("codex", args, {
      cwd: handle.projectDir || undefined,
      stdio: ["pipe", "pipe", "pipe"],
      env: spawnEnv,
    });

    // Create new entry, transfer to the original handle's ID
    const entry: ProcessEntry = {
      process: proc,
      output: [],
      listeners: new Set(),
      exitListeners: new Set(),
    };

    this.processes.set(handle.id, entry);

    // Wire I/O
    this.wireStdout(proc, entry);
    this.wireStderr(proc, entry);
    this.wireProcessEvents(handle.id, proc, entry);

    // Close stdin (one-shot)
    if (proc.stdin && !proc.stdin.destroyed) {
      proc.stdin.end();
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

    // Kill the process
    try {
      entry.process.kill("SIGTERM");
    } catch {
      // Process may already be dead
    }

    // Wait up to 3 seconds for graceful exit
    const graceful = await Promise.race([
      new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 3000);
        entry.process.once("close", () => {
          clearTimeout(timer);
          resolve(true);
        });
      }),
    ]);

    if (!graceful) {
      try {
        entry.process.kill("SIGKILL");
      } catch {
        // Already dead
      }
    }

    this.processes.delete(handle.id);
  }

  getProcessEntry(id: string): ProcessEntry | undefined {
    return this.processes.get(id);
  }

  // ---- Private helpers ----

  private wireStdout(proc: ChildProcess, entry: ProcessEntry): void {
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
        const errorLine = `[stderr] ${text}`;
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
      const errorLine = `[stderr] Process error: ${err.message}`;
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

  private createEventStream(
    handle: SessionHandle,
    entry: ProcessEntry,
  ): AsyncIterable<SessionEvent> {
    async function* generator(): AsyncGenerator<SessionEvent> {
      const queue: SessionEvent[] = [];
      let resolve: (() => void) | null = null;
      let done = false;

      const onLine = (line: string) => {
        // Codex output is plain text lines (simpler than Claude JSON)
        if (line.startsWith("[stderr]")) {
          queue.push({
            type: "error",
            message: line.replace("[stderr] ", ""),
            recoverable: true,
          });
        } else {
          queue.push({
            type: "text_delta",
            text: line,
            stream: "output",
          });
        }

        if (resolve) {
          const r = resolve;
          resolve = null;
          r();
        }
      };

      const onExit = (code: number | null) => {
        done = true;
        handle.idle = true;
        queue.push({
          type: "done",
          exitCode: code,
          stopReason: "turn_complete",
        });

        if (resolve) {
          const r = resolve;
          resolve = null;
          r();
        }
      };

      entry.listeners.add(onLine);
      entry.exitListeners.add(onExit);

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
            await new Promise<void>((r) => {
              resolve = r;
            });
          }
        }
      } finally {
        entry.listeners.delete(onLine);
        entry.exitListeners.delete(onExit);
      }
    }

    return generator();
  }
}
