import { promises as fs } from "fs"
import path from "path"
import os from "os"

const DECK_DIR = path.join(os.homedir(), ".deck")
const BOOKMARKS_FILE = path.join(DECK_DIR, "bookmarks.json")

export async function getBookmarks(): Promise<string[]> {
  try {
    const raw = await fs.readFile(BOOKMARKS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    return []
  } catch {
    return []
  }
}

async function saveBookmarks(bookmarks: string[]): Promise<void> {
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2), "utf-8")
}

export async function toggleBookmark(sessionId: string): Promise<boolean> {
  const bookmarks = await getBookmarks()
  const index = bookmarks.indexOf(sessionId)
  if (index >= 0) {
    bookmarks.splice(index, 1)
    await saveBookmarks(bookmarks)
    return false
  } else {
    bookmarks.push(sessionId)
    await saveBookmarks(bookmarks)
    return true
  }
}

export async function isBookmarked(sessionId: string): Promise<boolean> {
  const bookmarks = await getBookmarks()
  return bookmarks.includes(sessionId)
}
