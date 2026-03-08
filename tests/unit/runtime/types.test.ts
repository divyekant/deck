import { describe, it, expect } from "vitest";
import type {
  CliTool,
  SessionEvent,
  SessionHandle,
  SessionConfig,
  SessionRuntime,
} from "@/lib/claude/runtime/types";

describe("runtime/types", () => {
  describe("CliTool", () => {
    it('accepts "claude"', () => {
      const tool: CliTool = "claude";
      expect(tool).toBe("claude");
    });

    it('accepts "codex"', () => {
      const tool: CliTool = "codex";
      expect(tool).toBe("codex");
    });
  });

  describe("SessionEvent", () => {
    it("accepts text_delta variant", () => {
      const event: SessionEvent = {
        type: "text_delta",
        text: "hello",
      };
      expect(event.type).toBe("text_delta");

      const eventWithStream: SessionEvent = {
        type: "text_delta",
        text: "hello",
        stream: "thought",
      };
      expect(eventWithStream.type).toBe("text_delta");
    });

    it("accepts status variant", () => {
      const event: SessionEvent = {
        type: "status",
        text: "running",
      };
      expect(event.type).toBe("status");

      const eventWithPhase: SessionEvent = {
        type: "status",
        text: "running",
        phase: "init",
      };
      expect(eventWithPhase.type).toBe("status");
    });

    it("accepts tool_call variant", () => {
      const event: SessionEvent = {
        type: "tool_call",
        name: "Read",
        status: "started",
      };
      expect(event.type).toBe("tool_call");

      const eventWithId: SessionEvent = {
        type: "tool_call",
        name: "Read",
        status: "completed",
        toolCallId: "tc_123",
      };
      expect(eventWithId.type).toBe("tool_call");
    });

    it("accepts done variant", () => {
      const event: SessionEvent = {
        type: "done",
        exitCode: 0,
      };
      expect(event.type).toBe("done");

      const eventWithReason: SessionEvent = {
        type: "done",
        exitCode: null,
        stopReason: "user_cancelled",
      };
      expect(eventWithReason.type).toBe("done");
    });

    it("accepts error variant", () => {
      const event: SessionEvent = {
        type: "error",
        message: "something broke",
        recoverable: false,
      };
      expect(event.type).toBe("error");
    });

    it("covers all 5 event types", () => {
      const events: SessionEvent[] = [
        { type: "text_delta", text: "hi" },
        { type: "status", text: "ok" },
        { type: "tool_call", name: "Bash", status: "started" },
        { type: "done", exitCode: 0 },
        { type: "error", message: "fail", recoverable: true },
      ];
      const types = events.map((e) => e.type);
      expect(types).toEqual([
        "text_delta",
        "status",
        "tool_call",
        "done",
        "error",
      ]);
    });
  });

  describe("SessionConfig", () => {
    it("accepts required fields only", () => {
      const config: SessionConfig = {
        projectDir: "/tmp/project",
        model: "claude-sonnet-4-20250514",
        prompt: "hello",
      };
      expect(config.projectDir).toBe("/tmp/project");
      expect(config.model).toBe("claude-sonnet-4-20250514");
      expect(config.prompt).toBe("hello");
    });

    it("accepts all optional fields", () => {
      const config: SessionConfig = {
        projectDir: "/tmp/project",
        model: "claude-sonnet-4-20250514",
        prompt: "hello",
        skipPermissions: true,
        remoteControl: false,
        maxTurns: 10,
        systemPrompt: "You are helpful",
        additionalFlags: ["--verbose"],
      };
      expect(config.skipPermissions).toBe(true);
      expect(config.remoteControl).toBe(false);
      expect(config.maxTurns).toBe(10);
      expect(config.systemPrompt).toBe("You are helpful");
      expect(config.additionalFlags).toEqual(["--verbose"]);
    });
  });

  describe("SessionHandle", () => {
    it("accepts all fields", () => {
      const now = new Date();
      const handle: SessionHandle = {
        id: "sess_123",
        cli: "claude",
        projectDir: "/tmp/project",
        model: "claude-sonnet-4-20250514",
        startedAt: now,
        lastAccessedAt: now,
        idle: true,
      };
      expect(handle.id).toBe("sess_123");
      expect(handle.cli).toBe("claude");
      expect(handle.projectDir).toBe("/tmp/project");
      expect(handle.model).toBe("claude-sonnet-4-20250514");
      expect(handle.startedAt).toBe(now);
      expect(handle.lastAccessedAt).toBe(now);
      expect(handle.idle).toBe(true);
    });
  });

  describe("SessionRuntime", () => {
    it("interface shape is structurally valid", () => {
      // Verify the interface can be implemented with correct shape
      const mockRuntime: SessionRuntime = {
        cli: "claude",
        ensureSession: async (_config: SessionConfig) => {
          return {
            id: "test",
            cli: "claude" as CliTool,
            projectDir: "/tmp",
            model: "test",
            startedAt: new Date(),
            lastAccessedAt: new Date(),
            idle: false,
          };
        },
        runTurn: async function* (_handle: SessionHandle, _prompt: string) {
          yield { type: "done" as const, exitCode: 0 };
        },
        cancel: async (_handle: SessionHandle) => {},
        close: async (_handle: SessionHandle) => {},
      };
      expect(mockRuntime.cli).toBe("claude");
      expect(typeof mockRuntime.ensureSession).toBe("function");
      expect(typeof mockRuntime.runTurn).toBe("function");
      expect(typeof mockRuntime.cancel).toBe("function");
      expect(typeof mockRuntime.close).toBe("function");
    });
  });

  describe("module exports", () => {
    it("exports are defined", async () => {
      const mod = await import("@/lib/claude/runtime/types");
      expect(mod).toBeDefined();
    });
  });
});
