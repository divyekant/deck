import { describe, it, expect } from "vitest"

describe("DetailDrawer", () => {
  it("should be importable", async () => {
    const mod = await import("@/components/workspace/detail-drawer")
    expect(mod.DetailDrawer).toBeDefined()
  })
})
