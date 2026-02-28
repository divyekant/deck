"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Rocket, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"

interface Template {
  id: string
  name: string
  description: string
  prompt: string
  model?: string
  category: string
  isDefault: boolean
}

const CATEGORIES = [
  "All",
  "Bug Fix",
  "Code Review",
  "Feature",
  "Refactor",
  "Exploration",
  "Documentation",
]

const CATEGORY_COLORS: Record<string, string> = {
  "Bug Fix": "bg-red-500/10 text-red-400 border-red-500/20",
  "Code Review": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Feature: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Refactor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Exploration: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  Documentation: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
}

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("All")
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())

  // Create form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newPrompt, setNewPrompt] = useState("")
  const [newCategory, setNewCategory] = useState("")
  const [newModel, setNewModel] = useState("")
  const [creating, setCreating] = useState(false)

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates")
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } catch (err) {
      console.error("Failed to fetch templates:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const filtered =
    activeCategory === "All"
      ? templates
      : templates.filter((t) => t.category === activeCategory)

  function togglePrompt(id: string) {
    setExpandedPrompts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleCreate() {
    if (!newName || !newDescription || !newPrompt || !newCategory) return
    setCreating(true)
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          prompt: newPrompt,
          category: newCategory,
          ...(newModel ? { model: newModel } : {}),
        }),
      })
      if (res.ok) {
        setCreateOpen(false)
        setNewName("")
        setNewDescription("")
        setNewPrompt("")
        setNewCategory("")
        setNewModel("")
        await fetchTemplates()
      }
    } catch (err) {
      console.error("Failed to create template:", err)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setDeleteConfirm(null)
        await fetchTemplates()
      }
    } catch (err) {
      console.error("Failed to delete template:", err)
    }
  }

  function handleLaunch(prompt: string) {
    router.push(`/sessions/new?prompt=${encodeURIComponent(prompt)}`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Session Templates
          </h1>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-zinc-800 bg-zinc-900 animate-pulse">
              <CardContent className="h-40" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Session Templates
        </h1>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          Create Template
        </Button>
      </div>

      {/* Category filter tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={setActiveCategory}
      >
        <TabsList variant="line" className="flex-wrap">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* We render the same content for all tabs, just filtered */}
        {CATEGORIES.map((cat) => (
          <TabsContent key={cat} value={cat}>
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-zinc-500">
                No templates in this category.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filtered.map((template) => {
                  const isExpanded = expandedPrompts.has(template.id)
                  const colorClass =
                    CATEGORY_COLORS[template.category] ??
                    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"

                  return (
                    <Card
                      key={template.id}
                      className="border-zinc-800 bg-zinc-900"
                    >
                      <CardContent className="space-y-3">
                        {/* Top row: name + badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1.5">
                            <h3 className="text-sm font-semibold text-zinc-100">
                              {template.name}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] border ${colorClass}`}
                              >
                                {template.category}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  template.isDefault
                                    ? "border-zinc-700 text-zinc-500"
                                    : "border-violet-500/20 text-violet-400 bg-violet-500/10"
                                }`}
                              >
                                {template.isDefault ? "Default" : "Custom"}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {template.description}
                        </p>

                        {/* Prompt preview */}
                        <div>
                          <button
                            onClick={() => togglePrompt(template.id)}
                            className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-400 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )}
                            Prompt
                          </button>
                          {isExpanded ? (
                            <pre className="mt-1.5 whitespace-pre-wrap text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-md p-2.5 font-mono">
                              {template.prompt}
                            </pre>
                          ) : (
                            <p className="mt-1 text-xs text-zinc-500 truncate">
                              {template.prompt}
                            </p>
                          )}
                        </div>

                        {/* Model suggestion */}
                        {template.model && (
                          <p className="text-[10px] text-zinc-500">
                            Suggested model:{" "}
                            <span className="text-zinc-400">
                              {template.model}
                            </span>
                          </p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleLaunch(template.prompt)}
                            className="gap-1 border-zinc-700 text-zinc-300 hover:text-zinc-100"
                          >
                            <Rocket className="size-3" />
                            Launch
                          </Button>
                          {!template.isDefault && (
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => setDeleteConfirm(template.id)}
                              className="text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Create Template
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Create a reusable prompt template for new sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Template name"
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Description
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What is this template for?"
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Prompt
              </label>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="The prompt template text..."
                rows={4}
                className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Category
              </label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Model{" "}
                <span className="text-zinc-600 font-normal">(optional)</span>
              </label>
              <Select value={newModel} onValueChange={setNewModel}>
                <SelectTrigger className="bg-zinc-950 border-zinc-800 w-full">
                  <SelectValue placeholder="Any model" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="claude-opus-4-6">
                    Claude Opus 4.6
                  </SelectItem>
                  <SelectItem value="claude-sonnet-4-6">
                    Claude Sonnet 4.6
                  </SelectItem>
                  <SelectItem value="claude-haiku-4-5">
                    Claude Haiku 4.5
                  </SelectItem>
                  <SelectItem value="gpt-4.1">GPT-4.1</SelectItem>
                  <SelectItem value="o3">o3</SelectItem>
                  <SelectItem value="o4-mini">o4-mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating || !newName || !newDescription || !newPrompt || !newCategory
              }
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null)
        }}
      >
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Delete Template
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete this template? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-zinc-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
