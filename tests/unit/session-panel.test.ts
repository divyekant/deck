import { describe, it, expect } from "vitest"

describe("SessionPanel", () => {
  it("should be importable", async () => {
    const mod = await import("@/components/workspace/session-panel")
    expect(mod.SessionPanel).toBeDefined()
  })
})
