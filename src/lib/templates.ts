import { promises as fs } from "fs"
import path from "path"
import os from "os"
import crypto from "crypto"
import { withFileLock } from "./file-lock"

const DECK_DIR = path.join(os.homedir(), ".deck")
const TEMPLATES_FILE = path.join(DECK_DIR, "templates.json")

export interface Template {
  id: string
  name: string
  description: string
  prompt: string
  model?: string
  category: string
  isDefault: boolean
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "default-bug-fix",
    name: "Bug Fix",
    description: "Diagnose and fix a specific bug with clear expected vs actual behavior.",
    prompt:
      "Fix the following bug: [describe the issue]. The expected behavior is [X] but the actual behavior is [Y].",
    category: "Bug Fix",
    isDefault: true,
  },
  {
    id: "default-code-review",
    name: "Code Review",
    description: "Review code for potential issues, security concerns, and improvements.",
    prompt:
      "Review the following code for potential issues, security concerns, and improvements: [paste code or describe file]",
    category: "Code Review",
    isDefault: true,
  },
  {
    id: "default-feature-build",
    name: "Feature Build",
    description: "Implement a new feature with detailed requirements.",
    prompt:
      "Implement the following feature: [description]. Requirements: [list requirements]",
    category: "Feature",
    isDefault: true,
  },
  {
    id: "default-refactor",
    name: "Refactor",
    description: "Refactor code to improve readability, performance, or maintainability.",
    prompt:
      "Refactor [file/module] to improve [readability/performance/maintainability]. Current issues: [describe]",
    category: "Refactor",
    isDefault: true,
  },
  {
    id: "default-exploration",
    name: "Exploration",
    description: "Understand how specific code or concepts work.",
    prompt:
      "Explain how [concept/code] works. I want to understand [specific aspect].",
    category: "Exploration",
    isDefault: true,
  },
  {
    id: "default-documentation",
    name: "Documentation",
    description: "Generate documentation for components, APIs, or modules.",
    prompt:
      "Write documentation for [component/API/module]. Include: purpose, usage, parameters, examples.",
    category: "Documentation",
    isDefault: true,
  },
]

async function readCustomTemplates(): Promise<Template[]> {
  try {
    const raw = await fs.readFile(TEMPLATES_FILE, "utf-8")
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed as Template[]
    }
    return []
  } catch {
    return []
  }
}

async function writeCustomTemplates(templates: Template[]): Promise<void> {
  await fs.mkdir(DECK_DIR, { recursive: true })
  await fs.writeFile(
    TEMPLATES_FILE,
    JSON.stringify(templates, null, 2),
    "utf-8"
  )
}

export async function getTemplates(): Promise<Template[]> {
  const custom = await readCustomTemplates()
  return [...DEFAULT_TEMPLATES, ...custom]
}

export async function addTemplate(
  t: Omit<Template, "id" | "isDefault">
): Promise<Template> {
  return withFileLock(TEMPLATES_FILE, async () => {
    const custom = await readCustomTemplates()
    const newTemplate: Template = {
      ...t,
      id: crypto.randomUUID(),
      isDefault: false,
    }
    custom.push(newTemplate)
    await writeCustomTemplates(custom)
    return newTemplate
  })
}

export async function deleteTemplate(id: string): Promise<void> {
  return withFileLock(TEMPLATES_FILE, async () => {
    const custom = await readCustomTemplates()
    // Only allow deleting custom templates
    const filtered = custom.filter((t) => t.id !== id)
    await writeCustomTemplates(filtered)
  })
}
