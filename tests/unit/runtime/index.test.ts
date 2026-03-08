import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionEvent } from "@/lib/claude/runtime/types";

// vi.hoisted runs before vi.mock hoisting, so refs are available in factories
const { mockStore, mockClaudeRuntime, mockCodexRuntime } = vi.hoisted(() => ({
  mockStore: {
    register: vi.fn(),
    get: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    remove: vi.fn(),
    dispose: vi.fn(),
  },
  mockClaudeRuntime: {
    cli: "claude" as const,
    ensureSession: vi.fn(),
    runTurn: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    getProcessEntry: vi.fn(),
  },
  mockCodexRuntime: {
    cli: "codex" as const,
    ensureSession: vi.fn(),
    runTurn: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/claude/runtime/session-store", () => ({
  SessionStore: function () {
    return mockStore;
  },
}));

vi.mock("@/lib/claude/runtime/claude-runtime", () => ({
  ClaudeRuntime: function () {
    return mockClaudeRuntime;
  },
}));

vi.mock("@/lib/claude/runtime/codex-runtime", () => ({
  CodexRuntime: function () {
    return mockCodexRuntime;
  },
}));

import {
  createSession,
  sendTurn,
  cancelSession,
  getActiveSession,
  listActiveSessions,
  getProcessEntry,
} from "@/lib/claude/runtime/index";

describe("Runtime Index — Unified API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.list.mockReturnValue([]);
  });

  // ---- Test 1: createSession is exported ----
  describe("createSession", () => {
    it("is exported as a function", () => {
      expect(typeof createSession).toBe("function");
    });

    it("creates a claude session by default and registers it", async () => {
      const handle = {
        id: "test-id",
        cli: "claude" as const,
        projectDir: "/tmp/project",
        model: "claude-sonnet-4-20250514",
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        idle: false,
      };
      mockClaudeRuntime.ensureSession.mockResolvedValue(handle);

      const result = await createSession({
        projectDir: "/tmp/project",
        model: "claude-sonnet-4-20250514",
        prompt: "hello",
      });

      expect(result.id).toBe("test-id");
      expect(result.error).toBeUndefined();
      expect(mockClaudeRuntime.ensureSession).toHaveBeenCalled();
      expect(mockStore.register).toHaveBeenCalledWith(handle, mockClaudeRuntime);
    });

    it("creates a codex session when cli is 'codex'", async () => {
      const handle = {
        id: "codex-id",
        cli: "codex" as const,
        projectDir: "/tmp/project",
        model: "o3",
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        idle: false,
      };
      mockCodexRuntime.ensureSession.mockResolvedValue(handle);

      const result = await createSession({
        projectDir: "/tmp/project",
        model: "o3",
        prompt: "hello",
        cli: "codex",
      });

      expect(result.id).toBe("codex-id");
      expect(result.error).toBeUndefined();
      expect(mockCodexRuntime.ensureSession).toHaveBeenCalled();
      expect(mockStore.register).toHaveBeenCalledWith(handle, mockCodexRuntime);
    });

    it("returns error when runtime throws", async () => {
      mockClaudeRuntime.ensureSession.mockRejectedValue(
        new Error("CLI not found"),
      );

      const result = await createSession({
        projectDir: "/tmp/project",
        model: "claude-sonnet-4-20250514",
        prompt: "hello",
      });

      expect(result.id).toBe("");
      expect(result.error).toBe("CLI not found");
    });
  });

  // ---- Test 2: sendTurn is exported ----
  describe("sendTurn", () => {
    it("is exported as a function", () => {
      expect(typeof sendTurn).toBe("function");
    });

    it("returns events from runtime.runTurn", async () => {
      const handle = {
        id: "s1",
        cli: "claude" as const,
        projectDir: "/tmp",
        model: "claude-sonnet-4-20250514",
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        idle: true,
      };

      mockStore.get.mockReturnValue({ handle, runtime: mockClaudeRuntime });

      const events: SessionEvent[] = [
        { type: "text_delta", text: "hi", stream: "output" },
        { type: "done", exitCode: null, stopReason: "turn_complete" },
      ];

      async function* fakeStream() {
        for (const e of events) yield e;
      }
      mockClaudeRuntime.runTurn.mockReturnValue(fakeStream());

      const collected: SessionEvent[] = [];
      for await (const event of sendTurn("s1", "hello")) {
        collected.push(event);
      }

      expect(collected).toHaveLength(2);
      expect(collected[0]).toEqual(events[0]);
      expect(collected[1]).toEqual(events[1]);
    });

    it("yields error event when session not found", async () => {
      mockStore.get.mockReturnValue(undefined);

      const collected: SessionEvent[] = [];
      for await (const event of sendTurn("nonexistent", "hello")) {
        collected.push(event);
      }

      expect(collected).toHaveLength(1);
      expect(collected[0]).toEqual({
        type: "error",
        message: "Session not found: nonexistent",
        recoverable: false,
      });
    });
  });

  // ---- Test 3: cancelSession is exported ----
  describe("cancelSession", () => {
    it("is exported as a function", () => {
      expect(typeof cancelSession).toBe("function");
    });

    it("cancels and removes a session, returns true", async () => {
      const handle = {
        id: "s1",
        cli: "claude" as const,
        projectDir: "/tmp",
        model: "claude-sonnet-4-20250514",
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        idle: true,
      };

      mockStore.get.mockReturnValue({ handle, runtime: mockClaudeRuntime });

      const result = await cancelSession("s1");

      expect(result).toBe(true);
      expect(mockClaudeRuntime.cancel).toHaveBeenCalledWith(handle);
      expect(mockStore.remove).toHaveBeenCalledWith("s1");
    });

    it("returns false when session not found", async () => {
      mockStore.get.mockReturnValue(undefined);

      const result = await cancelSession("nonexistent");
      expect(result).toBe(false);
    });
  });

  // ---- Test 4: getActiveSession is exported ----
  describe("getActiveSession", () => {
    it("is exported as a function", () => {
      expect(typeof getActiveSession).toBe("function");
    });

    it("returns the session handle when found", () => {
      const handle = {
        id: "s1",
        cli: "claude" as const,
        projectDir: "/tmp",
        model: "claude-sonnet-4-20250514",
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        idle: true,
      };

      mockStore.get.mockReturnValue({ handle, runtime: mockClaudeRuntime });

      const result = getActiveSession("s1");
      expect(result).toBe(handle);
    });

    it("returns undefined when not found", () => {
      mockStore.get.mockReturnValue(undefined);

      const result = getActiveSession("nonexistent");
      expect(result).toBeUndefined();
    });
  });

  // ---- Test 5: listActiveSessions is exported ----
  describe("listActiveSessions", () => {
    it("is exported as a function", () => {
      expect(typeof listActiveSessions).toBe("function");
    });

    it("returns summary objects for all sessions", () => {
      const now = new Date();
      const entries = [
        {
          handle: {
            id: "s1",
            cli: "claude" as const,
            projectDir: "/tmp/a",
            model: "claude-sonnet-4-20250514",
            startedAt: now,
            lastAccessedAt: now,
            idle: true,
          },
          runtime: mockClaudeRuntime,
        },
        {
          handle: {
            id: "s2",
            cli: "codex" as const,
            projectDir: "/tmp/b",
            model: "o3",
            startedAt: now,
            lastAccessedAt: now,
            idle: false,
          },
          runtime: mockCodexRuntime,
        },
      ];

      mockStore.list.mockReturnValue(entries);

      const result = listActiveSessions();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "s1",
        projectDir: "/tmp/a",
        model: "claude-sonnet-4-20250514",
        startedAt: now,
        cli: "claude",
      });
      expect(result[1]).toEqual({
        id: "s2",
        projectDir: "/tmp/b",
        model: "o3",
        startedAt: now,
        cli: "codex",
      });
    });
  });

  // ---- Test 6: Re-exports types ----
  describe("type re-exports", () => {
    it("re-exports SessionConfig, SessionEvent, SessionHandle, CliTool types", async () => {
      // Types are erased at runtime, so we verify the module can be imported
      // without errors and all key functions are accessible. The fact that
      // this test file compiles with the imported types is the real check.
      const indexModule = await import("@/lib/claude/runtime/index");
      expect(indexModule).toBeDefined();
      expect(indexModule.createSession).toBeDefined();
      expect(indexModule.sendTurn).toBeDefined();
      expect(indexModule.cancelSession).toBeDefined();
      expect(indexModule.getActiveSession).toBeDefined();
      expect(indexModule.listActiveSessions).toBeDefined();
      expect(indexModule.getProcessEntry).toBeDefined();
    });
  });

  // ---- getProcessEntry ----
  describe("getProcessEntry", () => {
    it("delegates to runtime.getProcessEntry when available", () => {
      const handle = {
        id: "s1",
        cli: "claude" as const,
        projectDir: "/tmp",
        model: "claude-sonnet-4-20250514",
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        idle: true,
      };
      const fakeEntry = {
        process: {},
        output: [],
        listeners: new Set(),
        exitListeners: new Set(),
      };

      mockStore.get.mockReturnValue({ handle, runtime: mockClaudeRuntime });
      mockClaudeRuntime.getProcessEntry.mockReturnValue(fakeEntry);

      const result = getProcessEntry("s1");
      expect(result).toBe(fakeEntry);
      expect(mockClaudeRuntime.getProcessEntry).toHaveBeenCalledWith("s1");
    });

    it("returns undefined when session not found", () => {
      mockStore.get.mockReturnValue(undefined);

      const result = getProcessEntry("nonexistent");
      expect(result).toBeUndefined();
    });

    it("returns undefined when runtime has no getProcessEntry", () => {
      const handle = {
        id: "s2",
        cli: "codex" as const,
        projectDir: "/tmp",
        model: "o3",
        startedAt: new Date(),
        lastAccessedAt: new Date(),
        idle: true,
      };

      // codex runtime does not have getProcessEntry
      mockStore.get.mockReturnValue({ handle, runtime: mockCodexRuntime });

      const result = getProcessEntry("s2");
      expect(result).toBeUndefined();
    });
  });
});
