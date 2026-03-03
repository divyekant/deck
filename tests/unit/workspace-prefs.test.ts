import { describe, it, expect } from "vitest"

describe("workspace prefs", () => {
  it("should export getProjectPrefs and saveProjectPrefs", async () => {
    const mod = await import("@/lib/workspace-prefs")
    expect(typeof mod.getProjectPrefs).toBe("function")
    expect(typeof mod.saveProjectPrefs).toBe("function")
  })
})
