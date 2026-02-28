import { NextRequest, NextResponse } from "next/server"
import { getFavorites, addFavorite, removeFavorite } from "@/lib/favorites"

export async function GET() {
  try {
    const favorites = await getFavorites()
    return NextResponse.json({ favorites })
  } catch (error) {
    console.error("Failed to get favorites:", error)
    return NextResponse.json(
      { error: "Failed to get favorites" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, targetId, label } = body

    if (!type || !targetId || !label) {
      return NextResponse.json(
        { error: "type, targetId, and label are required" },
        { status: 400 }
      )
    }

    if (!["session", "project", "page"].includes(type)) {
      return NextResponse.json(
        { error: "type must be 'session', 'project', or 'page'" },
        { status: 400 }
      )
    }

    if (typeof targetId !== "string" || typeof label !== "string") {
      return NextResponse.json(
        { error: "targetId and label must be strings" },
        { status: 400 }
      )
    }

    const favorite = await addFavorite({ type, targetId, label })
    return NextResponse.json({ favorite })
  } catch (error) {
    console.error("Failed to add favorite:", error)
    return NextResponse.json(
      { error: "Failed to add favorite" },
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

    await removeFavorite(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to remove favorite:", error)
    return NextResponse.json(
      { error: "Failed to remove favorite" },
      { status: 500 }
    )
  }
}
