import { NextRequest, NextResponse } from "next/server"
import {
  getAnnotations,
  getAllTags,
  setSessionTags,
  setSessionNote,
  addNote,
  removeNote,
  addTag,
  removeTag,
} from "@/lib/annotations"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (sessionId) {
      const annotation = await getAnnotations(sessionId)
      return NextResponse.json(annotation)
    }

    // No sessionId — return all annotations + allTags (backward compat)
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
    const { sessionId, action } = body

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required and must be a string" },
        { status: 400 }
      )
    }

    // New action-based API
    if (action) {
      switch (action) {
        case "addNote": {
          const { text } = body
          if (!text || typeof text !== "string") {
            return NextResponse.json(
              { error: "text is required for addNote" },
              { status: 400 }
            )
          }
          const note = await addNote(sessionId, text)
          return NextResponse.json({ ok: true, note })
        }

        case "removeNote": {
          const { noteId } = body
          if (!noteId || typeof noteId !== "string") {
            return NextResponse.json(
              { error: "noteId is required for removeNote" },
              { status: 400 }
            )
          }
          await removeNote(sessionId, noteId)
          return NextResponse.json({ ok: true })
        }

        case "addTag": {
          const { tag } = body
          if (!tag || typeof tag !== "string") {
            return NextResponse.json(
              { error: "tag is required for addTag" },
              { status: 400 }
            )
          }
          await addTag(sessionId, tag)
          return NextResponse.json({ ok: true })
        }

        case "removeTag": {
          const { tag } = body
          if (!tag || typeof tag !== "string") {
            return NextResponse.json(
              { error: "tag is required for removeTag" },
              { status: 400 }
            )
          }
          await removeTag(sessionId, tag)
          return NextResponse.json({ ok: true })
        }

        default:
          return NextResponse.json(
            { error: `Unknown action: ${action}` },
            { status: 400 }
          )
      }
    }

    // Legacy API: direct tags/note fields (backward compat for sessions list bulk-tag)
    const { tags, note } = body

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
