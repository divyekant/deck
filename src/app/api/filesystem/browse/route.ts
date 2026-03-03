import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, realpath } from "fs/promises";
import { resolve } from "path";
import { homedir } from "os";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") || homedir();
  const resolved = resolve(path);

  // Security: only allow browsing under home directory
  // Use realpath to resolve symlinks before checking
  const home = homedir();
  let real: string;
  try {
    real = await realpath(resolved);
  } catch {
    real = resolved;
  }
  if (real !== home && !real.startsWith(home + "/")) {
    return NextResponse.json({ error: "Path must be under home directory" }, { status: 403 });
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
