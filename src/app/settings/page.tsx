"use client"

import { useEffect, useState } from "react"
import { Settings as SettingsIcon, Check, Sparkles, Code2, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const changelog = [
  { version: "v2.3", title: "Health Section", features: ["Project hygiene scoring", "Dependencies viewer", "Version mismatch detection"] },
  { version: "v2.2", title: "Config Depth", features: ["Agents browser", "Memory viewer", "Hooks inspector", "Setup tabs (CLAUDE.md/Plugins/MCP)"] },
  { version: "v2.1", title: "Nav Reshaping", features: ["Sidebar restructured to 19 items", "Costs tabs (Overview/Tokens/Models)", "19 pages consolidated or removed"] },
  { version: "v2.0", title: "About & Changelog", features: ["About & changelog page", "Onboarding experience", "Global status bar"] },
  { version: "v1.9", title: "Session Insights", features: ["Session insights", "Focus mode", "Command history"] },
  { version: "v1.8", title: "Enhanced Search", features: ["Enhanced search", "Session grouping", "Cost forecasting"] },
  { version: "v1.7", title: "Dashboard Customization", features: ["Dashboard customization", "Data export", "Session annotations"] },
  { version: "v1.6", title: "Activity Feed", features: ["Activity feed", "Bookmarks", "Git dashboard"] },
  { version: "v1.5", title: "Notifications", features: ["Notifications", "Daily digest", "Session templates"] },
  { version: "v1.4", title: "Project Health", features: ["Project health", "Reports", "Favorites"] },
  { version: "v1.3", title: "Session Chains", features: ["Session chains", "Model comparison", "Mobile nav"] },
  { version: "v1.2", title: "Session Replay", features: ["Session replay", "Prompt library", "Tags analytics"] },
  { version: "v1.1", title: "Token Analytics", features: ["Token analytics", "Cost tips", "Session heatmap"] },
  { version: "v1.0", title: "Keyboard Navigation", features: ["Keyboard navigation", "Streak/highlights widgets", "Session polish"] },
  { version: "v0.9", title: "Ports Monitor", features: ["Ports monitor", "Session compare", "Context window viz"] },
  { version: "v0.8", title: "Repo Pulse", features: ["Repo pulse", "Work graph", "Snapshots"] },
  { version: "v0.7", title: "Timeline", features: ["Timeline", "Diffs", "Skills browser"] },
  { version: "v0.6", title: "Search & Analytics", features: ["Search", "Analytics page"] },
  { version: "v0.5", title: "Session New", features: ["Session new", "Live sessions"] },
  { version: "v0.4", title: "Session Detail", features: ["Session detail", "Cost tracking"] },
  { version: "v0.3", title: "Repos & Settings", features: ["Repos page", "Settings"] },
  { version: "v0.2", title: "Sessions List", features: ["Sessions list", "MCP servers"] },
  { version: "v0.1", title: "Initial Release", features: ["Home dashboard", "Sidebar", "Initial layout"] },
]

interface DeckSettings {
  budget: number
  budgetResetDay: number
  theme: "dark" | "light"
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<DeckSettings | null>(null)
  const [budget, setBudget] = useState("")
  const [resetDay, setResetDay] = useState("1")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings")
        if (!res.ok) throw new Error("Failed to load settings")
        const data: DeckSettings = await res.json()
        setSettings(data)
        setBudget(String(data.budget))
        setResetDay(String(data.budgetResetDay))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings")
      }
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budget: parseFloat(budget) || 0,
          budgetResetDay: parseInt(resetDay, 10) || 1,
        }),
      })
      if (!res.ok) throw new Error("Failed to save settings")
      const data: DeckSettings = await res.json()
      setSettings(data)
      setBudget(String(data.budget))
      setResetDay(String(data.budgetResetDay))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  if (error && !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Settings
        </h1>
      </div>

      <Card className="max-w-lg border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-300">
            Budget
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Monthly Budget */}
          <div className="space-y-1.5">
            <label
              htmlFor="budget"
              className="text-xs font-medium text-muted-foreground"
            >
              Monthly Budget
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="budget"
                type="number"
                min={0}
                step={10}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="border-zinc-700 bg-zinc-800 pl-7 text-zinc-100 focus-visible:border-zinc-600 focus-visible:ring-zinc-700/50"
                placeholder="500"
              />
            </div>
          </div>

          {/* Budget Reset Day */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Budget Reset Day
            </label>
            <Select value={resetDay} onValueChange={setResetDay}>
              <SelectTrigger className="w-full border-zinc-700 bg-zinc-800 text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-800">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {day === 1
                      ? "1st of each month"
                      : day === 2
                        ? "2nd of each month"
                        : day === 3
                          ? "3rd of each month"
                          : `${day}th of each month`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Budget tracking resets on this day each month.
            </p>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="size-3.5" />
                Saved
              </span>
            )}
            {error && settings && (
              <span className="text-xs text-red-400">{error}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <div className="max-w-lg space-y-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-300">About Deck</h2>
          <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            v2.3
          </span>
        </div>
        <p className="text-xs leading-relaxed text-zinc-500">
          A local-first dashboard for Claude Code analytics. Reads session data from{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300">
            ~/.claude/projects/
          </code>{" "}
          and provides rich analytics, insights, and tools.
        </p>
        <a
          href="https://github.com/divyekant/deck"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <Code2 className="h-3.5 w-3.5" />
          View on GitHub
          <ExternalLink className="h-3 w-3 text-zinc-600" />
        </a>
      </div>

      {/* Changelog */}
      <div className="max-w-lg space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">Changelog</h2>
        <div className="space-y-2">
          {changelog.map((entry) => (
            <div
              key={entry.version}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                  {entry.version}
                </span>
                <span className="text-xs font-medium text-zinc-400">
                  {entry.title}
                </span>
              </div>
              <ul className="mt-1.5 space-y-0.5 pl-0.5">
                {entry.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-1.5 text-xs text-zinc-500"
                  >
                    <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-zinc-600" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
