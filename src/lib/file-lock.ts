/**
 * Simple async mutex for serializing file writes.
 *
 * Each file path gets its own chain of promises so that concurrent
 * read-modify-write cycles on the same JSON file are sequenced
 * and never race.
 */
const locks = new Map<string, Promise<void>>()

export function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(filePath) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  // Store a void-resolved version so the chain keeps going even on error
  locks.set(filePath, next.then(() => {}, () => {}))
  return next
}
