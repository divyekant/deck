import { promises as fs } from "fs"
import path from "path"
import os from "os"

const DECK_DIR = path.join(os.homedir(), ".deck")
const PREFS_FILE = path.join(DECK_DIR, "dashboard-prefs.json")

export const ALL_WIDGET_IDS = [
  "stats",
  "activity-chart",
  "cost-trend",
  "budget",
  "work-hours",
  "cost-model",
  "streak",
  "highlights",
  "favorites",
  "digest",
  "recent-sessions",
] as const

export type WidgetId = (typeof ALL_WIDGET_IDS)[number]

export interface DashboardPrefs {
  visibleWidgets: WidgetId[]
}

const DEFAULT_PREFS: DashboardPrefs = {
  visibleWidgets: [...ALL_WIDGET_IDS],
}

async function readPrefs(): Promise<DashboardPrefs> {
  try {
    const raw = await fs.readFile(PREFS_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.visibleWidgets)) {
      return parsed as DashboardPrefs
    }
    return { ...DEFAULT_PREFS }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

async function writePrefs(prefs: DashboardPrefs): Promise<void> {
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(PREFS_FILE, JSON.stringify(prefs, null, 2), "utf-8")
}

export async function getPrefs(): Promise<DashboardPrefs> {
  return readPrefs()
}

export async function savePrefs(prefs: DashboardPrefs): Promise<void> {
  await writePrefs(prefs)
}
