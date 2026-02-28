import { promises as fs } from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"
import { withFileLock } from "./file-lock"

const DECK_DIR = path.join(os.homedir(), ".deck")
const FAVORITES_FILE = path.join(DECK_DIR, "favorites.json")

export interface Favorite {
  id: string
  type: "session" | "project" | "page"
  targetId: string
  label: string
  addedAt: string
}

async function readFavorites(): Promise<Favorite[]> {
  try {
    const raw = await fs.readFile(FAVORITES_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed as Favorite[]
    }
    return []
  } catch {
    return []
  }
}

async function writeFavorites(favorites: Favorite[]): Promise<void> {
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(
    FAVORITES_FILE,
    JSON.stringify(favorites, null, 2),
    "utf-8"
  )
}

export async function getFavorites(): Promise<Favorite[]> {
  return readFavorites()
}

export async function addFavorite(
  fav: Omit<Favorite, "id" | "addedAt">
): Promise<Favorite> {
  return withFileLock(FAVORITES_FILE, async () => {
    const favorites = await readFavorites()
    const newFavorite: Favorite = {
      ...fav,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    }
    favorites.push(newFavorite)
    await writeFavorites(favorites)
    return newFavorite
  })
}

export async function removeFavorite(id: string): Promise<void> {
  return withFileLock(FAVORITES_FILE, async () => {
    const favorites = await readFavorites()
    const filtered = favorites.filter((f) => f.id !== id)
    await writeFavorites(filtered)
  })
}

export async function isFavorite(
  type: string,
  targetId: string
): Promise<boolean> {
  const favorites = await readFavorites()
  return favorites.some((f) => f.type === type && f.targetId === targetId)
}
