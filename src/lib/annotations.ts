import { promises as fs } from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"
import { withFileLock } from "./file-lock"

const DECK_DIR = path.join(os.homedir(), ".deck")
const ANNOTATIONS_FILE = path.join(DECK_DIR, "annotations.json")

// ---- Types ----

export interface Note {
  id: string
  text: string
  createdAt: string
}

export interface SessionAnnotation {
  notes: Note[]
  tags: string[]
}

/**
 * Full annotations store: { [sessionId]: SessionAnnotation }
 */
type AnnotationsStore = Record<string, SessionAnnotation>

// ---- Internal read/write ----

async function readStore(): Promise<AnnotationsStore> {
  try {
    const raw = await fs.readFile(ANNOTATIONS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AnnotationsStore
    }
    return {}
  } catch {
    return {}
  }
}

async function writeStore(store: AnnotationsStore): Promise<void> {
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(ANNOTATIONS_FILE, JSON.stringify(store, null, 2), "utf-8")
}

function ensureSession(store: AnnotationsStore, sessionId: string): SessionAnnotation {
  if (!store[sessionId]) {
    store[sessionId] = { notes: [], tags: [] }
  }
  return store[sessionId]
}

// ---- Public API ----

/** Get annotations for a single session */
export async function getAnnotations(sessionId: string): Promise<SessionAnnotation>

/** Get all annotations (no argument) */
export async function getAnnotations(): Promise<AnnotationsStore>

/** Implementation */
export async function getAnnotations(sessionId?: string): Promise<SessionAnnotation | AnnotationsStore> {
  const store = await readStore()
  if (sessionId) {
    return store[sessionId] ?? { notes: [], tags: [] }
  }
  return store
}

/** Get all annotations — alias used by existing consumers */
export async function getAllAnnotations(): Promise<AnnotationsStore> {
  return readStore()
}

/** Add a note to a session. Returns the created Note. */
export async function addNote(sessionId: string, text: string): Promise<Note> {
  return withFileLock(ANNOTATIONS_FILE, async () => {
    const store = await readStore()
    const session = ensureSession(store, sessionId)
    const note: Note = {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    }
    session.notes.push(note)
    await writeStore(store)
    return note
  })
}

/** Remove a note by ID from a session */
export async function removeNote(sessionId: string, noteId: string): Promise<void> {
  return withFileLock(ANNOTATIONS_FILE, async () => {
    const store = await readStore()
    const session = store[sessionId]
    if (!session) return
    session.notes = session.notes.filter((n) => n.id !== noteId)
    await writeStore(store)
  })
}

/** Add a tag to a session */
export async function addTag(sessionId: string, tag: string): Promise<void> {
  return withFileLock(ANNOTATIONS_FILE, async () => {
    const store = await readStore()
    const session = ensureSession(store, sessionId)
    const normalized = tag.trim().toLowerCase()
    if (!normalized || session.tags.includes(normalized)) return
    session.tags.push(normalized)
    await writeStore(store)
  })
}

/** Remove a tag from a session */
export async function removeTag(sessionId: string, tag: string): Promise<void> {
  return withFileLock(ANNOTATIONS_FILE, async () => {
    const store = await readStore()
    const session = store[sessionId]
    if (!session) return
    session.tags = session.tags.filter((t) => t !== tag)
    await writeStore(store)
  })
}

// ---- Backward-compatible helpers (used by existing API route / consumers) ----

/** Get a unique sorted list of all tags across all sessions */
export async function getAllTags(): Promise<string[]> {
  const store = await readStore()
  const tagSet = new Set<string>()
  for (const annotation of Object.values(store)) {
    for (const tag of annotation.tags) {
      tagSet.add(tag)
    }
  }
  return Array.from(tagSet).sort()
}

/** Set tags for a session (replaces all tags). Used by bulk-tag in sessions list. */
export async function setSessionTags(sessionId: string, tags: string[]): Promise<void> {
  return withFileLock(ANNOTATIONS_FILE, async () => {
    const store = await readStore()
    const session = ensureSession(store, sessionId)
    session.tags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
    await writeStore(store)
  })
}

/** Set/replace the session note (stored as a single note for backward compat). */
export async function setSessionNote(sessionId: string, noteText: string): Promise<void> {
  return withFileLock(ANNOTATIONS_FILE, async () => {
    const store = await readStore()
    const session = ensureSession(store, sessionId)

    // If a "quick note" already exists (convention: first note with id starting with "quick-"),
    // update it. Otherwise add one.
    const quickIdx = session.notes.findIndex((n) => n.id.startsWith("quick-"))
    if (quickIdx >= 0) {
      session.notes[quickIdx].text = noteText
    } else if (noteText.trim()) {
      session.notes.unshift({
        id: `quick-${crypto.randomUUID()}`,
        text: noteText,
        createdAt: new Date().toISOString(),
      })
    }
    await writeStore(store)
  })
}
