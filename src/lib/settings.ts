import { promises as fs } from "fs"
import path from "path"
import os from "os"

export interface DeckSettings {
  budget: number          // monthly budget in USD
  budgetResetDay: number  // day of month to reset budget tracking (1-28)
  theme: "dark" | "light" // for future use
}

const DEFAULTS: DeckSettings = {
  budget: 500,
  budgetResetDay: 1,
  theme: "dark",
}

const SETTINGS_DIR = path.join(os.homedir(), ".deck")
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json")

export async function getSettings(): Promise<DeckSettings> {
  try {
    const raw = await fs.readFile(SETTINGS_FILE, "utf-8")
    const stored = JSON.parse(raw)
    return { ...DEFAULTS, ...stored }
  } catch {
    // File doesn't exist or is invalid — return defaults
    return { ...DEFAULTS }
  }
}

export async function updateSettings(
  partial: Partial<DeckSettings>
): Promise<DeckSettings> {
  const current = await getSettings()
  const merged = { ...current, ...partial }

  // Validate
  if (merged.budget < 0) merged.budget = 0
  if (merged.budgetResetDay < 1) merged.budgetResetDay = 1
  if (merged.budgetResetDay > 28) merged.budgetResetDay = 28

  await fs.mkdir(SETTINGS_DIR, { recursive: true })
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2), "utf-8")

  return merged
}
