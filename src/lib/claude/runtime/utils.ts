import { execSync } from "child_process";
import type { ChildProcess } from "child_process";
import { existsSync, readdirSync } from "fs";

// ---- Shared ProcessEntry ----

export interface ProcessEntry {
  process: ChildProcess;
  output: string[];
  listeners: Set<(line: string) => void>;
  exitListeners: Set<(code: number | null) => void>;
}

// ---- PATH helper ----

function getCliPath(): string {
  const base = process.env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin";
  const home = process.env.HOME || "";
  const extras: string[] = [];

  // Auto-detect NVM node bin (pick highest installed version)
  if (home) {
    const nvmVersionsDir = `${home}/.nvm/versions/node`;
    try {
      const versions = readdirSync(nvmVersionsDir)
        .filter((v) => v.startsWith("v"))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      if (versions.length > 0) {
        extras.push(`${nvmVersionsDir}/${versions[0]}/bin`);
      }
    } catch {
      // NVM not installed — skip
    }

    // Common tool locations — added only if they exist
    const candidates = [
      `${home}/.orbstack/bin`,
      `${home}/homebrew/bin`,
      `${home}/.local/bin`,
    ];
    for (const dir of candidates) {
      if (existsSync(dir)) extras.push(dir);
    }
  }

  // System-wide paths
  extras.push("/usr/local/bin", "/opt/homebrew/bin");

  const parts = new Set(base.split(":"));
  for (const p of extras) parts.add(p);
  return Array.from(parts).join(":");
}

export const CLI_PATH = getCliPath();

export function isCliAvailable(binary: string): boolean {
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

// ---- Output buffer with max size ----

const MAX_OUTPUT_LINES = 5000;

/**
 * Push a line to the output buffer, evicting oldest entries if over capacity.
 */
export function pushOutput(entry: ProcessEntry, line: string): void {
  entry.output.push(line);
  if (entry.output.length > MAX_OUTPUT_LINES) {
    // Drop oldest 20% to avoid splicing on every line
    const drop = Math.floor(MAX_OUTPUT_LINES * 0.2);
    entry.output.splice(0, drop);
  }
}

// ---- Shared I/O wiring ----

export function wireStdout(
  entry: ProcessEntry,
  proc: ChildProcess,
): void {
  let buffer = "";
  proc.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        pushOutput(entry, trimmed);
        for (const listener of entry.listeners) {
          listener(trimmed);
        }
      }
    }
  });
}

export function wireStderr(
  entry: ProcessEntry,
  proc: ChildProcess,
): void {
  proc.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      const errorLine = JSON.stringify({ type: "error", error: text });
      pushOutput(entry, errorLine);
      for (const listener of entry.listeners) {
        listener(errorLine);
      }
    }
  });
}

export function wireProcessEvents(
  id: string,
  proc: ChildProcess,
  entry: ProcessEntry,
): void {
  proc.on("close", (code) => {
    for (const exitListener of entry.exitListeners) {
      exitListener(code);
    }
    entry.exitListeners.clear();
    // No 5-min cleanup timer — SessionStore drives lifecycle via close()
  });

  proc.on("error", (err) => {
    const errorLine = JSON.stringify({
      type: "error",
      error: `Process error: ${err.message}`,
    });
    pushOutput(entry, errorLine);
    for (const listener of entry.listeners) {
      listener(errorLine);
    }

    for (const exitListener of entry.exitListeners) {
      exitListener(null);
    }
    entry.exitListeners.clear();
  });
}
