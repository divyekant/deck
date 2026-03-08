import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionStore } from "@/lib/claude/runtime/session-store";
import type {
  SessionHandle,
  SessionRuntime,
  CliTool,
  SessionConfig,
} from "@/lib/claude/runtime/types";

function makeHandle(id: string, idle = true): SessionHandle {
  return {
    id,
    cli: "claude" as CliTool,
    projectDir: "/tmp/project",
    model: "claude-sonnet-4-20250514",
    startedAt: new Date(),
    lastAccessedAt: new Date(),
    idle,
  };
}

function makeRuntime(): SessionRuntime {
  return {
    cli: "claude",
    ensureSession: vi.fn(),
    runTurn: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as SessionRuntime;
}

describe("SessionStore", () => {
  let store: SessionStore;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    store?.dispose();
    vi.useRealTimers();
  });

  it("registers and retrieves a session", () => {
    store = new SessionStore({ maxConcurrent: 8 });
    const handle = makeHandle("s1");
    const runtime = makeRuntime();

    store.register(handle, runtime);
    const entry = store.get("s1");

    expect(entry).toBeDefined();
    expect(entry!.handle).toBe(handle);
    expect(entry!.runtime).toBe(runtime);
  });

  it("touches lastAccessedAt on get", () => {
    store = new SessionStore({ maxConcurrent: 8 });
    const handle = makeHandle("s1");
    const runtime = makeRuntime();

    store.register(handle, runtime);
    const beforeAccess = handle.lastAccessedAt.getTime();

    // Advance time so the touch is visible
    vi.advanceTimersByTime(5000);

    const entry = store.get("s1");
    expect(entry).toBeDefined();
    expect(entry!.handle.lastAccessedAt.getTime()).toBeGreaterThan(
      beforeAccess,
    );
  });

  it("lists all active sessions", () => {
    store = new SessionStore({ maxConcurrent: 8 });
    const h1 = makeHandle("s1");
    const h2 = makeHandle("s2");
    const h3 = makeHandle("s3");
    const r1 = makeRuntime();
    const r2 = makeRuntime();
    const r3 = makeRuntime();

    store.register(h1, r1);
    store.register(h2, r2);
    store.register(h3, r3);

    const entries = store.list();
    expect(entries).toHaveLength(3);

    const ids = entries.map((e) => e.handle.id).sort();
    expect(ids).toEqual(["s1", "s2", "s3"]);
  });

  it("removes a session", () => {
    store = new SessionStore({ maxConcurrent: 8 });
    const handle = makeHandle("s1");
    const runtime = makeRuntime();

    store.register(handle, runtime);
    expect(store.get("s1")).toBeDefined();

    store.remove("s1");
    expect(store.get("s1")).toBeUndefined();
    expect(store.list()).toHaveLength(0);
  });

  it("rejects when at capacity with no idle sessions", () => {
    store = new SessionStore({ maxConcurrent: 2 });
    const h1 = makeHandle("s1", false); // not idle
    const h2 = makeHandle("s2", false); // not idle
    const h3 = makeHandle("s3");

    store.register(h1, makeRuntime());
    store.register(h2, makeRuntime());

    expect(() => store.register(h3, makeRuntime())).toThrow(
      /Maximum concurrent sessions/,
    );
  });

  it("evicts LRU idle session when at capacity", () => {
    store = new SessionStore({ maxConcurrent: 2 });

    // s1 is idle, accessed first (oldest)
    const h1 = makeHandle("s1", true);
    h1.lastAccessedAt = new Date(1000);
    store.register(h1, makeRuntime());

    // s2 is idle, accessed more recently
    const h2 = makeHandle("s2", true);
    h2.lastAccessedAt = new Date(2000);
    store.register(h2, makeRuntime());

    // Register s3 — should evict s1 (LRU idle)
    const h3 = makeHandle("s3");
    store.register(h3, makeRuntime());

    expect(store.get("s1")).toBeUndefined();
    expect(store.get("s2")).toBeDefined();
    expect(store.get("s3")).toBeDefined();
  });

  it("evicts idle sessions past TTL", async () => {
    const ttl = 10_000; // 10 seconds
    store = new SessionStore({
      maxConcurrent: 8,
      idleTtlMs: ttl,
      evictionIntervalMs: 60_000,
    });

    const h1 = makeHandle("s1", true);
    const r1 = makeRuntime();
    store.register(h1, r1);

    // Advance time past the TTL
    vi.advanceTimersByTime(ttl + 1);

    store.evictExpired();

    expect(store.get("s1")).toBeUndefined();
    expect(r1.close).toHaveBeenCalledWith(h1);
  });

  it("does NOT evict non-idle sessions past TTL", () => {
    const ttl = 10_000;
    store = new SessionStore({
      maxConcurrent: 8,
      idleTtlMs: ttl,
      evictionIntervalMs: 60_000,
    });

    const h1 = makeHandle("s1", false); // NOT idle
    const r1 = makeRuntime();
    store.register(h1, r1);

    // Advance time past TTL
    vi.advanceTimersByTime(ttl + 1);

    store.evictExpired();

    // Should still be there since it's not idle
    expect(store.get("s1")).toBeDefined();
    expect(r1.close).not.toHaveBeenCalled();
  });

  it("dispose closes all sessions and clears", async () => {
    store = new SessionStore({ maxConcurrent: 8 });
    const h1 = makeHandle("s1");
    const h2 = makeHandle("s2");
    const r1 = makeRuntime();
    const r2 = makeRuntime();

    store.register(h1, r1);
    store.register(h2, r2);

    store.dispose();

    expect(store.list()).toHaveLength(0);
    expect(r1.close).toHaveBeenCalledWith(h1);
    expect(r2.close).toHaveBeenCalledWith(h2);
  });

  it("re-registers the same ID by updating entry", () => {
    store = new SessionStore({ maxConcurrent: 2 });
    const h1 = makeHandle("s1");
    const r1 = makeRuntime();
    const r2 = makeRuntime();

    store.register(h1, r1);

    // Re-register same ID with a different runtime
    const h1Updated = makeHandle("s1");
    store.register(h1Updated, r2);

    const entry = store.get("s1");
    expect(entry).toBeDefined();
    expect(entry!.runtime).toBe(r2);
    expect(entry!.handle).toBe(h1Updated);

    // Should still only have 1 session (not 2)
    expect(store.list()).toHaveLength(1);
  });

  it("eviction timer fires automatically", () => {
    const ttl = 10_000;
    const evictionInterval = 5_000;
    store = new SessionStore({
      maxConcurrent: 8,
      idleTtlMs: ttl,
      evictionIntervalMs: evictionInterval,
    });

    const h1 = makeHandle("s1", true);
    const r1 = makeRuntime();
    store.register(h1, r1);

    // Advance past TTL + one eviction interval to trigger automatic eviction
    vi.advanceTimersByTime(ttl + evictionInterval + 1);

    expect(store.get("s1")).toBeUndefined();
    expect(r1.close).toHaveBeenCalledWith(h1);
  });
});
