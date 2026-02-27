"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Puzzle,
  Plus,
  Trash2,
  Pencil,
  Terminal,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface McpServerConfig {
  command: string
  args: string[]
  env?: Record<string, string>
}

type McpServers = Record<string, McpServerConfig>

function maskValue(val: string): string {
  if (val.length <= 4) return "***"
  return val.slice(0, 4) + "***"
}

interface EnvEntry {
  key: string
  value: string
}

interface ServerFormState {
  name: string
  command: string
  args: string
  envEntries: EnvEntry[]
}

const emptyForm: ServerFormState = {
  name: "",
  command: "",
  args: "",
  envEntries: [],
}

export default function McpPage() {
  const [servers, setServers] = useState<McpServers>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [editingName, setEditingName] = useState<string | null>(null)
  const [form, setForm] = useState<ServerFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchServers = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp")
      if (!res.ok) throw new Error("Failed to fetch MCP config")
      const data = await res.json()
      setServers(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServers()
  }, [fetchServers])

  const openAddDialog = () => {
    setForm(emptyForm)
    setDialogMode("add")
    setEditingName(null)
    setSaveError(null)
    setDialogOpen(true)
  }

  const openEditDialog = (name: string) => {
    const config = servers[name]
    if (!config) return
    setForm({
      name,
      command: config.command,
      args: config.args.join("\n"),
      envEntries: config.env
        ? Object.entries(config.env).map(([key, value]) => ({ key, value }))
        : [],
    })
    setDialogMode("edit")
    setEditingName(name)
    setSaveError(null)
    setDialogOpen(true)
  }

  const addEnvEntry = () => {
    setForm((prev) => ({
      ...prev,
      envEntries: [...prev.envEntries, { key: "", value: "" }],
    }))
  }

  const removeEnvEntry = (index: number) => {
    setForm((prev) => ({
      ...prev,
      envEntries: prev.envEntries.filter((_, i) => i !== index),
    }))
  }

  const updateEnvEntry = (index: number, field: "key" | "value", val: string) => {
    setForm((prev) => ({
      ...prev,
      envEntries: prev.envEntries.map((e, i) =>
        i === index ? { ...e, [field]: val } : e
      ),
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.command.trim()) {
      setSaveError("Name and command are required")
      return
    }

    setSaving(true)
    setSaveError(null)

    const args = form.args
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean)

    const env: Record<string, string> = {}
    for (const entry of form.envEntries) {
      if (entry.key.trim()) {
        env[entry.key.trim()] = entry.value
      }
    }

    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: dialogMode === "add" ? "add" : "update",
          name: form.name.trim(),
          config: {
            command: form.command.trim(),
            args,
            env: Object.keys(env).length > 0 ? env : undefined,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }

      const data = await res.json()
      setServers(data.mcpServers)
      setDialogOpen(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", name: deleteTarget }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to remove")
      }

      const data = await res.json()
      setServers(data.mcpServers)
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove server")
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const serverEntries = Object.entries(servers)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Puzzle className="size-5 text-zinc-400" />
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            MCP Servers
          </h1>
          <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
            {loading ? "..." : serverEntries.length}
          </Badge>
        </div>
        <Button
          onClick={openAddDialog}
          className="gap-1.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        >
          <Plus className="size-4" />
          Add Server
        </Button>
      </div>

      <Separator className="bg-zinc-800" />

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl bg-zinc-800" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && serverEntries.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Puzzle className="size-12 text-zinc-800 mb-4" />
          <p className="text-sm text-zinc-500">
            No MCP servers configured.
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Add a server to get started.
          </p>
        </div>
      )}

      {/* Server cards */}
      {!loading && serverEntries.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {serverEntries.map(([name, config]) => (
            <Card
              key={name}
              className="border-zinc-800 bg-zinc-900"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-zinc-100 text-base">
                    {name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(name)}
                      className="size-8 p-0 text-zinc-500 hover:text-zinc-300"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(name)}
                      className="size-8 p-0 text-zinc-500 hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Command */}
                <div className="flex items-start gap-2">
                  <Terminal className="size-3.5 mt-0.5 shrink-0 text-zinc-600" />
                  <code className="font-mono text-xs text-zinc-300 break-all">
                    {config.command}{" "}
                    {config.args.map((a, i) => (
                      <span key={i} className="text-zinc-500">
                        {a}{" "}
                      </span>
                    ))}
                  </code>
                </div>

                {/* Env vars */}
                {config.env && Object.keys(config.env).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      Environment
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(config.env).map(([key, value]) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className="border-zinc-700 text-zinc-400 font-mono text-[10px]"
                        >
                          {key}={maskValue(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "Add MCP Server" : `Edit "${editingName}"`}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              {dialogMode === "add"
                ? "Configure a new MCP server for Claude."
                : "Modify the server configuration."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={dialogMode === "edit"}
                placeholder="my-server"
                className="border-zinc-700 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            {/* Command */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Command</label>
              <Input
                value={form.command}
                onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                placeholder="node"
                className="border-zinc-700 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            {/* Args */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Arguments <span className="text-zinc-600">(one per line)</span>
              </label>
              <textarea
                value={form.args}
                onChange={(e) => setForm((f) => ({ ...f, args: e.target.value }))}
                placeholder={"/path/to/server.js\n--port\n3000"}
                rows={3}
                className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 font-mono"
              />
            </div>

            {/* Env vars */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">
                  Environment Variables
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addEnvEntry}
                  className="h-6 gap-1 text-xs text-zinc-500 hover:text-zinc-300"
                >
                  <Plus className="size-3" />
                  Add
                </Button>
              </div>
              {form.envEntries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={entry.key}
                    onChange={(e) => updateEnvEntry(i, "key", e.target.value)}
                    placeholder="KEY"
                    className="flex-1 border-zinc-700 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600 font-mono text-xs"
                  />
                  <span className="text-zinc-600">=</span>
                  <Input
                    value={entry.value}
                    onChange={(e) => updateEnvEntry(i, "value", e.target.value)}
                    placeholder="value"
                    className="flex-1 border-zinc-700 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeEnvEntry(i)}
                    className="size-7 p-0 text-zinc-600 hover:text-red-400"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              {form.envEntries.length === 0 && (
                <p className="text-[10px] text-zinc-600">No environment variables</p>
              )}
            </div>

            {saveError && (
              <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2">
                <p className="text-xs text-red-400">{saveError}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.command.trim()}
              className="gap-1.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {dialogMode === "add" ? "Add Server" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-400" />
              Remove Server
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to remove <strong className="text-zinc-200">{deleteTarget}</strong>?
              This will update your MCP configuration file.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1.5"
            >
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
