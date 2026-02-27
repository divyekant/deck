"use client"

import { useEffect, useState } from "react"
import { Settings as SettingsIcon, Check } from "lucide-react"
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
    </div>
  )
}
