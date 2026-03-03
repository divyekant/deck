import { describe, it, expect } from "vitest";

describe("GET /api/sessions/[id]/stream", () => {
  it("should export a GET handler", async () => {
    const mod = await import("@/app/api/sessions/[id]/stream/route");
    expect(typeof mod.GET).toBe("function");
  });
});
