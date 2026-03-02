"use client"

import { useEffect, useState } from "react"
import { Settings as SettingsIcon, Check, Sparkles, Code2, ExternalLink, Key, Shield, Eye, EyeOff } from "lucide-react"
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
  { version: "v2.7", title: "UI Polish & Light Mode", features: ["Light/dark mode toggle", "Home page grid fix", "Timeline dot alignment", "Settings two-column layout", "Theme icon in header"] },
  { version: "v2.6", title: "Session Auth & Resume", features: ["Auth token settings (API key + OAuth)", "Multi-turn session resume", "CLAUDECODE env isolation", "Docker auth passthrough"] },
  { version: "v2.5", title: "Health Depth", features: ["Worktrees browser", "Env scanner", "Config lint", "Diagnose with Claude", "Dependency graph", "Repo drill-down"] },
  { version: "v2.4", title: "Session Replay", features: ["Timeline scrubber with event markers", "Files panel sidebar", "Draggable playhead with keyboard nav"] },
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
  authToken: string
  authType: "none" | "api_key" | "oauth"
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<DeckSettings | null>(null)
  const [budget, setBudget] = useState("")
  const [resetDay, setResetDay] = useState("1")
  const [authToken, setAuthToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingAuth, setSavingAuth] = useState(false)
  const [savedAuth, setSavedAuth] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings")
        if (!res.ok) throw new Error("Failed to load settings")
        const data: DeckSettings = await res.json()
        setSettings(data)
        setBudget(String(data.budget))
        setResetDay(String(data.budgetResetDay))
        setAuthToken(data.authToken || "")
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

  async function handleSaveAuth() {
    setSavingAuth(true)
    setSavedAuth(false)
    setAuthError(null)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken: authToken.trim() }),
      })
      if (!res.ok) throw new Error("Failed to save auth settings")
      const data: DeckSettings = await res.json()
      setSettings(data)
      setAuthToken(data.authToken || "")
      setSavedAuth(true)
      setTimeout(() => setSavedAuth(false), 2000)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingAuth(false)
    }
  }

  function detectTokenType(token: string): string {
    if (!token.trim()) return "none"
    if (token.startsWith("sk-ant-oat01-")) return "oauth"
    return "api_key"
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
        <SettingsIcon className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left column — settings */}
        <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
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
                className="pl-7"
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
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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

      {/* Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Key className="size-3.5" />
            Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="authToken" className="text-xs font-medium text-muted-foreground">
              Anthropic API Key or OAuth Token
            </label>
            <div className="relative">
              <Input
                id="authToken"
                type={showToken ? "text" : "password"}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="pr-10 font-mono text-xs"
                placeholder="sk-ant-api03-... or sk-ant-oat01-..."
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            {authToken.trim() && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <Shield className="size-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  Detected:{" "}
                  <span className={detectTokenType(authToken) === "oauth" ? "text-violet-400" : "text-emerald-400"}>
                    {detectTokenType(authToken) === "oauth" ? "OAuth Subscription Token" : "API Key"}
                  </span>
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Required for launching sessions from Docker. Get your key from{" "}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                console.anthropic.com
              </a>
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={handleSaveAuth}
              disabled={savingAuth}
            >
              {savingAuth ? "Saving..." : "Save"}
            </Button>
            {savedAuth && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="size-3.5" />
                Saved
              </span>
            )}
            {authError && (
              <span className="text-xs text-red-400">{authError}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">About Deck</h2>
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            v2.7
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A local-first dashboard for Claude Code analytics. Reads session data from{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[10px] text-foreground">
            ~/.claude/projects/
          </code>{" "}
          and provides rich analytics, insights, and tools.
        </p>
        <a
          href="https://github.com/divyekant/deck"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Code2 className="h-3.5 w-3.5" />
          View on GitHub
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

        </div>{/* end left column */}

        {/* Right column — changelog */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Changelog</h2>
          <div className="divide-y divide-border rounded-lg border">
            {changelog.map((entry) => (
              <div key={entry.version} className="flex gap-3 px-3 py-2">
                <span className="inline-flex h-5 shrink-0 items-center rounded bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                  {entry.version}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-foreground">{entry.title}</span>
                  <span className="ml-2 text-[11px] text-muted-foreground">
                    {entry.features.join(" · ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>{/* end grid */}
    </div>
  )
}
