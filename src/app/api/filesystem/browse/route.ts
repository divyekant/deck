import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, realpath } from "fs/promises";
import { resolve } from "path";
import { homedir } from "os";
import { expandTilde } from "@/lib/paths";

// Allowed path prefixes: home directory + any extra from DECK_ALLOWED_PATHS (comma-separated)
function getAllowedPrefixes(): string[] {
  const prefixes = [homedir()];
  const extra = process.env.DECK_ALLOWED_PATHS;
  if (extra) {
    prefixes.push(...extra.split(",").map((p) => p.trim()).filter(Boolean));
  }
  return prefixes;
}

function isUnderAllowedPrefix(realPath: string, prefixes: string[]): boolean {
  return prefixes.some((p) => realPath === p || realPath.startsWith(p + "/"));
}

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get("path") || homedir();
  const resolved = resolve(expandTilde(rawPath));

  // Security: only allow browsing under allowed prefixes
  // Use realpath to resolve symlinks before checking
  const allowedPrefixes = getAllowedPrefixes();
  let real: string;
  try {
    real = await realpath(resolved);
  } catch {
    real = resolved;
  }
  if (!isUnderAllowedPrefix(real, allowedPrefixes)) {
    return NextResponse.json({ error: "Path is outside allowed directories" }, { status: 403 });
  }

  try {
    const info = await stat(resolved);
    if (!info.isDirectory()) {
      return NextResponse.json({ error: "Not a directory" }, { status: 400 });
    }

    const entries = await readdir(resolved, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({
        name: e.name,
        path: resolve(resolved, e.name),
      }));

    return NextResponse.json({
      path: resolved,
      parent: resolve(resolved, ".."),
      directories: dirs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Cannot read directory: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 }
    );
  }
}
