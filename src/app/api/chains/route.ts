import { NextRequest, NextResponse } from "next/server"

import {
  getChains,
  createChain,
  addToChain,
  deleteChain,
} from "@/lib/chains"
import { listSessions } from "@/lib/claude/sessions"
import type { SessionMeta } from "@/lib/claude/types"

interface EnrichedChain {
  id: string
  name: string
  sessionIds: string[]
  sessions: SessionMeta[]
  totalCost: number
  totalDuration: number
  sessionCount: number
  dateRange: { start: string; end: string } | null
  projects: string[]
  createdAt: string
  updatedAt: string
}

export async function GET() {
  try {
    const [chains, allSessions] = await Promise.all([
      getChains(),
      listSessions(),
    ])

    // Build a lookup map for fast session resolution
    const sessionMap = new Map<string, SessionMeta>()
    for (const s of allSessions) {
      sessionMap.set(s.id, s)
    }

    const enriched: EnrichedChain[] = chains.map((chain) => {
      const sessions: SessionMeta[] = []
      let totalCost = 0
      let totalDuration = 0
      const projectSet = new Set<string>()
      let earliest: string | null = null
      let latest: string | null = null

      for (const sid of chain.sessionIds) {
        const meta = sessionMap.get(sid)
        if (!meta) continue

        sessions.push(meta)
        totalCost += meta.estimatedCost
        totalDuration += meta.duration
        projectSet.add(meta.projectName)

        if (!earliest || meta.startTime < earliest) earliest = meta.startTime
        if (!latest || meta.startTime > latest) latest = meta.startTime
      }

      // Sort sessions chronologically (oldest first)
      sessions.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )

      return {
        id: chain.id,
        name: chain.name,
        sessionIds: chain.sessionIds,
        sessions,
        totalCost,
        totalDuration,
        sessionCount: sessions.length,
        dateRange:
          earliest && latest ? { start: earliest, end: latest } : null,
        projects: Array.from(projectSet).sort(),
        createdAt: chain.createdAt,
        updatedAt: chain.updatedAt,
      }
    })

    return NextResponse.json({ chains: enriched })
  } catch (error) {
    console.error("Failed to get chains:", error)
    return NextResponse.json(
      { error: "Failed to get chains" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Add session to existing chain
    if (body.chainId && body.sessionId) {
      const chain = await addToChain(body.chainId, body.sessionId)
      return NextResponse.json({ chain })
    }

    // Create new chain
    if (body.name && Array.isArray(body.sessionIds)) {
      const chain = await createChain(body.name, body.sessionIds)
      return NextResponse.json({ chain }, { status: 201 })
    }

    return NextResponse.json(
      { error: "Invalid request body. Provide { name, sessionIds } or { chainId, sessionId }." },
      { status: 400 }
    )
  } catch (error) {
    console.error("Failed to create/update chain:", error)
    return NextResponse.json(
      { error: "Failed to create/update chain" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")
    if (!id) {
      return NextResponse.json(
        { error: "Missing chain id parameter" },
        { status: 400 }
      )
    }

    await deleteChain(id)
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("Failed to delete chain:", error)
    return NextResponse.json(
      { error: "Failed to delete chain" },
      { status: 500 }
    )
  }
}
