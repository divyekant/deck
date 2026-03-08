import type { SessionHandle, SessionRuntime } from "./types";

export interface SessionStoreConfig {
  maxConcurrent: number;
  idleTtlMs: number;
  evictionIntervalMs: number;
}

export interface StoreEntry {
  handle: SessionHandle;
  runtime: SessionRuntime;
}

const DEFAULT_CONFIG: SessionStoreConfig = {
  maxConcurrent: 8,
  idleTtlMs: 30 * 60 * 1000, // 30 minutes
  evictionIntervalMs: 60 * 1000, // 1 minute
};

export class SessionStore {
  private readonly config: SessionStoreConfig;
  private readonly sessions = new Map<string, StoreEntry>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<SessionStoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.evictionTimer = setInterval(
      () => this.evictExpired(),
      this.config.evictionIntervalMs,
    );
  }

  register(handle: SessionHandle, runtime: SessionRuntime): void {
    // Re-registering same ID — just update
    if (this.sessions.has(handle.id)) {
      this.sessions.set(handle.id, { handle, runtime });
      return;
    }

    // At capacity — try to evict LRU idle session
    if (this.sessions.size >= this.config.maxConcurrent) {
      const evicted = this.evictLruIdle();
      if (!evicted) {
        throw new Error(
          "Maximum concurrent sessions reached. No idle sessions available to evict.",
        );
      }
    }

    this.sessions.set(handle.id, { handle, runtime });
  }

  get(id: string): StoreEntry | undefined {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.handle.lastAccessedAt = new Date();
    }
    return entry;
  }

  list(): StoreEntry[] {
    return Array.from(this.sessions.values());
  }

  remove(id: string): void {
    this.sessions.delete(id);
  }

  evictExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions) {
      if (!entry.handle.idle) continue;

      const elapsed = now - entry.handle.lastAccessedAt.getTime();
      if (elapsed > this.config.idleTtlMs) {
        try {
          entry.runtime.close(entry.handle);
        } catch {
          // swallow close errors during eviction
        }
        this.sessions.delete(id);
      }
    }
  }

  dispose(): void {
    if (this.evictionTimer !== null) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }

    for (const [, entry] of this.sessions) {
      try {
        entry.runtime.close(entry.handle);
      } catch {
        // swallow close errors during disposal
      }
    }

    this.sessions.clear();
  }

  private evictLruIdle(): boolean {
    let oldest: { id: string; entry: StoreEntry } | null = null;

    for (const [id, entry] of this.sessions) {
      if (!entry.handle.idle) continue;

      if (
        !oldest ||
        entry.handle.lastAccessedAt.getTime() <
          oldest.entry.handle.lastAccessedAt.getTime()
      ) {
        oldest = { id, entry };
      }
    }

    if (!oldest) return false;

    try {
      oldest.entry.runtime.close(oldest.entry.handle);
    } catch {
      // swallow close errors during eviction
    }
    this.sessions.delete(oldest.id);
    return true;
  }
}
