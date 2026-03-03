import { describe, it, expect } from "vitest";

describe("POST /api/sessions/[id]/message", () => {
  it("should export a POST handler", async () => {
    const mod = await import("@/app/api/sessions/[id]/message/route");
    expect(typeof mod.POST).toBe("function");
  });
});
