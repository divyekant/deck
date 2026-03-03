// Per-project workspace preferences stored in localStorage

export interface ProjectPrefs {
  cli: "claude" | "codex"
  model: string
  skipPermissions: boolean
  remoteControl: boolean
  chromeMcp: boolean
  maxTurns: string
  systemPrompt: string
  additionalFlags: string
}

const STORAGE_PREFIX = "deck-project-prefs-"

const DEFAULTS: ProjectPrefs = {
  cli: "claude",
  model: "sonnet",
  skipPermissions: false,
  remoteControl: false,
  chromeMcp: false,
  maxTurns: "",
  systemPrompt: "",
  additionalFlags: "",
}

export function getProjectPrefs(projectDir: string): ProjectPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + projectDir)
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) }
  } catch {}
  return { ...DEFAULTS }
}

export function saveProjectPrefs(projectDir: string, prefs: Partial<ProjectPrefs>): void {
  try {
    const current = getProjectPrefs(projectDir)
    localStorage.setItem(STORAGE_PREFIX + projectDir, JSON.stringify({ ...current, ...prefs }))
  } catch {}
}
