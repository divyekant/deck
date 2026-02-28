import { promises as fs } from "fs"
import path from "path"
import os from "os"

const DECK_DIR = path.join(os.homedir(), ".deck")
const ANNOTATIONS_FILE = path.join(DECK_DIR, "annotations.json")

export const SUGGESTED_TAGS = [
  "bug-fix",
  "feature",
  "refactor",
  "exploration",
  "review",
]

export interface SessionAnnotation {
  tags: string[]
  note: string
}

type AnnotationsMap = Record<string, SessionAnnotation>

async function readAnnotations(): Promise<AnnotationsMap> {
  try {
    const raw = await fs.readFile(ANNOTATIONS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as AnnotationsMap
    }
    return {}
  } catch {
    return {}
  }
}

async function writeAnnotations(annotations: AnnotationsMap): Promise<void> {
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(
    ANNOTATIONS_FILE,
    JSON.stringify(annotations, null, 2),
    "utf-8"
  )
}

export async function getAnnotations(): Promise<AnnotationsMap> {
  return readAnnotations()
}

export async function getSessionAnnotation(
  sessionId: string
): Promise<SessionAnnotation> {
  const annotations = await readAnnotations()
  return annotations[sessionId] ?? { tags: [], note: "" }
}

export async function setSessionTags(
  sessionId: string,
  tags: string[]
): Promise<void> {
  const annotations = await readAnnotations()
  const existing = annotations[sessionId] ?? { tags: [], note: "" }
  annotations[sessionId] = { ...existing, tags }
  await writeAnnotations(annotations)
}

export async function setSessionNote(
  sessionId: string,
  note: string
): Promise<void> {
  const annotations = await readAnnotations()
  const existing = annotations[sessionId] ?? { tags: [], note: "" }
  annotations[sessionId] = { ...existing, note }
  await writeAnnotations(annotations)
}

export async function getAllTags(): Promise<string[]> {
  const annotations = await readAnnotations()
  const tagSet = new Set<string>()
  for (const entry of Object.values(annotations)) {
    for (const tag of entry.tags) {
      tagSet.add(tag)
    }
  }
  return Array.from(tagSet).sort()
}
