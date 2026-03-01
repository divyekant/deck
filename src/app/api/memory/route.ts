import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import os from "os"

const CLAUDE_DIR = path.join(os.homedir(), ".claude")
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects")

const MAX_CONTENT_LENGTH = 10000

interface MemoryEntry {
  projectDir: string
  projectName: string
  fileName: string
  content: string
  lineCount: number
  size: number
  path: string
  lastModified: string
}

function decodeProjectName(dirName: string): string {
  // Dir name like `-Users-divyekant-Projects-deck` represents a path
  // Replace leading `-` with `/`, then remaining `-` with `/` to reconstruct
  const reconstructed = dirName.replace(/^-/, "/").replace(/-/g, "/")
  return path.basename(reconstructed)
}

export async function GET() {
  try {
    const entries: MemoryEntry[] = []

    let projectDirs: string[]
    try {
      projectDirs = await fs.readdir(PROJECTS_DIR)
    } catch {
      return NextResponse.json([])
    }

    for (const dirName of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, dirName)

      try {
        const stat = await fs.stat(projectPath)
        if (!stat.isDirectory()) continue
      } catch {
        continue
      }

      const memoryDir = path.join(projectPath, "memory")

      try {
        const stat = await fs.stat(memoryDir)
        if (!stat.isDirectory()) continue
      } catch {
        continue
      }

      let files: string[]
      try {
        files = await fs.readdir(memoryDir)
      } catch {
        continue
      }

      const mdFiles = files.filter((f) => f.endsWith(".md"))
      const projectName = decodeProjectName(dirName)

      for (const fileName of mdFiles) {
        const filePath = path.join(memoryDir, fileName)

        try {
          const [content, stat] = await Promise.all([
            fs.readFile(filePath, "utf-8"),
            fs.stat(filePath),
          ])

          const truncated = content.length > MAX_CONTENT_LENGTH
            ? content.slice(0, MAX_CONTENT_LENGTH) + "\n\n... (truncated)"
            : content

          entries.push({
            projectDir: dirName,
            projectName,
            fileName,
            content: truncated,
            lineCount: content.split("\n").length,
            size: stat.size,
            path: filePath.replace(os.homedir(), "~"),
            lastModified: stat.mtime.toISOString(),
          })
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Sort by project name, then file name
    entries.sort((a, b) => {
      const cmp = a.projectName.localeCompare(b.projectName)
      if (cmp !== 0) return cmp
      return a.fileName.localeCompare(b.fileName)
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error("Failed to scan memory files:", error)
    return NextResponse.json(
      { error: "Failed to scan memory files" },
      { status: 500 }
    )
  }
}
