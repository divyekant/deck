import { NextResponse } from "next/server";
import { getRunningSessionsList } from "@/lib/claude/process";

export async function GET() {
  try {
    const sessions = getRunningSessionsList();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Failed to list running sessions:", error);
    return NextResponse.json(
      { error: "Failed to list running sessions" },
      { status: 500 }
    );
  }
}
