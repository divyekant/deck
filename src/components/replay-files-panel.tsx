"use client"

import { useMemo, useState } from "react"
import { FileCode, FileText, ChevronLeft, ChevronRight, Files } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type {
  SessionMessage,
  AssistantMessage,
  ToolUseBlock,
} from "@/lib/claude/types"

// Tool names we care about for file operations
const FILE_TOOLS = new Set(["Write", "Edit", "Read", "Bash"])

// Operation color mapping
const OP_COLORS: Record<string, string> = {
  Write: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Edit: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Read: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  Bash: "bg-purple-500/20 text-purple-400 border-purple-500/30",
}

interface FileOperation {
  filePath: string
  operation: string
  messageIndex: number
}

/** Extract a file path from a tool_use block's input */
function extractFilePath(toolName: string, input: Record<string, unknown>): string | null {
  // Write, Edit, Read all use file_path
  if (input.file_path && typeof input.file_path === "string") {
    return input.file_path
  }
  // Bash commands sometimes reference files but we skip those — too noisy
  // Only include Bash if it has a clear file target in command
  if (toolName === "Bash" && typeof input.command === "string") {
    // Attempt to pull a file path from simple commands like `cat /foo/bar`
    const cmd = input.command as string
    const match = cmd.match(/(?:cat|less|head|tail|wc|chmod|mkdir|rm|touch|cp|mv)\s+(["']?)(\/.+?)\1(?:\s|$)/)
    if (match) return match[2]
    return null
  }
  // NotebookEdit uses notebook_path
  if (input.notebook_path && typeof input.notebook_path === "string") {
    return input.notebook_path
  }
  return null
}

/** Scan all messages and extract file operations with their message indices */
function extractFileOperations(messages: SessionMessage[]): FileOperation[] {
  const operations: FileOperation[] = []

  messages.forEach((msg, idx) => {
    if (msg.type !== "assistant") return
    const assistantMsg = msg as AssistantMessage
    const content = assistantMsg.message.content
    if (!Array.isArray(content)) return

    for (const block of content) {
      if (block.type !== "tool_use") continue
      const toolBlock = block as ToolUseBlock
      if (!FILE_TOOLS.has(toolBlock.name)) continue

      const filePath = extractFilePath(toolBlock.name, toolBlock.input)
      if (!filePath) continue

      operations.push({
        filePath,
        operation: toolBlock.name,
        messageIndex: idx,
      })
    }
  })

  return operations
}

/** Get the basename of a file path */
function basename(filePath: string): string {
  const parts = filePath.split("/")
  return parts[parts.length - 1] || filePath
}

/** Get a short directory hint (last 2 parent dirs) */
function dirHint(filePath: string): string {
  const parts = filePath.split("/")
  if (parts.length <= 2) return ""
  const dirs = parts.slice(-3, -1)
  return dirs.join("/") + "/"
}

interface ReplayFilesPanelProps {
  messages: SessionMessage[]
  currentIndex: number
}

export function ReplayFilesPanel({ messages, currentIndex }: ReplayFilesPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Extract all file operations from messages
  const allOperations = useMemo(() => extractFileOperations(messages), [messages])

  // Build unique file list with their operations and last-seen message index
  const fileEntries = useMemo(() => {
    const fileMap = new Map<
      string,
      { operations: Set<string>; firstIndex: number; lastIndex: number }
    >()

    for (const op of allOperations) {
      const existing = fileMap.get(op.filePath)
      if (existing) {
        existing.operations.add(op.operation)
        existing.lastIndex = Math.max(existing.lastIndex, op.messageIndex)
        existing.firstIndex = Math.min(existing.firstIndex, op.messageIndex)
      } else {
        fileMap.set(op.filePath, {
          operations: new Set([op.operation]),
          firstIndex: op.messageIndex,
          lastIndex: op.messageIndex,
        })
      }
    }

    return Array.from(fileMap.entries())
      .map(([path, data]) => ({
        path,
        operations: Array.from(data.operations),
        firstIndex: data.firstIndex,
        lastIndex: data.lastIndex,
      }))
      .sort((a, b) => a.firstIndex - b.firstIndex)
  }, [allOperations])

  // Determine which file is currently active at the playhead
  const activeFilePath = useMemo(() => {
    // Find the last file operation at or before currentIndex
    let lastOp: FileOperation | null = null
    for (const op of allOperations) {
      if (op.messageIndex <= currentIndex) {
        lastOp = op
      }
    }
    return lastOp?.filePath ?? null
  }, [allOperations, currentIndex])

  // Files touched up to the current index (for the count)
  const filesTouchedSoFar = useMemo(() => {
    const seen = new Set<string>()
    for (const op of allOperations) {
      if (op.messageIndex <= currentIndex) {
        seen.add(op.filePath)
      }
    }
    return seen.size
  }, [allOperations, currentIndex])

  const totalFiles = fileEntries.length

  if (totalFiles === 0) return null

  return (
    <div
      className={cn(
        "shrink-0 border-l border-zinc-800 bg-zinc-900 transition-all duration-200 flex flex-col",
        collapsed ? "w-10" : "w-72"
      )}
    >
      {/* Toggle header */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-zinc-800">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Files className="size-3.5 text-zinc-400 shrink-0" />
            <span className="text-xs font-medium text-zinc-300 truncate">
              Files Touched
            </span>
            <Badge
              variant="secondary"
              className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0"
            >
              {filesTouchedSoFar}/{totalFiles}
            </Badge>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-zinc-500 hover:text-zinc-300 shrink-0"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? (
            <ChevronLeft className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </Button>
      </div>

      {/* File list */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto py-1">
          {fileEntries.map((entry) => {
            const isActive = entry.path === activeFilePath
            const isReached = entry.firstIndex <= currentIndex
            const ext = basename(entry.path).split(".").pop() || ""
            const isCode = ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp", "h"].includes(ext)

            return (
              <div
                key={entry.path}
                className={cn(
                  "flex items-start gap-2 px-2 py-1.5 mx-1 rounded-md transition-colors",
                  isActive
                    ? "bg-zinc-700/50 border-l-2 border-emerald-500 pl-1.5"
                    : "border-l-2 border-transparent",
                  !isReached && "opacity-40"
                )}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  {isCode ? (
                    <FileCode className={cn("size-3.5", isActive ? "text-emerald-400" : "text-zinc-500")} />
                  ) : (
                    <FileText className={cn("size-3.5", isActive ? "text-emerald-400" : "text-zinc-500")} />
                  )}
                </div>

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "font-mono text-xs truncate",
                        isActive ? "text-zinc-100" : "text-zinc-300"
                      )}
                      title={entry.path}
                    >
                      {basename(entry.path)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-zinc-600 truncate font-mono">
                      {dirHint(entry.path)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {entry.operations.map((op) => (
                      <span
                        key={op}
                        className={cn(
                          "inline-flex items-center rounded px-1 py-0 text-[10px] font-medium border",
                          OP_COLORS[op] || "bg-zinc-800 text-zinc-400 border-zinc-700"
                        )}
                      >
                        {op}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
