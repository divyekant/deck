import { describe, it, expect } from "vitest";

describe("sendMessage", () => {
  it("should be exported from process module", async () => {
    const mod = await import("@/lib/claude/process");
    expect(typeof mod.sendMessage).toBe("function");
  });

  it("should return error for non-existent session", async () => {
    const { sendMessage } = await import("@/lib/claude/process");
    const result = await sendMessage("non-existent-id", "hello");
    expect(result.error).toBe("Session not found");
  });
});
