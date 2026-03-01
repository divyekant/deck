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
  FileText,
  ChevronDown,
  ChevronRight,
  Globe,
  FolderOpen,
  Package,
  Blocks,
  Settings,
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

// ---- Types ----

type SetupTab = "claude-md" | "plugins" | "mcp"

interface ClaudeMdEntry {
  scope: "global" | "project"
  projectName: string | null
  content: string
  path: string
  size: number
  lastModified: string
}

interface PluginEntry {
  org: string
  name: string
  version: string
  path: string
  skillCount: number
}

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

const SETUP_TABS: { value: SetupTab; label: string; icon: React.ElementType }[] = [
  { value: "claude-md", label: "CLAUDE.md", icon: FileText },
  { value: "plugins", label: "Plugins", icon: Package },
  { value: "mcp", label: "MCP Servers", icon: Puzzle },
]

// ---- CLAUDE.md Tab ----

function ClaudeMdTab() {
  const [entries, setEntries] = useState<ClaudeMdEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/claude-md")
        if (!res.ok) throw new Error("Failed to fetch CLAUDE.md files")
        const data = await res.json()
        setEntries(data)
        // Auto-expand global
        const globalPaths = new Set<string>()
        for (const e of data as ClaudeMdEntry[]) {
          if (e.scope === "global") globalPaths.add(e.path)
        }
        setExpanded(globalPaths)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const toggleExpanded = (entryPath: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(entryPath)) {
        next.delete(entryPath)
      } else {
        next.add(entryPath)
      }
      return next
    })
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl bg-zinc-800" />
        <Skeleton className="h-32 w-full rounded-xl bg-zinc-800" />
        <Skeleton className="h-32 w-full rounded-xl bg-zinc-800" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="size-12 text-zinc-800 mb-4" />
        <p className="text-sm text-zinc-500">No CLAUDE.md files found.</p>
        <p className="text-xs text-zinc-600 mt-1">
          Create a CLAUDE.md in your project root or ~/.claude/ to get started.
        </p>
      </div>
    )
  }

  const globalEntries = entries.filter((e) => e.scope === "global")
  const projectEntries = entries.filter((e) => e.scope === "project")

  return (
    <div className="space-y-6">
      {/* Global */}
      {globalEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-400">Global</h3>
          </div>
          {globalEntries.map((entry) => (
            <Card key={entry.path} className="border-zinc-800 bg-zinc-900">
              <CardHeader className="pb-2">
                <button
                  onClick={() => toggleExpanded(entry.path)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    {expanded.has(entry.path) ? (
                      <ChevronDown className="size-4 text-zinc-500" />
                    ) : (
                      <ChevronRight className="size-4 text-zinc-500" />
                    )}
                    <CardTitle className="text-zinc-100 text-sm font-mono">
                      {entry.path}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-500 text-[10px]"
                    >
                      {formatSize(entry.size)}
                    </Badge>
                    <span className="text-[10px] text-zinc-600">
                      {formatDate(entry.lastModified)}
                    </span>
                  </div>
                </button>
              </CardHeader>
              {expanded.has(entry.path) && (
                <CardContent>
                  <pre className="whitespace-pre-wrap text-xs text-zinc-300 font-mono leading-relaxed max-h-96 overflow-y-auto rounded-md bg-zinc-950 p-3 border border-zinc-800">
                    {entry.content}
                    {entry.size > 10000 && (
                      <span className="text-zinc-600 italic">
                        {"\n\n... truncated at 10,000 characters"}
                      </span>
                    )}
                  </pre>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Per-project */}
      {projectEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-400">
              Projects
            </h3>
            <Badge
              variant="secondary"
              className="bg-zinc-800 text-zinc-500 text-[10px]"
            >
              {projectEntries.length}
            </Badge>
          </div>
          {projectEntries.map((entry) => (
            <Card key={entry.path} className="border-zinc-800 bg-zinc-900">
              <CardHeader className="pb-2">
                <button
                  onClick={() => toggleExpanded(entry.path)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    {expanded.has(entry.path) ? (
                      <ChevronDown className="size-4 text-zinc-500" />
                    ) : (
                      <ChevronRight className="size-4 text-zinc-500" />
                    )}
                    <CardTitle className="text-zinc-100 text-sm">
                      {entry.projectName}
                    </CardTitle>
                    <span className="text-[10px] text-zinc-600 font-mono">
                      {entry.path}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-zinc-800 text-zinc-500 text-[10px]"
                    >
                      {formatSize(entry.size)}
                    </Badge>
                    <span className="text-[10px] text-zinc-600">
                      {formatDate(entry.lastModified)}
                    </span>
                  </div>
                </button>
              </CardHeader>
              {expanded.has(entry.path) && (
                <CardContent>
                  <pre className="whitespace-pre-wrap text-xs text-zinc-300 font-mono leading-relaxed max-h-96 overflow-y-auto rounded-md bg-zinc-950 p-3 border border-zinc-800">
                    {entry.content}
                    {entry.size > 10000 && (
                      <span className="text-zinc-600 italic">
                        {"\n\n... truncated at 10,000 characters"}
                      </span>
                    )}
                  </pre>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Plugins Tab ----

function PluginsTab() {
  const [plugins, setPlugins] = useState<PluginEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/plugins")
        if (!res.ok) throw new Error("Failed to fetch plugins")
        const data = await res.json()
        setPlugins(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl bg-zinc-800" />
        <Skeleton className="h-40 w-full rounded-xl bg-zinc-800" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package className="size-12 text-zinc-800 mb-4" />
        <p className="text-sm text-zinc-500">No plugins installed.</p>
        <p className="text-xs text-zinc-600 mt-1">
          Install plugins via Claude Code to see them here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plugins.map((plugin) => (
        <Card
          key={`${plugin.org}/${plugin.name}/${plugin.version}`}
          className="border-zinc-800 bg-zinc-900"
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-zinc-100 text-base">
                {plugin.name}
              </CardTitle>
              <Badge
                variant="secondary"
                className="bg-zinc-800 text-zinc-400 font-mono text-[10px]"
              >
                v{plugin.version}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Org */}
            <div className="flex items-center gap-2">
              <Blocks className="size-3.5 text-zinc-600" />
              <span className="text-xs text-zinc-400">{plugin.org}</span>
            </div>

            {/* Path */}
            <div className="flex items-center gap-2">
              <FolderOpen className="size-3.5 text-zinc-600" />
              <code className="text-[10px] text-zinc-500 font-mono break-all">
                {plugin.path}
              </code>
            </div>

            {/* Skills count */}
            <div className="flex items-center gap-2">
              <Puzzle className="size-3.5 text-zinc-600" />
              <span className="text-xs text-zinc-400">
                {plugin.skillCount} skill {plugin.skillCount === 1 ? "file" : "files"}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---- MCP Servers Tab (existing) ----

function McpServersTab() {
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
    <>
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">
          {loading ? "..." : serverEntries.length} server{serverEntries.length !== 1 ? "s" : ""}
        </Badge>
        <Button
          onClick={openAddDialog}
          className="gap-1.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
        >
          <Plus className="size-4" />
          Add Server
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-4 py-3 mb-4">
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
    </>
  )
}

// ---- Main Page ----

export default function SetupPage() {
  const [activeTab, setActiveTab] = useState<SetupTab>("claude-md")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="size-5 text-zinc-400" />
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Setup
        </h1>
      </div>

      {/* Tab bar */}
      <div className="border-b border-zinc-800">
        <div className="flex gap-6">
          {SETUP_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.value
                    ? "border-emerald-500 text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "claude-md" && <ClaudeMdTab />}
      {activeTab === "plugins" && <PluginsTab />}
      {activeTab === "mcp" && <McpServersTab />}
    </div>
  )
}
