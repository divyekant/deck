import { NextRequest, NextResponse } from "next/server"
import { getBookmarks, toggleBookmark } from "@/lib/bookmarks"

export async function GET() {
  try {
    const bookmarks = await getBookmarks()
    return NextResponse.json({ bookmarks })
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
    const { sessionId } = body

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required and must be a string" },
        { status: 400 }
      )
    }

    const bookmarked = await toggleBookmark(sessionId)
    return NextResponse.json({ bookmarked })
  } catch (error) {
    console.error("Failed to toggle bookmark:", error)
    return NextResponse.json(
      { error: "Failed to toggle bookmark" },
      { status: 500 }
    )
  }
}
