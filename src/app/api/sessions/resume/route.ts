import { NextResponse } from "next/server";
import { resumeSession } from "@/lib/claude/process";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, prompt } = body;

    // Validate sessionId
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(sessionId)) {
      return NextResponse.json(
        { error: "sessionId must be a valid UUID format" },
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

    const result = resumeSession({ sessionId, prompt: prompt.trim() });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: result.id });
  } catch (error) {
    console.error("Failed to resume session:", error);
    return NextResponse.json(
      { error: "Failed to resume session" },
      { status: 500 }
    );
  }
}
