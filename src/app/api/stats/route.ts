import { NextResponse } from "next/server";

import { getOverviewStats } from "@/lib/claude/sessions";

export async function GET() {
  try {
    const stats = await getOverviewStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get overview stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
