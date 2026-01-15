/**
 * =============================================================================
 * DEBUG STREAM SSE ENDPOINT
 * =============================================================================
 *
 * Server-Sent Events endpoint for streaming API debug logs to the client.
 * Only active when NEXT_PUBLIC_ENABLE_DEBUG_STREAM=true
 * =============================================================================
 */

import { debugLogEmitter, type DebugLogEntry } from "@/lib/debug-log-emitter"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  // Check if debug mode is enabled
  if (process.env.NEXT_PUBLIC_ENABLE_DEBUG_STREAM !== "true") {
    return new Response(JSON.stringify({ error: "Debug stream is disabled" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const connectMsg = {
        id: "connect",
        timestamp: new Date().toISOString(),
        type: "info",
        source: "debug-stream",
        body: "Connected to debug stream",
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectMsg)}\n\n`))

      // Handler for log events
      const logHandler = (entry: DebugLogEntry) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`))
        } catch (e) {
          // Stream closed
          debugLogEmitter.off("log", logHandler)
        }
      }

      // Subscribe to log events
      debugLogEmitter.on("log", logHandler)

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch (e) {
          clearInterval(heartbeat)
          debugLogEmitter.off("log", logHandler)
        }
      }, 30000)

      // Cleanup on close
      return () => {
        clearInterval(heartbeat)
        debugLogEmitter.off("log", logHandler)
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
