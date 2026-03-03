import { describe, it, expect } from "vitest"

describe("GET /api/filesystem/browse", () => {
  it("should export a GET handler", async () => {
    const mod = await import("@/app/api/filesystem/browse/route")
    expect(typeof mod.GET).toBe("function")
  })
})
