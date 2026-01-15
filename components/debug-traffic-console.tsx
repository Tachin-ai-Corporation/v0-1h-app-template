"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Terminal,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Circle,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Info,
} from "lucide-react"
import type { DebugLogEntry } from "@/lib/debug-log-emitter"

function formatLogForConsole(entry: DebugLogEntry): void {
  const timestamp = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const prefix = `[1health API] [${timestamp}] [${entry.source}]`

  if (entry.type === "request") {
    console.group(`${prefix} → REQUEST`)
    console.log(`%c${entry.method} ${entry.url}`, "color: #60a5fa; font-weight: bold")
    if (entry.headers && Object.keys(entry.headers).length > 0) {
      console.log("Headers:", entry.headers)
    }
    if (entry.body) {
      console.log("Body:", typeof entry.body === "string" ? entry.body : JSON.stringify(entry.body, null, 2))
    }
    console.groupEnd()
  } else if (entry.type === "response") {
    const statusColor = entry.status && entry.status >= 200 && entry.status < 300 ? "#4ade80" : "#f87171"
    console.group(`${prefix} ← RESPONSE`)
    console.log(`%c${entry.method} ${entry.url}`, "color: #60a5fa")
    console.log(`%cStatus: ${entry.status}`, `color: ${statusColor}; font-weight: bold`)
    if (entry.duration) {
      console.log(`Duration: ${entry.duration}ms`)
    }
    if (entry.body) {
      console.log("Body:", typeof entry.body === "string" ? entry.body : entry.body)
    }
    console.groupEnd()
  } else if (entry.type === "error") {
    console.group(`${prefix} ✖ ERROR`)
    console.log(`%c${entry.error}`, "color: #f87171; font-weight: bold")
    if (entry.metadata) {
      console.log("Details:", entry.metadata)
    }
    console.groupEnd()
  } else if (entry.type === "info") {
    // Skip connection messages, only log meaningful info
    if (entry.source !== "debug-stream") {
      console.log(`${prefix} ℹ ${entry.body}`)
    }
  }
}

export function DebugTrafficConsole() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [logs, setLogs] = useState<DebugLogEntry[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Connect to SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    console.log("[v0] DebugConsole - Attempting to connect to /api/debug/stream")
    const es = new EventSource("/api/debug/stream")
    eventSourceRef.current = es

    es.onopen = () => {
      setIsConnected(true)
      console.log("[v0] DebugConsole - SSE stream connected successfully")
    }

    es.onmessage = (event) => {
      try {
        console.log("[v0] DebugConsole - Received SSE message:", event.data.substring(0, 100) + "...")
        const entry: DebugLogEntry = JSON.parse(event.data)
        formatLogForConsole(entry)
        setLogs((prev) => [...prev.slice(-499), entry]) // Keep last 500 logs
      } catch (e) {
        console.error("[1health API] Failed to parse debug log:", e)
      }
    }

    es.onerror = (error) => {
      setIsConnected(false)
      console.log("[v0] DebugConsole - SSE stream error, reconnecting in 3s...", error)
      setTimeout(connect, 3000)
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      if (eventSourceRef.current) {
        console.log("[v0] DebugConsole - Closing SSE connection on unmount")
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [connect])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const toggleLogExpanded = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const clearLogs = () => {
    setLogs([])
    setExpandedLogs(new Set())
  }

  const getTypeIcon = (type: DebugLogEntry["type"]) => {
    switch (type) {
      case "request":
        return <ArrowUp className="h-3 w-3 text-blue-400" />
      case "response":
        return <ArrowDown className="h-3 w-3 text-green-400" />
      case "error":
        return <AlertCircle className="h-3 w-3 text-red-400" />
      case "info":
        return <Info className="h-3 w-3 text-gray-400" />
    }
  }

  const getStatusColor = (status?: number) => {
    if (!status) return "bg-gray-500"
    if (status >= 200 && status < 300) return "bg-green-500"
    if (status >= 300 && status < 400) return "bg-yellow-500"
    if (status >= 400 && status < 500) return "bg-orange-500"
    return "bg-red-500"
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    })
  }

  // Floating toggle button when closed
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-zinc-900 p-0 shadow-lg hover:bg-zinc-800"
        title="Open API Traffic Console"
      >
        <Terminal className="h-5 w-5 text-green-400" />
        {logs.length > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">
            {logs.length > 99 ? "99+" : logs.length}
          </Badge>
        )}
      </Button>
    )
  }

  // Minimized bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 flex h-8 items-center justify-between bg-zinc-900 px-3 text-xs text-zinc-300 shadow-lg">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-green-400" />
          <span>API Traffic Console</span>
          <Badge variant="outline" className="h-5 text-xs">
            {logs.length} logs
          </Badge>
          <Circle
            className={`h-2 w-2 ${isConnected ? "fill-green-400 text-green-400" : "fill-red-400 text-red-400"}`}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(false)}>
            <Maximize2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    )
  }

  // Full console
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-80 flex-col bg-zinc-900 font-mono text-xs text-zinc-300 shadow-lg">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-zinc-700 bg-zinc-800 px-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-green-400" />
          <span className="font-semibold">API Traffic Console</span>
          <Badge variant="outline" className="h-5 text-xs">
            {logs.length}
          </Badge>
          <Circle
            className={`h-2 w-2 ${isConnected ? "fill-green-400 text-green-400" : "fill-red-400 text-red-400"}`}
          />
          <span className="text-zinc-500">{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-zinc-700"
            onClick={clearLogs}
            title="Clear logs"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-zinc-700"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-zinc-700" onClick={() => setIsOpen(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {logs.length === 0 && (
            <div className="flex items-center justify-center h-32 text-zinc-500">Waiting for API traffic...</div>
          )}
          {logs.map((log) => (
            <Collapsible key={log.id} open={expandedLogs.has(log.id)} onOpenChange={() => toggleLogExpanded(log.id)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-800 cursor-pointer">
                  {expandedLogs.has(log.id) ? (
                    <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-zinc-500 shrink-0" />
                  )}
                  <span className="text-zinc-500 shrink-0 w-20">{formatTime(log.timestamp)}</span>
                  {getTypeIcon(log.type)}
                  <Badge variant="outline" className="h-4 text-[10px] shrink-0">
                    {log.source}
                  </Badge>
                  {log.method && <span className="text-blue-400 font-semibold shrink-0">{log.method}</span>}
                  {log.url && <span className="text-zinc-400 truncate flex-1">{log.url}</span>}
                  {log.status && (
                    <Badge className={`h-4 text-[10px] shrink-0 ${getStatusColor(log.status)}`}>{log.status}</Badge>
                  )}
                  {log.duration && <span className="text-zinc-500 shrink-0">{log.duration}ms</span>}
                  {log.error && <span className="text-red-400 truncate flex-1">{log.error}</span>}
                  {log.type === "info" && typeof log.body === "string" && (
                    <span className="text-zinc-400 truncate flex-1">{log.body}</span>
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 mt-1 space-y-2 rounded bg-zinc-800 p-2 text-[11px]">
                  {log.headers && Object.keys(log.headers).length > 0 && (
                    <div>
                      <div className="text-zinc-500 mb-1">Headers:</div>
                      <pre className="text-zinc-300 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.headers, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.body && (
                    <div>
                      <div className="text-zinc-500 mb-1">Body:</div>
                      <pre className="text-zinc-300 whitespace-pre-wrap break-all">
                        {typeof log.body === "string" ? log.body : JSON.stringify(log.body, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div>
                      <div className="text-zinc-500 mb-1">Metadata:</div>
                      <pre className="text-zinc-300 whitespace-pre-wrap break-all">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
