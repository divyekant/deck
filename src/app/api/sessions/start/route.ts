import { NextResponse } from "next/server";
import { startSession } from "@/lib/claude/process";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectDir, model, prompt } = body;

    if (!projectDir || typeof projectDir !== "string") {
      return NextResponse.json(
        { error: "projectDir is required" },
        { status: 400 }
      );
    }

    if (!model || typeof model !== "string") {
      return NextResponse.json(
        { error: "model is required" },
        { status: 400 }
      );
    }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    const allowedModels = ["sonnet", "opus", "haiku"];
    if (!allowedModels.includes(model)) {
      return NextResponse.json(
        { error: `model must be one of: ${allowedModels.join(", ")}` },
        { status: 400 }
      );
    }

    const result = startSession({ projectDir, model, prompt });

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
