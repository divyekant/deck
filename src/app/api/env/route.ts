import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

interface EnvFileEntry {
  projectName: string;
  projectDir: string;
  fileName: string;
  path: string;
  variableCount: number;
  size: number;
  inGitignore: boolean;
  isExposed: boolean;
}

/**
 * Extract the last segment as the readable project name.
 * e.g. "-Users-divyekant-Projects-kai" -> "kai"
 */
function readableProjectName(dirName: string): string {
  const segments = dirName.split("-").filter(Boolean);
  return segments[segments.length - 1] || dirName;
}

/**
 * Convert an escaped directory name back to the original filesystem path.
 * e.g. "-Users-divyekant-Projects-kai" -> "/Users/divyekant/Projects/kai"
 */
function dirNameToPath(dirName: string): string {
  if (dirName.startsWith("-")) {
    return "/" + dirName.slice(1).replace(/-/g, "/");
  }
  return dirName.replace(/-/g, "/");
}

/**
 * Count env variables in a file: non-empty lines that don't start with #.
 */
function countVariables(content: string): number {
  return content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    }).length;
}

/**
 * Check if a filename is covered by the project's .gitignore.
 * Reads .gitignore from the project root and checks for the filename or common
 * glob patterns like .env* or .env.*.
 */
async function isInGitignore(
  projectRoot: string,
  envFileName: string
): Promise<boolean> {
  try {
    const gitignorePath = path.join(projectRoot, ".gitignore");
    const content = await fs.readFile(gitignorePath, "utf-8");
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));

    for (const pattern of lines) {
      // Exact match
      if (pattern === envFileName) return true;
      // Glob patterns like .env* or .env.*
      if (pattern === ".env*" || pattern === ".env.*") return true;
      // Pattern with leading slash: /.env
      if (pattern === `/${envFileName}`) return true;
      // Wildcard match for patterns like *.env or .env.local
      if (pattern.includes("*")) {
        const regex = new RegExp(
          "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
        );
        if (regex.test(envFileName)) return true;
      }
    }
    return false;
  } catch {
    // No .gitignore found — file is not protected
    return false;
  }
}

export async function GET() {
  try {
    const results: EnvFileEntry[] = [];

    let projectEntries;
    try {
      projectEntries = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    } catch {
      return NextResponse.json([]);
    }

    for (const entry of projectEntries) {
      if (!entry.isDirectory()) continue;

      try {
        const dirName = entry.name as string;
        const projectName = readableProjectName(dirName);
        const actualProjectPath = dirNameToPath(dirName);

        // Read the actual project directory for .env* files
        let projectFiles;
        try {
          projectFiles = await fs.readdir(actualProjectPath, {
            withFileTypes: true,
          });
        } catch {
          // Project directory may not exist on disk
          continue;
        }

        const envFiles = projectFiles.filter(
          (f) => f.isFile() && f.name.startsWith(".env")
        );

        for (const envFile of envFiles) {
          try {
            const filePath = path.join(actualProjectPath, envFile.name);
            const stat = await fs.stat(filePath);
            const content = await fs.readFile(filePath, "utf-8");
            const variableCount = countVariables(content);
            const inGitignore = await isInGitignore(
              actualProjectPath,
              envFile.name
            );

            results.push({
              projectName,
              projectDir: dirName,
              fileName: envFile.name,
              path: filePath,
              variableCount,
              size: stat.size,
              inGitignore,
              isExposed: !inGitignore,
            });
          } catch {
            // Skip individual files that can't be read
            continue;
          }
        }
      } catch {
        // Skip projects that error during scanning
        continue;
      }
    }

    // Sort: exposed files first, then by project name
    results.sort((a, b) => {
      if (a.isExposed !== b.isExposed) return a.isExposed ? -1 : 1;
      return a.projectName.localeCompare(b.projectName);
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Failed to scan env files:", error);
    return NextResponse.json(
      { error: "Failed to scan env files" },
      { status: 500 }
    );
  }
}
