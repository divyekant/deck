import { describe, it, expect } from "vitest"

describe("SessionPanel", () => {
  it("should be importable", async () => {
    const mod = await import("@/components/workspace/session-panel")
    expect(mod.SessionPanel).toBeDefined()
  })
})

describe("timeAgo", () => {
  it("returns minutes for recent dates", async () => {
    const { timeAgo } = await import("@/components/workspace/session-panel")
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString()
    expect(timeAgo(fiveMinAgo)).toBe("5m ago")
  })

  it("returns hours for dates within a day", async () => {
    const { timeAgo } = await import("@/components/workspace/session-panel")
    const threeHrsAgo = new Date(Date.now() - 3 * 3600000).toISOString()
    expect(timeAgo(threeHrsAgo)).toBe("3h ago")
  })

  it("returns days for older dates", async () => {
    const { timeAgo } = await import("@/components/workspace/session-panel")
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()
    expect(timeAgo(twoDaysAgo)).toBe("2d ago")
  })

  it("handles just now (0 minutes)", async () => {
    const { timeAgo } = await import("@/components/workspace/session-panel")
    const now = new Date().toISOString()
    expect(timeAgo(now)).toBe("just now")
  })
})

describe("matchesQuery", () => {
  it("returns true when query is empty", async () => {
    const { matchesQuery } = await import("@/components/workspace/session-panel")
    expect(matchesQuery({ projectDir: "/foo/bar", prompt: "test" }, "")).toBe(true)
  })

  it("matches against project name from dir", async () => {
    const { matchesQuery } = await import("@/components/workspace/session-panel")
    expect(matchesQuery({ projectDir: "/home/user/my-project", prompt: "hello" }, "my-proj")).toBe(true)
  })

  it("matches against prompt text", async () => {
    const { matchesQuery } = await import("@/components/workspace/session-panel")
    expect(matchesQuery({ projectDir: "/foo/bar", prompt: "fix the login bug" }, "login")).toBe(true)
  })

  it("is case-insensitive", async () => {
    const { matchesQuery } = await import("@/components/workspace/session-panel")
    expect(matchesQuery({ projectDir: "/foo/MyProject", prompt: "test" }, "myproject")).toBe(true)
  })

  it("returns false when no match", async () => {
    const { matchesQuery } = await import("@/components/workspace/session-panel")
    expect(matchesQuery({ projectDir: "/foo/bar", prompt: "hello" }, "xyz")).toBe(false)
  })
})
