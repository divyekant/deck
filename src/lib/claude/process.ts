import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import { getAuthEnv } from "../auth";

export type CliTool = "claude" | "codex";

// Build PATH dynamically: start with system PATH, then append common locations
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

// Check if a CLI binary is available
function isCliAvailable(binary: string): boolean {
  try {
    execSync(`which ${binary}`, { env: { ...process.env, PATH: CLI_PATH }, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface RunningSession {
  id: string;
  process: ChildProcess;
  projectDir: string;
  model: string;
  prompt: string;
  startedAt: Date;
  output: string[]; // accumulated output lines
  exitCode: number | null;
  exited: boolean;
  idle: boolean; // true when waiting for user input
  cli: CliTool;
  idleTimer: ReturnType<typeof setTimeout> | null;
  listeners: Set<(line: string) => void>;
  exitListeners: Set<(code: number | null) => void>;
}

// Module-level store of running sessions
const runningSessions = new Map<string, RunningSession>();

function resetIdleTimer(session: RunningSession) {
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.idleTimer = setTimeout(() => {
    if (!session.exited && session.idle) {
      session.process.kill("SIGTERM");
    }
  }, IDLE_TIMEOUT_MS);
}

async function spawnClaudeProcess(opts: {
  id: string;
  args: string[];
  cwd?: string;
  prompt?: string;
  projectDir?: string;
  model?: string;
  cli?: CliTool;
}): Promise<{ error?: string }> {
  const binary = opts.cli === "codex" ? "codex" : "claude";

  if (!isCliAvailable(binary)) {
    return {
      error: `'${binary}' CLI not found in PATH. Make sure ${binary === "claude" ? "Claude Code" : "Codex"} is installed and accessible.`,
    };
  }

  // Get auth env vars from settings (API key or OAuth token)
  const authEnv = await getAuthEnv();

  // Build clean env: strip CLAUDECODE to avoid "cannot launch inside another CC session"
  const { CLAUDECODE: _, ...cleanEnv } = process.env;
  const spawnEnv = { ...cleanEnv, PATH: CLI_PATH, ...authEnv };

  let proc: ChildProcess;
  try {
    proc = spawn(binary, opts.args, {
      cwd: opts.cwd || undefined,
      stdio: ["pipe", "pipe", "pipe"],
      env: spawnEnv,
    });
  } catch (err) {
    return {
      error: `Failed to spawn claude process: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const session: RunningSession = {
    id: opts.id,
    process: proc,
    projectDir: opts.projectDir || "",
    model: opts.model || "",
    prompt: opts.prompt || "",
    startedAt: new Date(),
    output: [],
    exitCode: null,
    exited: false,
    idle: false,
    idleTimer: null,
    cli: opts.cli || "claude",
    listeners: new Set(),
    exitListeners: new Set(),
  };

  runningSessions.set(opts.id, session);

  // Write prompt to stdin
  if (proc.stdin && opts.prompt) {
    proc.stdin.write(opts.prompt + "\n");
  }
  // Keep stdin open for Claude (multi-turn), close for Codex (takes prompt as CLI arg)
  if (opts.cli === "codex" && proc.stdin) {
    proc.stdin.end();
  }

  // Collect stdout line by line
  let buffer = "";
  proc.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    // Keep the last incomplete line in the buffer
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        session.output.push(trimmed);

        // Detect result message to mark session as idle (ready for follow-up)
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.type === "result") {
            session.idle = true;
            resetIdleTimer(session);
          }
        } catch {
          // Not JSON — ignore
        }

        // Notify all live listeners
        for (const listener of session.listeners) {
          listener(trimmed);
        }
      }
    }
  });

  // Also capture stderr for debugging
  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      const errorLine = JSON.stringify({ type: "error", error: text });
      session.output.push(errorLine);
      for (const listener of session.listeners) {
        listener(errorLine);
      }
    }
  });

  proc.on("close", (code) => {
    if (session.idleTimer) clearTimeout(session.idleTimer);
    // Flush any remaining buffer
    if (buffer.trim()) {
      session.output.push(buffer.trim());
      for (const listener of session.listeners) {
        listener(buffer.trim());
      }
    }

    session.exitCode = code;
    session.exited = true;

    // Notify exit listeners
    for (const exitListener of session.exitListeners) {
      exitListener(code);
    }
    session.exitListeners.clear();

    // Remove from map after 5 minutes
    setTimeout(() => {
      runningSessions.delete(opts.id);
    }, 5 * 60 * 1000);
  });

  proc.on("error", (err) => {
    const errorLine = JSON.stringify({
      type: "error",
      error: `Process error: ${err.message}`,
    });
    session.output.push(errorLine);
    for (const listener of session.listeners) {
      listener(errorLine);
    }

    session.exited = true;
    for (const exitListener of session.exitListeners) {
      exitListener(null);
    }
    session.exitListeners.clear();
  });

  return {};
}

export async function startSession(opts: {
  projectDir: string;
  model: string;
  prompt: string;
  cli?: CliTool;
  skipPermissions?: boolean;
  remoteControl?: boolean;
  maxTurns?: number;
  systemPrompt?: string;
  additionalFlags?: string[];
}): Promise<{ id: string; error?: string }> {
  const id = randomUUID();
  const cli = opts.cli || "claude";

  let args: string[];

  if (cli === "codex") {
    // Codex CLI uses different flags
    args = [
      "--approval-policy",
      "on-failure",
      "--model",
      opts.model,
      opts.prompt,
    ];
  } else {
    args = [
      "-p",
      "--verbose",
      "--output-format=stream-json",
      "--include-partial-messages",
      "--model",
      opts.model,
      "--session-id",
      id,
    ];
    if (opts.skipPermissions) args.push("--dangerously-skip-permissions");
    if (opts.remoteControl) args.push("--enable-remote-control");
    if (opts.maxTurns) args.push("--max-turns", String(opts.maxTurns));
    if (opts.systemPrompt) args.push("--system-prompt", opts.systemPrompt);
    if (opts.additionalFlags) args.push(...opts.additionalFlags);
  }

  const result = await spawnClaudeProcess({
    id,
    args,
    cwd: opts.projectDir,
    prompt: cli === "claude" ? opts.prompt : undefined,
    projectDir: opts.projectDir,
    model: opts.model,
    cli,
  });

  if (result.error) {
    return { id, error: result.error };
  }

  return { id };
}

export async function resumeSession(opts: {
  sessionId: string;
  prompt: string;
  projectDir?: string;
}): Promise<{ id: string; error?: string }> {
  const { sessionId, prompt, projectDir } = opts;

  const args = [
    "--resume",
    sessionId,
    "-p",
    "--verbose",
    "--output-format=stream-json",
    "--include-partial-messages",
  ];

  const result = await spawnClaudeProcess({
    id: sessionId,
    args,
    cwd: projectDir || undefined,
    prompt,
    projectDir,
  });

  if (result.error) {
    return { id: sessionId, error: result.error };
  }

  return { id: sessionId };
}

export function getRunningSession(id: string): RunningSession | undefined {
  return runningSessions.get(id);
}

export function getRunningSessionsList(): {
  id: string;
  projectDir: string;
  model: string;
  prompt: string;
  startedAt: Date;
}[] {
  return Array.from(runningSessions.values()).map((s) => ({
    id: s.id,
    projectDir: s.projectDir,
    model: s.model,
    prompt: s.prompt,
    startedAt: s.startedAt,
  }));
}

export function sendMessage(id: string, prompt: string): { error?: string } {
  const session = runningSessions.get(id);
  if (!session) return { error: "Session not found" };
  if (session.exited) return { error: "Session has exited" };
  if (!session.process.stdin?.writable) return { error: "Session stdin not writable" };

  session.idle = false;
  if (session.idleTimer) clearTimeout(session.idleTimer);
  session.process.stdin.write(prompt + "\n");
  return {};
}

export function stopSession(id: string): boolean {
  const session = runningSessions.get(id);
  if (!session) return false;

  if (!session.exited) {
    session.process.kill("SIGTERM");
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (!session.exited) {
        session.process.kill("SIGKILL");
      }
    }, 5000);
  }

  return true;
}
