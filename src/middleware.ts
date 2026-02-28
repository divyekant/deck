import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    const origin = request.headers.get("origin")
    if (origin) {
      const url = new URL(request.url)
      const allowed = origin === url.origin || origin === `http://localhost:${url.port}`
      if (!allowed) {
        return NextResponse.json({ error: "Cross-origin requests not allowed" }, { status: 403 })
      }
    }
  }
  return NextResponse.next()
}

export const config = { matcher: "/api/:path*" }
