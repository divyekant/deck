import type {
  SessionDetail,
  UserMessage,
  AssistantMessage,
  ContentBlock,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  ToolResultBlock,
} from "./types"
import { formatCost, formatTokens } from "./costs"

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function renderContentBlock(block: ContentBlock): string {
  switch (block.type) {
    case "text":
      return (block as TextBlock).text

    case "thinking": {
      const thinking = (block as ThinkingBlock).thinking
      return `\n<details><summary>Thinking</summary>\n\n${thinking}\n\n</details>\n`
    }

    case "tool_use": {
      const tool = block as ToolUseBlock
      let inputStr: string
      try {
        inputStr = JSON.stringify(tool.input, null, 2)
      } catch {
        inputStr = String(tool.input)
      }
      return `\n\`\`\`tool: ${tool.name}\n${inputStr}\n\`\`\`\n`
    }

    case "tool_result": {
      const result = block as ToolResultBlock
      const content = typeof result.content === "string"
        ? result.content
        : JSON.stringify(result.content, null, 2)
      return `\n\`\`\`tool_result\n${content}\n\`\`\`\n`
    }

    default:
      return ""
  }
}

export function sessionToMarkdown(detail: SessionDetail): string {
  const { meta, messages } = detail

  // Header
  const title = meta.firstPrompt.slice(0, 60)
  const lines: string[] = [
    `# Session: ${title}`,
    "",
    `**Project:** ${meta.projectName} | **Model:** ${meta.model} | **Date:** ${formatDate(meta.startTime)}`,
    `**Duration:** ${formatDuration(meta.duration)} | **Cost:** ${formatCost(meta.estimatedCost)} | **Tokens:** ${formatTokens(meta.totalInputTokens)} in / ${formatTokens(meta.totalOutputTokens)} out`,
    "",
    "---",
    "",
    "## Conversation",
    "",
  ]

  for (const msg of messages) {
    if (msg.type === "user") {
      const userMsg = msg as UserMessage
      lines.push("### User")
      lines.push("")

      if (typeof userMsg.message.content === "string") {
        lines.push(userMsg.message.content)
      } else if (Array.isArray(userMsg.message.content)) {
        for (const block of userMsg.message.content) {
          lines.push(renderContentBlock(block as ContentBlock))
        }
      }

      lines.push("")
    } else if (msg.type === "assistant") {
      const assistantMsg = msg as AssistantMessage
      lines.push("### Assistant")
      lines.push("")

      if (Array.isArray(assistantMsg.message.content)) {
        for (const block of assistantMsg.message.content) {
          lines.push(renderContentBlock(block))
        }
      }

      lines.push("")
    }
  }

  return lines.join("\n")
}
