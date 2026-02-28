import { NextRequest, NextResponse } from "next/server"
import { getBookmarks, addBookmark, removeBookmark } from "@/lib/bookmarks"

export async function GET() {
  try {
    const bookmarks = await getBookmarks()
    const sorted = bookmarks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    return NextResponse.json({ bookmarks: sorted })
  } catch (error) {
    console.error("Failed to get bookmarks:", error)
    return NextResponse.json(
      { error: "Failed to get bookmarks" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, messageIndex, messagePreview, project } = body

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required and must be a string" },
        { status: 400 }
      )
    }

    if (typeof messageIndex !== "number") {
      return NextResponse.json(
        { error: "messageIndex is required and must be a number" },
        { status: 400 }
      )
    }

    if (!messagePreview || typeof messagePreview !== "string") {
      return NextResponse.json(
        { error: "messagePreview is required and must be a string" },
        { status: 400 }
      )
    }

    if (!project || typeof project !== "string") {
      return NextResponse.json(
        { error: "project is required and must be a string" },
        { status: 400 }
      )
    }

    const bookmark = await addBookmark({
      sessionId,
      messageIndex,
      messagePreview,
      project,
    })
    return NextResponse.json({ bookmark })
  } catch (error) {
    console.error("Failed to add bookmark:", error)
    return NextResponse.json(
      { error: "Failed to add bookmark" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      )
    }

    await removeBookmark(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to remove bookmark:", error)
    return NextResponse.json(
      { error: "Failed to remove bookmark" },
      { status: 500 }
    )
  }
}
