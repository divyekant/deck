import { NextRequest, NextResponse } from "next/server"
import { getTemplates, addTemplate, deleteTemplate } from "@/lib/templates"

export async function GET() {
  try {
    const templates = await getTemplates()
    return NextResponse.json({ templates })
  } catch (error) {
    console.error("Failed to get templates:", error)
    return NextResponse.json(
      { error: "Failed to get templates" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, prompt, category, model } = body

    if (!name || !description || !prompt || !category) {
      return NextResponse.json(
        { error: "name, description, prompt, and category are required" },
        { status: 400 }
      )
    }

    const template = await addTemplate({
      name,
      description,
      prompt,
      category,
      ...(model ? { model } : {}),
    })
    return NextResponse.json({ template })
  } catch (error) {
    console.error("Failed to create template:", error)
    return NextResponse.json(
      { error: "Failed to create template" },
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

    await deleteTemplate(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Failed to delete template:", error)
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    )
  }
}
