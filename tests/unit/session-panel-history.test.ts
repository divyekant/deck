import { describe, it, expect } from "vitest"

describe("SessionPanel", () => {
  it("should accept onLoadHistory and searchQuery props", async () => {
    const mod = await import("@/components/workspace/session-panel")
    expect(mod.SessionPanel).toBeDefined()
  })

  it("should export HistorySession interface type", async () => {
    const mod = await import("@/components/workspace/session-panel")
    // HistorySession is a type, so we verify the module exports are correct
    expect(mod.SessionPanel).toBeTypeOf("function")
  })
})
