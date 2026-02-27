import { NextRequest, NextResponse } from "next/server";

import { listSessions } from "@/lib/claude/sessions";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "50", 10) || 50));

    const allSessions = await listSessions();
    const total = allSessions.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);

    const start = (safePage - 1) * limit;
    const end = start + limit;
    const sessions = allSessions.slice(start, end);

    return NextResponse.json({
      sessions,
      total,
      page: safePage,
      totalPages,
    });
  } catch (error) {
    console.error("Failed to list sessions:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}
