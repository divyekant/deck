"use client"

import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, X } from "lucide-react"

const SPEEDS = [1, 2, 5]

interface ReplayScrubberProps {
  total: number
  currentIndex: number
  onChange: (index: number) => void
  playing: boolean
  onPlayPause: () => void
  speed: number
  onSpeedChange: (speed: number) => void
  onClose: () => void
}

export function ReplayScrubber({
  total,
  currentIndex,
  onChange,
  playing,
  onPlayPause,
  speed,
  onSpeedChange,
  onClose,
}: ReplayScrubberProps) {
  const progressPct = total > 0 ? ((currentIndex + 1) / total) * 100 : 0
  const atEnd = currentIndex >= total - 1

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const idx = Math.min(Math.floor(pct * total), total - 1)
    onChange(Math.max(0, idx))
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Transport controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={() => onChange(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            <SkipBack className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full bg-accent text-foreground hover:bg-accent/80"
            onClick={onPlayPause}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground disabled:opacity-30"
            onClick={() => onChange(Math.min(total - 1, currentIndex + 1))}
            disabled={atEnd}
          >
            <SkipForward className="size-4" />
          </Button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                speed === s
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div
          className="flex-1 h-2 rounded-full bg-zinc-800 cursor-pointer relative group"
          onClick={handleProgressClick}
        >
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-150"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Position */}
        <span className="text-xs text-muted-foreground font-mono tabular-nums min-w-[4rem] text-right">
          {currentIndex + 1} / {total}
        </span>

        {/* Close replay */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          title="Exit replay (⌘R)"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
