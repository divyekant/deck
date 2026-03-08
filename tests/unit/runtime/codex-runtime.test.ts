import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { Readable, Writable } from "stream";
import type { ChildProcess } from "child_process";
import type { SessionEvent } from "@/lib/claude/runtime/types";

// ---- Mocks ----

vi.mock("child_process", () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthEnv: vi.fn().mockResolvedValue({ ANTHROPIC_API_KEY: "sk-test-key" }),
}));

// ---- Helper: create a mock ChildProcess ----

function makeMockProcess(): ChildProcess & {
  _stdinData: string[];
  _isStdinEnded: () => boolean;
} {
  const emitter = new EventEmitter();

  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });

  const stdinData: string[] = [];
  let stdinEnded = false;
  const stdin = new Writable({
    write(chunk, _enc, cb) {
      stdinData.push(chunk.toString());
      cb();
    },
    final(cb) {
      stdinEnded = true;
      cb();
    },
  });

  const kill = vi.fn();

  const proc = Object.assign(emitter, {
    stdout,
    stderr,
    stdin,
    kill,
    pid: 99999,
    _stdinData: stdinData,
    _isStdinEnded: () => stdinEnded,
  }) as unknown as ChildProcess & {
    _stdinData: string[];
    _isStdinEnded: () => boolean;
  };

  return proc;
}

// Push a raw text line to stdout (Codex output is plain text, not JSON)
function pushStdoutLine(proc: ChildProcess, text: string) {
  (proc.stdout as Readable).push(text + "\n");
}

// Collect all events from an async iterable
async function collectEvents(
  iter: AsyncIterable<SessionEvent>,
): Promise<SessionEvent[]> {
  const events: SessionEvent[] = [];
  for await (const e of iter) {
    events.push(e);
  }
  return events;
}

describe("CodexRuntime", () => {
  let mockProc: ChildProcess & {
    _stdinData: string[];
    _isStdinEnded: () => boolean;
  };
  let spawnFn: ReturnType<typeof vi.fn>;
  let execSyncFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockProc = makeMockProcess();

    const cp = await import("child_process");
    spawnFn = cp.spawn as unknown as ReturnType<typeof vi.fn>;
    spawnFn.mockReturnValue(mockProc);

    execSyncFn = cp.execSync as unknown as ReturnType<typeof vi.fn>;
    execSyncFn.mockReturnValue(Buffer.from("/usr/local/bin/codex\n"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -- Test 1: cli property is "codex" --
  it('has cli property set to "codex"', async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();
    expect(runtime.cli).toBe("codex");
  });

  // -- Test 2: ensureSession spawns codex with correct args --
  it("ensureSession spawns codex with --approval-policy and --model", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "Hello from codex",
    });

    expect(spawnFn).toHaveBeenCalledOnce();
    const [binary, args, opts] = spawnFn.mock.calls[0];
    expect(binary).toBe("codex");
    expect(args).toContain("--approval-policy");
    expect(args).toContain("on-failure");
    expect(args).toContain("--model");
    expect(args).toContain("o4-mini");
    // The prompt should be the last argument (positional)
    expect(args[args.length - 1]).toBe("Hello from codex");
    expect(opts.cwd).toBe("/tmp/test-project");
    expect(handle.cli).toBe("codex");
    expect(handle.projectDir).toBe("/tmp/test-project");
    expect(handle.model).toBe("o4-mini");
    expect(handle.idle).toBe(false);
  });

  // -- Test 3: stdin is closed after spawn (one-shot) --
  it("closes stdin immediately after spawn (one-shot mode)", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "One-shot prompt",
    });

    // stdin should be ended (one-shot mode, no persistent stdin)
    // Give the microtask a chance to run since end() is async
    await vi.advanceTimersByTimeAsync(0);
    expect(mockProc._isStdinEnded()).toBe(true);
  });

  // -- Test 4: cancel kills with SIGTERM --
  it("cancel kills process with SIGTERM", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "init",
    });

    await runtime.cancel(handle);

    const killFn = (mockProc as unknown as { kill: ReturnType<typeof vi.fn> })
      .kill;
    expect(killFn).toHaveBeenCalledWith("SIGTERM");
  });

  // -- Test 5: cancel sends SIGKILL after 5s timeout --
  it("cancel sends SIGKILL after 5 second timeout", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "init",
    });

    const killFn = (mockProc as unknown as { kill: ReturnType<typeof vi.fn> })
      .kill;

    await runtime.cancel(handle);

    expect(killFn).toHaveBeenCalledWith("SIGTERM");
    expect(killFn).not.toHaveBeenCalledWith("SIGKILL");

    vi.advanceTimersByTime(5000);

    expect(killFn).toHaveBeenCalledWith("SIGKILL");
  });

  // -- Test 6: runTurn spawns fresh process (one-shot, no persistent mode) --
  it("runTurn closes old process and spawns fresh with new prompt", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "first prompt",
    });

    // Create a new mock process for the respawn
    const secondProc = makeMockProcess();
    spawnFn.mockReturnValue(secondProc);

    const iter = await runtime.runTurn(handle, "second prompt");

    // Should have spawned twice (initial + runTurn respawn)
    expect(spawnFn).toHaveBeenCalledTimes(2);

    // The second spawn should include the new prompt
    const [binary, args] = spawnFn.mock.calls[1];
    expect(binary).toBe("codex");
    expect(args[args.length - 1]).toBe("second prompt");

    // Old process should have been killed
    const oldKill = (mockProc as unknown as { kill: ReturnType<typeof vi.fn> })
      .kill;
    expect(oldKill).toHaveBeenCalled();

    // Emit output then close to finish the stream
    queueMicrotask(() => {
      pushStdoutLine(secondProc, "Done!");
      secondProc.emit("close", 0);
    });

    const events = await collectEvents(iter);
    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
  });

  // -- Test 7: runTurn streams stdout as text_delta events --
  it("runTurn streams stdout lines as text_delta events", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "init",
    });

    // Replace with fresh process for runTurn
    const turnProc = makeMockProcess();
    spawnFn.mockReturnValue(turnProc);

    const iter = await runtime.runTurn(handle, "do something");

    // Inject lines directly through the entry's listeners (like ClaudeRuntime tests)
    // to avoid Readable stream timing issues
    queueMicrotask(() => {
      const entry = runtime.getProcessEntry(handle.id)!;
      const lines = ["Line one output", "Line two output"];
      for (const line of lines) {
        entry.output.push(line);
        for (const listener of entry.listeners) {
          listener(line);
        }
      }
      // Fire exit to close the stream
      for (const exitListener of entry.exitListeners) {
        exitListener(0);
      }
      entry.exitListeners.clear();
    });

    const events = await collectEvents(iter);

    const textEvents = events.filter((e) => e.type === "text_delta");
    expect(textEvents).toHaveLength(2);
    expect(textEvents[0]).toEqual({
      type: "text_delta",
      text: "Line one output",
      stream: "output",
    });
    expect(textEvents[1]).toEqual({
      type: "text_delta",
      text: "Line two output",
      stream: "output",
    });
  });

  // -- Test 8: runTurn yields done event on process exit and marks idle --
  it("runTurn yields done event on process exit and marks handle idle", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "init",
    });

    expect(handle.idle).toBe(false);

    const turnProc = makeMockProcess();
    spawnFn.mockReturnValue(turnProc);

    const iter = await runtime.runTurn(handle, "work");

    queueMicrotask(() => {
      turnProc.emit("close", 0);
    });

    const events = await collectEvents(iter);

    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0]).toEqual({
      type: "done",
      exitCode: 0,
      stopReason: "turn_complete",
    });
    expect(handle.idle).toBe(true);
  });

  // -- Test 9: close kills process and removes from map --
  it("close kills process and removes from internal map", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "init",
    });

    expect(runtime.getProcessEntry(handle.id)).toBeDefined();

    const killFn = (mockProc as unknown as { kill: ReturnType<typeof vi.fn> })
      .kill;

    // Simulate process exit on kill
    queueMicrotask(() => {
      mockProc.emit("close", 0);
    });

    await runtime.close(handle);

    expect(killFn).toHaveBeenCalled();
    expect(runtime.getProcessEntry(handle.id)).toBeUndefined();
  });

  // -- Test 10: getProcessEntry returns internal state --
  it("getProcessEntry returns process entry for SSE compatibility", async () => {
    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "o4-mini",
      prompt: "init",
    });

    const entry = runtime.getProcessEntry(handle.id);
    expect(entry).toBeDefined();
    expect(entry!.process).toBe(mockProc);
    expect(entry!.output).toBeInstanceOf(Array);
    expect(entry!.listeners).toBeInstanceOf(Set);
    expect(entry!.exitListeners).toBeInstanceOf(Set);
  });

  // -- Test 11: ensureSession throws if codex CLI not found --
  it("ensureSession throws if codex CLI is not available", async () => {
    execSyncFn.mockImplementation(() => {
      throw new Error("not found");
    });

    const { CodexRuntime } = await import(
      "@/lib/claude/runtime/codex-runtime"
    );
    const runtime = new CodexRuntime();

    await expect(
      runtime.ensureSession({
        projectDir: "/tmp/test-project",
        model: "o4-mini",
        prompt: "hello",
      }),
    ).rejects.toThrow("codex");
  });
});
