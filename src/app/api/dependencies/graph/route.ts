import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");

interface GraphNode {
  id: string;
  name: string;
  depCount: number;
}

interface GraphLink {
  source: string;
  target: string;
  sharedDeps: string[];
}

interface GraphResponse {
  nodes: GraphNode[];
  links: GraphLink[];
}

function decodeDirName(dirName: string): string {
  // Convert `-Users-divyekant-Projects-foo` to `/Users/divyekant/Projects/foo`
  return "/" + dirName.replace(/^-/, "").replace(/-/g, "/");
}

function extractProjectName(decodedPath: string): string {
  return path.basename(decodedPath);
}

export async function GET() {
  try {
    const projectsDir = path.join(CLAUDE_DIR, "projects");

    let entries: string[];
    try {
      entries = await fs.readdir(projectsDir);
    } catch {
      return NextResponse.json({ nodes: [], links: [] });
    }

    // For each project dir, try to read its package.json
    const projectDeps: Map<string, Set<string>> = new Map();

    for (const entry of entries) {
      const entryPath = path.join(projectsDir, entry);
      const stat = await fs.stat(entryPath);
      if (!stat.isDirectory()) continue;

      const decodedPath = decodeDirName(entry);
      const pkgJsonPath = path.join(decodedPath, "package.json");

      try {
        const content = await fs.readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(content);
        const deps = new Set<string>();

        if (pkg.dependencies) {
          for (const name of Object.keys(pkg.dependencies)) {
            deps.add(name);
          }
        }
        if (pkg.devDependencies) {
          for (const name of Object.keys(pkg.devDependencies)) {
            deps.add(name);
          }
        }

        if (deps.size > 0) {
          projectDeps.set(entry, deps);
        }
      } catch {
        // Project doesn't have a package.json or it's not readable — skip
        continue;
      }
    }

    // Build nodes
    const nodes: GraphNode[] = [];
    for (const [dirName, deps] of projectDeps) {
      const decodedPath = decodeDirName(dirName);
      nodes.push({
        id: dirName,
        name: extractProjectName(decodedPath),
        depCount: deps.size,
      });
    }

    // Build links — find shared dependencies between each pair of projects
    const links: GraphLink[] = [];
    const dirNames = Array.from(projectDeps.keys());

    for (let i = 0; i < dirNames.length; i++) {
      for (let j = i + 1; j < dirNames.length; j++) {
        const depsA = projectDeps.get(dirNames[i])!;
        const depsB = projectDeps.get(dirNames[j])!;

        const shared: string[] = [];
        for (const dep of depsA) {
          if (depsB.has(dep)) {
            shared.push(dep);
          }
        }

        if (shared.length > 0) {
          shared.sort();
          links.push({
            source: dirNames[i],
            target: dirNames[j],
            sharedDeps: shared,
          });
        }
      }
    }

    // Sort nodes by depCount descending
    nodes.sort((a, b) => b.depCount - a.depCount);
    // Sort links by shared count descending
    links.sort((a, b) => b.sharedDeps.length - a.sharedDeps.length);

    const response: GraphResponse = { nodes, links };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to build dependency graph:", error);
    return NextResponse.json(
      { error: "Failed to build dependency graph" },
      { status: 500 }
    );
  }
}
