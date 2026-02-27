import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { startSession } from "@/lib/claude/process";
import { MODEL_PRICING } from "@/lib/claude/costs";

const ALLOWED_MODELS = [
  "sonnet",
  "opus",
  "haiku",
  ...Object.keys(MODEL_PRICING),
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectDir, model, prompt } = body;

    // Validate projectDir
    if (!projectDir || typeof projectDir !== "string" || !projectDir.trim()) {
      return NextResponse.json(
        { error: "projectDir is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    try {
      await access(projectDir.trim());
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

    const result = startSession({
      projectDir: projectDir.trim(),
      model: model.trim(),
      prompt: prompt.trim(),
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
