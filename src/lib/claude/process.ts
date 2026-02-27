import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";

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
  listeners: Set<(line: string) => void>;
  exitListeners: Set<(code: number | null) => void>;
}

// Module-level store of running sessions
const runningSessions = new Map<string, RunningSession>();

function spawnClaudeProcess(opts: {
  id: string;
  args: string[];
  cwd?: string;
  prompt: string;
  projectDir?: string;
  model?: string;
}): { error?: string } {
  let proc: ChildProcess;
  try {
    proc = spawn("claude", opts.args, {
      cwd: opts.cwd || undefined,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
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
    prompt: opts.prompt,
    startedAt: new Date(),
    output: [],
    exitCode: null,
    exited: false,
    listeners: new Set(),
    exitListeners: new Set(),
  };

  runningSessions.set(opts.id, session);

  // Write prompt to stdin and close it
  if (proc.stdin) {
    proc.stdin.write(opts.prompt);
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

export function startSession(opts: {
  projectDir: string;
  model: string;
  prompt: string;
}): { id: string; error?: string } {
  const id = randomUUID();

  const args = [
    "-p",
    "--output-format=stream-json",
    "--include-partial-messages",
    "--model",
    opts.model,
    "--session-id",
    id,
  ];

  const result = spawnClaudeProcess({
    id,
    args,
    cwd: opts.projectDir,
    prompt: opts.prompt,
    projectDir: opts.projectDir,
    model: opts.model,
  });

  if (result.error) {
    return { id, error: result.error };
  }

  return { id };
}

export function resumeSession(opts: {
  sessionId: string;
  prompt: string;
}): { id: string; error?: string } {
  const { sessionId, prompt } = opts;

  const args = [
    "--resume",
    sessionId,
    "-p",
    "--output-format=stream-json",
    "--include-partial-messages",
  ];

  const result = spawnClaudeProcess({
    id: sessionId,
    args,
    prompt,
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
