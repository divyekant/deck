import { NextRequest, NextResponse } from "next/server";

import { listSessions } from "@/lib/claude/sessions";
import type { SessionMeta } from "@/lib/claude/types";

// ---- Activity Event Types ----

interface ActivityEvent {
  type: "session_started" | "session_ended" | "high_cost" | "long_session";
  description: string;
  project: string;
  sessionId: string;
  timestamp: string;
  cost?: number;
}

// ---- Thresholds ----

const HIGH_COST_THRESHOLD = 1; // dollars
const LONG_SESSION_THRESHOLD = 30; // messages

// ---- Event Generation ----

function generateEvents(session: SessionMeta): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  // Session started
  events.push({
    type: "session_started",
    description: `Session started in ${session.projectName}`,
    project: session.projectName,
    sessionId: session.id,
    timestamp: session.startTime,
  });

  // Session ended (only if endTime differs from startTime, indicating actual activity)
  if (session.endTime && session.endTime !== session.startTime) {
    events.push({
      type: "session_ended",
      description: `Session ended in ${session.projectName} (${session.messageCount} messages)`,
      project: session.projectName,
      sessionId: session.id,
      timestamp: session.endTime,
    });
  }

  // High cost alert
  if (session.estimatedCost >= HIGH_COST_THRESHOLD) {
    events.push({
      type: "high_cost",
      description: `High cost session in ${session.projectName}: $${session.estimatedCost.toFixed(2)}`,
      project: session.projectName,
      sessionId: session.id,
      timestamp: session.endTime || session.startTime,
      cost: session.estimatedCost,
    });
  }

  // Long session alert
  if (session.messageCount >= LONG_SESSION_THRESHOLD) {
    events.push({
      type: "long_session",
      description: `Long session in ${session.projectName}: ${session.messageCount} messages`,
      project: session.projectName,
      sessionId: session.id,
      timestamp: session.endTime || session.startTime,
    });
  }

  return events;
}

// ---- API Route ----

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.max(
      1,
      Math.min(500, parseInt(searchParams.get("limit") || "50", 10) || 50)
    );

    const sessions = await listSessions();

    // Generate all events from all sessions
    const allEvents: ActivityEvent[] = [];
    for (const session of sessions) {
      const events = generateEvents(session);
      allEvents.push(...events);
    }

    // Sort by timestamp descending (most recent first)
    allEvents.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply limit
    const events = allEvents.slice(0, limit);

    return NextResponse.json({ events, total: allEvents.length });
  } catch (error) {
    console.error("Failed to generate activity feed:", error);
    return NextResponse.json(
      { error: "Failed to generate activity feed" },
      { status: 500 }
    );
  }
}
