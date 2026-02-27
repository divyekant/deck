import { NextResponse } from "next/server";
import { resumeSession } from "@/lib/claude/process";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, prompt } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt is required" },
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
