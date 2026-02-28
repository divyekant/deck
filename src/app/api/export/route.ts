import { NextRequest, NextResponse } from "next/server"
import { listSessions, getSession } from "@/lib/claude/sessions"
import { sessionToMarkdown } from "@/lib/claude/export"
import { sessionsToCSV } from "@/lib/csv"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionIds, format } = body

    // Validate sessionIds
    if (
      !Array.isArray(sessionIds) ||
      sessionIds.length === 0 ||
      !sessionIds.every((id: unknown) => typeof id === "string")
    ) {
      return NextResponse.json(
        { error: "sessionIds must be a non-empty array of strings" },
        { status: 400 }
      )
    }

    // Validate format
    if (format !== "csv" && format !== "markdown") {
      return NextResponse.json(
        { error: 'format must be "csv" or "markdown"' },
        { status: 400 }
      )
    }

    if (format === "csv") {
      const allSessions = await listSessions()
      const idSet = new Set(sessionIds as string[])
      const matched = allSessions.filter((s) => idSet.has(s.id))
      const csv = sessionsToCSV(matched)

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition":
            'attachment; filename="deck-sessions-export.csv"',
        },
      })
    }

    // format === "markdown"
    const markdownParts: string[] = []
    for (const id of sessionIds as string[]) {
      const detail = await getSession(id)
      if (detail) {
        markdownParts.push(sessionToMarkdown(detail))
      }
    }

    const markdown = markdownParts.join("\n\n---\n\n")

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition":
          'attachment; filename="deck-sessions-export.md"',
      },
    })
  } catch (error) {
    console.error("Failed to export sessions:", error)
    return NextResponse.json(
      { error: "Failed to export sessions" },
      { status: 500 }
    )
  }
}
