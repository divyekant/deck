import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface DependencyEntry {
  name: string;
  specifiedVersion: string;
  installedVersion: string | null;
  type: "dependency" | "devDependency";
}

interface DependenciesResponse {
  dependencies: DependencyEntry[];
  totalDeps: number;
  totalDevDeps: number;
}

async function getInstalledVersion(
  pkgName: string,
  cwd: string
): Promise<string | null> {
  try {
    const pkgJsonPath = path.join(cwd, "node_modules", pkgName, "package.json");
    const content = await fs.readFile(pkgJsonPath, "utf-8");
    const parsed = JSON.parse(content);
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const cwd = process.cwd();
    const pkgPath = path.join(cwd, "package.json");
    const content = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content);

    const deps: Record<string, string> = pkg.dependencies ?? {};
    const devDeps: Record<string, string> = pkg.devDependencies ?? {};

    const entries: DependencyEntry[] = [];

    for (const [name, version] of Object.entries(deps)) {
      const installedVersion = await getInstalledVersion(name, cwd);
      entries.push({
        name,
        specifiedVersion: version,
        installedVersion,
        type: "dependency",
      });
    }

    for (const [name, version] of Object.entries(devDeps)) {
      const installedVersion = await getInstalledVersion(name, cwd);
      entries.push({
        name,
        specifiedVersion: version,
        installedVersion,
        type: "devDependency",
      });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    const response: DependenciesResponse = {
      dependencies: entries,
      totalDeps: Object.keys(deps).length,
      totalDevDeps: Object.keys(devDeps).length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to read dependencies:", error);
    return NextResponse.json(
      { error: "Failed to read dependencies" },
      { status: 500 }
    );
  }
}
