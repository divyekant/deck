import { NextRequest, NextResponse } from "next/server"
import { getPrefs, savePrefs, ALL_WIDGET_IDS, WidgetId } from "@/lib/dashboard-prefs"

export async function GET() {
  try {
    const prefs = await getPrefs()
    return NextResponse.json({ prefs })
  } catch (error) {
    console.error("Failed to get dashboard prefs:", error)
    return NextResponse.json(
      { error: "Failed to get dashboard prefs" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { visibleWidgets } = body

    if (!Array.isArray(visibleWidgets)) {
      return NextResponse.json(
        { error: "visibleWidgets must be an array" },
        { status: 400 }
      )
    }

    const validIds = new Set<string>(ALL_WIDGET_IDS)
    const invalid = visibleWidgets.filter((id: string) => !validIds.has(id))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid widget IDs: ${invalid.join(", ")}` },
        { status: 400 }
      )
    }

    const prefs = { visibleWidgets: visibleWidgets as WidgetId[] }
    await savePrefs(prefs)
    return NextResponse.json({ prefs })
  } catch (error) {
    console.error("Failed to save dashboard prefs:", error)
    return NextResponse.json(
      { error: "Failed to save dashboard prefs" },
      { status: 500 }
    )
  }
}
