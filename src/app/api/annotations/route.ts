import { NextRequest, NextResponse } from "next/server"
import {
  getAnnotations,
  getAllTags,
  setSessionTags,
  setSessionNote,
} from "@/lib/annotations"

export async function GET() {
  try {
    const [annotations, allTags] = await Promise.all([
      getAnnotations(),
      getAllTags(),
    ])
    return NextResponse.json({ annotations, allTags })
  } catch (error) {
    console.error("Failed to get annotations:", error)
    return NextResponse.json(
      { error: "Failed to get annotations" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, tags, note } = body

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required and must be a string" },
        { status: 400 }
      )
    }

    if (tags !== undefined) {
      if (
        !Array.isArray(tags) ||
        !tags.every((t: unknown) => typeof t === "string")
      ) {
        return NextResponse.json(
          { error: "tags must be an array of strings" },
          { status: 400 }
        )
      }
      await setSessionTags(sessionId, tags)
    }

    if (note !== undefined) {
      if (typeof note !== "string") {
        return NextResponse.json(
          { error: "note must be a string" },
          { status: 400 }
        )
      }
      await setSessionNote(sessionId, note)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to update annotation:", error)
    return NextResponse.json(
      { error: "Failed to update annotation" },
      { status: 500 }
    )
  }
}
