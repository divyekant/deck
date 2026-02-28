import { promises as fs } from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"
import { withFileLock } from "./file-lock"

const DECK_DIR = path.join(os.homedir(), ".deck")
const BOOKMARKS_FILE = path.join(DECK_DIR, "bookmarks.json")

export interface Bookmark {
  id: string
  sessionId: string
  messageIndex: number
  messagePreview: string
  project: string
  createdAt: string
}

async function readBookmarks(): Promise<Bookmark[]> {
  try {
    const raw = await fs.readFile(BOOKMARKS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed as Bookmark[]
    }
    return []
  } catch {
    return []
  }
}

async function writeBookmarks(bookmarks: Bookmark[]): Promise<void> {
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(
    BOOKMARKS_FILE,
    JSON.stringify(bookmarks, null, 2),
    "utf-8"
  )
}

export async function getBookmarks(): Promise<Bookmark[]> {
  return readBookmarks()
}

export async function addBookmark(
  bookmark: Omit<Bookmark, "id" | "createdAt">
): Promise<Bookmark> {
  return withFileLock(BOOKMARKS_FILE, async () => {
    const bookmarks = await readBookmarks()
    const newBookmark: Bookmark = {
      ...bookmark,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    bookmarks.push(newBookmark)
    await writeBookmarks(bookmarks)
    return newBookmark
  })
}

export async function removeBookmark(id: string): Promise<void> {
  return withFileLock(BOOKMARKS_FILE, async () => {
    const bookmarks = await readBookmarks()
    const filtered = bookmarks.filter((b) => b.id !== id)
    await writeBookmarks(filtered)
  })
}
