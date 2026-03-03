import { getRunningSession } from "@/lib/claude/process";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getRunningSession(id);

  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Capture in a const so TypeScript knows it's defined inside the closure
  const s = session;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(data: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Controller closed, clean up
          cleanup();
        }
      }

      function cleanup() {
        if (closed) return;
        closed = true;
        s.listeners.delete(onLine);
        s.exitListeners.delete(onExit);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }

      // Send an initial comment to flush headers immediately
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Send all accumulated output first
      for (const line of s.output) {
        send(line);
      }

      // If truly exited (not just idle), send done and close
      if (s.exited) {
        send(JSON.stringify({ type: "done", exitCode: s.exitCode }));
        cleanup();
        return;
      }

      // If session is idle (waiting for next prompt), signal it
      if (s.idle) {
        send(JSON.stringify({ type: "idle" }));
      }

      // Subscribe to new lines
      function onLine(line: string) {
        send(line);
        // Detect idle: if this is a result message, send idle signal
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === "result") {
            send(JSON.stringify({ type: "idle" }));
          }
        } catch {
          // not JSON, skip idle detection
        }
      }

      function onExit(code: number | null) {
        send(JSON.stringify({ type: "done", exitCode: code }));
        cleanup();
      }

      s.listeners.add(onLine);
      s.exitListeners.add(onExit);

      // Send periodic keepalive to prevent connection timeout
      const keepalive = setInterval(() => {
        if (closed) { clearInterval(keepalive); return; }
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
          cleanup();
        }
      }, 15000);
    },

    cancel() {
      // Client disconnected — listeners will be cleaned up by the
      // closed flag in send/cleanup
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
