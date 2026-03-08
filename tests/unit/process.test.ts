import { describe, it, expect } from "vitest";
import type { SessionEvent } from "@/lib/claude/runtime";

describe("sendTurn (runtime)", () => {
  it("should be exported from runtime module", async () => {
    const mod = await import("@/lib/claude/runtime");
    expect(typeof mod.sendTurn).toBe("function");
  });

  it("should yield error event for non-existent session", async () => {
    const { sendTurn } = await import("@/lib/claude/runtime");
    const events: SessionEvent[] = [];

    for await (const event of sendTurn("non-existent-id", "hello")) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "error",
      message: "Session not found: non-existent-id",
      recoverable: false,
    });
  });
});
