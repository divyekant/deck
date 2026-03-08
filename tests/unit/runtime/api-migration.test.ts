import { describe, it, expect } from "vitest";
import { readFile } from "fs/promises";
import path from "path";

const SRC = path.resolve(__dirname, "../../../src");

async function readRoute(routePath: string): Promise<string> {
  return readFile(path.join(SRC, routePath), "utf-8");
}

describe("API route migration — imports from runtime, not process", () => {
  const routes = [
    "app/api/sessions/start/route.ts",
    "app/api/sessions/[id]/message/route.ts",
    "app/api/sessions/[id]/stream/route.ts",
    "app/api/sessions/[id]/stop/route.ts",
    "app/api/sessions/running/route.ts",
  ];

  for (const route of routes) {
    it(`${route} does NOT import from @/lib/claude/process`, async () => {
      const src = await readRoute(route);
      expect(src).not.toMatch(/from\s+["']@\/lib\/claude\/process["']/);
    });

    it(`${route} imports from @/lib/claude/runtime`, async () => {
      const src = await readRoute(route);
      expect(src).toMatch(/from\s+["']@\/lib\/claude\/runtime["']/);
    });
  }

  it("start/route.ts uses createSession (not startSession)", async () => {
    const src = await readRoute("app/api/sessions/start/route.ts");
    expect(src).toMatch(/createSession/);
    expect(src).not.toMatch(/startSession/);
  });

  it("message/route.ts uses getActiveSession (not getRunningSession)", async () => {
    const src = await readRoute("app/api/sessions/[id]/message/route.ts");
    expect(src).toMatch(/getActiveSession/);
    expect(src).not.toMatch(/getRunningSession/);
  });

  it("message/route.ts uses sendTurn (not sendMessage)", async () => {
    const src = await readRoute("app/api/sessions/[id]/message/route.ts");
    expect(src).toMatch(/sendTurn/);
    expect(src).not.toMatch(/sendMessage/);
  });

  it("stream/route.ts uses getActiveSession and getProcessEntry", async () => {
    const src = await readRoute("app/api/sessions/[id]/stream/route.ts");
    expect(src).toMatch(/getActiveSession/);
    expect(src).toMatch(/getProcessEntry/);
    expect(src).not.toMatch(/getRunningSession/);
  });

  it("stop/route.ts uses cancelSession (not stopSession)", async () => {
    const src = await readRoute("app/api/sessions/[id]/stop/route.ts");
    expect(src).toMatch(/cancelSession/);
    expect(src).not.toMatch(/stopSession/);
  });

  it("running/route.ts uses listActiveSessions (not getRunningSessionsList)", async () => {
    const src = await readRoute("app/api/sessions/running/route.ts");
    expect(src).toMatch(/listActiveSessions/);
    expect(src).not.toMatch(/getRunningSessionsList/);
  });
});
