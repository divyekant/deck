import { describe, it, expect } from "vitest"

describe("ReplayScrubber", () => {
  it("should be importable", async () => {
    const mod = await import("@/components/workspace/replay-scrubber")
    expect(mod.ReplayScrubber).toBeDefined()
  })
})
