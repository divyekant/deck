import { homedir } from "os";

/**
 * Expand ~ to the user's home directory.
 * Uses DECK_USER_HOME env var if set (for Docker where homedir() differs from host).
 */
export function expandTilde(path: string): string {
  const home = process.env.DECK_USER_HOME || homedir();
  if (path === "~") return home;
  if (path.startsWith("~/")) return home + path.slice(1);
  return path;
}
