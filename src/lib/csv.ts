import type { SessionMeta } from "@/lib/claude/types"

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

export function sessionsToCSV(sessions: SessionMeta[]): string {
  const header = [
    "ID",
    "Source",
    "Project",
    "Model",
    "First Prompt",
    "Messages",
    "Input Tokens",
    "Output Tokens",
    "Cost",
    "Start Time",
    "Duration (seconds)",
  ].join(",")

  const rows = sessions.map((s) =>
    [
      escapeCSV(s.id),
      escapeCSV(s.source),
      escapeCSV(s.projectName),
      escapeCSV(s.model),
      escapeCSV(s.firstPrompt),
      s.messageCount,
      s.totalInputTokens,
      s.totalOutputTokens,
      s.estimatedCost.toFixed(4),
      s.startTime,
      Math.round(s.duration / 1000),
    ].join(",")
  )

  return [header, ...rows].join("\n")
}
