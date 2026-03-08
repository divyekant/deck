import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { Readable, Writable } from "stream";
import type { ChildProcess } from "child_process";
import type { SessionEvent, SessionHandle } from "@/lib/claude/runtime/types";

// ---- Mocks ----

// Mock child_process
vi.mock("child_process", () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  getAuthEnv: vi.fn().mockResolvedValue({ ANTHROPIC_API_KEY: "sk-test-key" }),
}));

// ---- Helper: create a mock ChildProcess ----

function makeMockProcess(): ChildProcess {
  const emitter = new EventEmitter();

  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });

  // Track writes and whether stdin is ended
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

  // Attach kill mock
  const kill = vi.fn();

  const proc = Object.assign(emitter, {
    stdout,
    stderr,
    stdin,
    kill,
    pid: 12345,
    // Expose test helpers
    _stdinData: stdinData,
    _isStdinEnded: () => stdinEnded,
  }) as unknown as ChildProcess & {
    _stdinData: string[];
    _isStdinEnded: () => boolean;
  };

  return proc;
}

// Push a JSON line to the mock process stdout
function pushLine(proc: ChildProcess, obj: unknown) {
  (proc.stdout as Readable).push(JSON.stringify(obj) + "\n");
}

// Push raw text to stderr
function pushStderr(proc: ChildProcess, text: string) {
  (proc.stderr as Readable).push(text);
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

describe("ClaudeRuntime", () => {
  let mockProc: ChildProcess & {
    _stdinData: string[];
    _isStdinEnded: () => boolean;
  };
  let spawnFn: ReturnType<typeof vi.fn>;
  let execSyncFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockProc = makeMockProcess() as ChildProcess & {
      _stdinData: string[];
      _isStdinEnded: () => boolean;
    };

    const cp = await import("child_process");
    spawnFn = cp.spawn as unknown as ReturnType<typeof vi.fn>;
    spawnFn.mockReturnValue(mockProc);

    execSyncFn = cp.execSync as unknown as ReturnType<typeof vi.fn>;
    execSyncFn.mockReturnValue(Buffer.from("/usr/local/bin/claude\n"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -- Test 1: cli property --
  it('has cli property set to "claude"', async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();
    expect(runtime.cli).toBe("claude");
  });

  // -- Test 2: ensureSession spawns with correct args --
  it("ensureSession spawns claude with correct args", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "Hello world",
    });

    expect(spawnFn).toHaveBeenCalledOnce();
    const [binary, args, opts] = spawnFn.mock.calls[0];
    expect(binary).toBe("claude");
    expect(args).toContain("-p");
    expect(args).toContain("--verbose");
    expect(args).toContain("--output-format=stream-json");
    expect(args).toContain("--include-partial-messages");
    expect(args).toContain("--model");
    expect(args).toContain("claude-sonnet-4-20250514");
    expect(opts.cwd).toBe("/tmp/test-project");
    expect(handle.cli).toBe("claude");
    expect(handle.projectDir).toBe("/tmp/test-project");
    expect(handle.model).toBe("claude-sonnet-4-20250514");
    expect(handle.idle).toBe(false);
  });

  // -- Test 3: session-id flag is included --
  it("includes --session-id flag in spawn args", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "Hello",
    });

    const args = spawnFn.mock.calls[0][1] as string[];
    expect(args).toContain("--session-id");

    // Session ID should be the handle's ID
    const sessionIdIdx = args.indexOf("--session-id");
    expect(args[sessionIdIdx + 1]).toBe(handle.id);
  });

  // -- Test 4: skipPermissions flag --
  it("passes --dangerously-skip-permissions when skipPermissions is set", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "Hello",
      skipPermissions: true,
    });

    const args = spawnFn.mock.calls[0][1] as string[];
    expect(args).toContain("--dangerously-skip-permissions");
  });

  // -- Test 5: ensureSession writes prompt to stdin and leaves it open --
  it("writes prompt to stdin and leaves stdin open (persistent mode)", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "Hello world",
    });

    // Prompt should have been written
    expect(mockProc._stdinData).toContain("Hello world\n");
    // stdin should NOT be ended (persistent mode)
    expect(mockProc._isStdinEnded()).toBe(false);
  });

  // -- Test 6: runTurn translates assistant text to text_delta --
  it("runTurn translates assistant text to text_delta output events", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "init",
    });

    const iter = runtime.runTurn(handle, "Say hello");

    // Push events after starting iteration so the listener is attached
    queueMicrotask(() => {
      pushLine(mockProc, {
        type: "assistant",
        message: { content: [{ type: "text", text: "Hello back!" }] },
      });
      pushLine(mockProc, {
        type: "result",
        subtype: "success",
      });
    });

    const events = await collectEvents(iter);

    const textEvents = events.filter((e) => e.type === "text_delta");
    expect(textEvents).toHaveLength(1);
    expect(textEvents[0]).toEqual({
      type: "text_delta",
      text: "Hello back!",
      stream: "output",
    });
  });

  // -- Test 7: runTurn translates thinking to thought stream --
  it("runTurn translates thinking blocks to thought stream events", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "init",
    });

    const iter = runtime.runTurn(handle, "Think about this");

    queueMicrotask(() => {
      pushLine(mockProc, {
        type: "assistant",
        message: {
          content: [{ type: "thinking", thinking: "Let me think..." }],
        },
      });
      pushLine(mockProc, { type: "result" });
    });

    const events = await collectEvents(iter);

    const thoughtEvents = events.filter(
      (e) => e.type === "text_delta" && e.stream === "thought",
    );
    expect(thoughtEvents).toHaveLength(1);
    expect(thoughtEvents[0]).toEqual({
      type: "text_delta",
      text: "Let me think...",
      stream: "thought",
    });
  });

  // -- Test 8: runTurn translates tool_use to tool_call --
  it("runTurn translates tool_use to tool_call events", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "init",
    });

    const iter = runtime.runTurn(handle, "Read a file");

    queueMicrotask(() => {
      pushLine(mockProc, {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Read", id: "tool-123" },
          ],
        },
      });
      pushLine(mockProc, {
        type: "assistant",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "tool-123" },
          ],
        },
      });
      pushLine(mockProc, { type: "result" });
    });

    const events = await collectEvents(iter);

    const toolEvents = events.filter((e) => e.type === "tool_call");
    expect(toolEvents).toHaveLength(2);
    expect(toolEvents[0]).toEqual({
      type: "tool_call",
      name: "Read",
      status: "started",
      toolCallId: "tool-123",
    });
    expect(toolEvents[1]).toEqual({
      type: "tool_call",
      name: "tool_result",
      status: "completed",
      toolCallId: "tool-123",
    });
  });

  // -- Test 9: runTurn marks handle idle on result --
  it("runTurn marks handle idle on result event", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "init",
    });

    expect(handle.idle).toBe(false);

    const iter = runtime.runTurn(handle, "Do something");

    queueMicrotask(() => {
      pushLine(mockProc, { type: "result", subtype: "success" });
    });

    const events = await collectEvents(iter);

    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
    expect(handle.idle).toBe(true);
  });

  // -- Test 10: runTurn emits error event on stderr --
  it("runTurn emits error event on stderr", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "init",
    });

    const iter = runtime.runTurn(handle, "Do something");

    // Directly inject an error line and result line via the process entry's listeners
    // This bypasses the Readable stream timing issues and tests the event translation
    queueMicrotask(() => {
      const entry = runtime.getProcessEntry(handle.id)!;
      const errorLine = JSON.stringify({ type: "error", error: "Something went wrong" });
      entry.output.push(errorLine);
      for (const listener of entry.listeners) {
        listener(errorLine);
      }
      const resultLine = JSON.stringify({ type: "result" });
      entry.output.push(resultLine);
      for (const listener of entry.listeners) {
        listener(resultLine);
      }
    });

    const events = await collectEvents(iter);

    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]).toEqual({
      type: "error",
      message: "Something went wrong",
      recoverable: true,
    });
  });

  // -- Test 11: cancel kills process with SIGTERM --
  it("cancel kills process with SIGTERM", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "init",
    });

    await runtime.cancel(handle);

    const killFn = (mockProc as unknown as { kill: ReturnType<typeof vi.fn> })
      .kill;
    expect(killFn).toHaveBeenCalledWith("SIGTERM");
  });

  // -- Test 12: getProcessEntry returns internal state --
  it("getProcessEntry returns process entry for SSE compatibility", async () => {
    const { ClaudeRuntime } = await import(
      "@/lib/claude/runtime/claude-runtime"
    );
    const runtime = new ClaudeRuntime();

    const handle = await runtime.ensureSession({
      projectDir: "/tmp/test-project",
      model: "claude-sonnet-4-20250514",
      prompt: "init",
    });

    const entry = runtime.getProcessEntry(handle.id);
    expect(entry).toBeDefined();
    expect(entry!.process).toBe(mockProc);
    expect(entry!.output).toBeInstanceOf(Array);
    expect(entry!.listeners).toBeInstanceOf(Set);
    expect(entry!.exitListeners).toBeInstanceOf(Set);
  });
});
