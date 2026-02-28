"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

interface ShortcutsModalProps {
  open: boolean
  onClose: () => void
}

const kbdClass =
  "inline-flex items-center rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-zinc-400"

const NAV_SHORTCUTS = [
  { keys: ["g", "h"], label: "Home" },
  { keys: ["g", "s"], label: "Sessions" },
  { keys: ["g", "a"], label: "Analytics" },
  { keys: ["g", "c"], label: "Costs" },
  { keys: ["g", "l"], label: "Live" },
  { keys: ["g", "r"], label: "Repos" },
  { keys: ["g", "t"], label: "Timeline" },
  { keys: ["g", "p"], label: "Pulse" },
  { keys: ["g", "d"], label: "Diffs" },
  { keys: ["g", "k"], label: "Skills" },
  { keys: ["g", "w"], label: "Work Graph" },
  { keys: ["g", "n"], label: "Snapshots" },
  { keys: ["g", "o"], label: "Ports" },
  { keys: ["g", "m"], label: "Compare" },
]

const GENERAL_SHORTCUTS = [
  { keys: ["\u2318", "K"], label: "Command palette" },
  { keys: ["?"], label: "Keyboard shortcuts" },
  { keys: ["Esc"], label: "Close modal / cancel" },
]

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((key, i) => (
          <span key={i}>
            <kbd className={kbdClass}>{key}</kbd>
            {i < keys.length - 1 && (
              <span className="mx-0.5 text-xs text-zinc-600">+</span>
            )}
          </span>
        ))}
      </span>
    </div>
  )
}

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl border-zinc-700 bg-zinc-900 shadow-2xl">
        <DialogTitle className="text-zinc-100">Keyboard Shortcuts</DialogTitle>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Navigation column */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Navigation
            </h3>
            <div className="divide-y divide-zinc-800">
              {NAV_SHORTCUTS.map((s) => (
                <ShortcutRow key={s.label} keys={s.keys} label={s.label} />
              ))}
            </div>
          </div>

          {/* General column */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
              General
            </h3>
            <div className="divide-y divide-zinc-800">
              {GENERAL_SHORTCUTS.map((s) => (
                <ShortcutRow key={s.label} keys={s.keys} label={s.label} />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
