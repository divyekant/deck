import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { startSession, type CliTool } from "@/lib/claude/process";
import { MODEL_PRICING } from "@/lib/claude/costs";
import { expandTilde } from "@/lib/paths";

const ALLOWED_MODELS = [
  "sonnet",
  "opus",
  "haiku",
  ...Object.keys(MODEL_PRICING),
];

const ALLOWED_CLIS: CliTool[] = ["claude", "codex"];

// Flags that are already covered by explicit options or are security-sensitive
const DENIED_FLAGS = [
  "--dangerously-skip-permissions",
  "--enable-remote-control",
  "--model",
  "--session-id",
  "--output-format",
  "--max-turns",
  "--system-prompt",
  "-p",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectDir, model, prompt, cli: rawCli, skipPermissions, remoteControl, maxTurns, systemPrompt, additionalFlags } = body;
    const cli: CliTool = ALLOWED_CLIS.includes(rawCli) ? rawCli : "claude";

    // Validate projectDir
    if (!projectDir || typeof projectDir !== "string" || !projectDir.trim()) {
      return NextResponse.json(
        { error: "projectDir is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const resolvedDir = expandTilde(projectDir.trim());

    try {
      await access(resolvedDir);
    } catch {
      return NextResponse.json(
        { error: `projectDir does not exist or is not accessible: ${projectDir}` },
        { status: 400 }
      );
    }

    // Validate model
    if (!model || typeof model !== "string" || !model.trim()) {
      return NextResponse.json(
        { error: "model is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!ALLOWED_MODELS.includes(model.trim())) {
      return NextResponse.json(
        { error: `model must be one of: ${ALLOWED_MODELS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate prompt
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json(
        { error: "prompt is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const result = await startSession({
      projectDir: resolvedDir,
      model: model.trim(),
      prompt: prompt.trim(),
      cli,
      skipPermissions: !!skipPermissions,
      remoteControl: !!remoteControl,
      maxTurns: maxTurns ? Number(maxTurns) : undefined,
      systemPrompt: systemPrompt || undefined,
      additionalFlags: additionalFlags
        ? String(additionalFlags).split(/\s+/).filter(Boolean).filter((f: string) => !DENIED_FLAGS.includes(f.split("=")[0]))
        : undefined,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: result.id });
  } catch (error) {
    console.error("Failed to start session:", error);
    return NextResponse.json(
      { error: "Failed to start session" },
      { status: 500 }
    );
  }
}
