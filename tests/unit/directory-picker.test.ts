import { describe, it, expect } from "vitest"

describe("DirectoryPicker", () => {
  it("should be importable", async () => {
    const mod = await import("@/components/workspace/directory-picker")
    expect(mod.DirectoryPicker).toBeDefined()
  })
})
